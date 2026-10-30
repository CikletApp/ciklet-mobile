import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  useIAP,
  type ProductSubscription,
  type Purchase,
  type ExpoPurchaseError as PurchaseError,
} from "expo-iap";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useInvalidateBoosts, type BoostSlot } from "@/api/hooks";
import { showDialog, showToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { IAP_ENABLED } from "@/lib/purchases";
import { BOOST_IAP_PRODUCT_ID } from "@/lib/server-boost";

/**
 * Sunucu Takviyesinin App Store / Google Play aboneliği (web lib/iap/products
 * `server_boost_monthly`). Mentol IAP'ıyla (features/mentol/use-mentol-iap)
 * aynı akış ve aynı doğrulama ucu: satın alma → POST /api/mentol/iap/verify
 * → sunucu STORE kaynaklı takviye slotu açar → işlem ancak o zaman kapatılır.
 * Hesap belirteci (appAccountToken / obfuscatedAccountId) Mentol'le aynı.
 *
 * Bir mağaza aboneliği = bir takviye. Mağaza aynı ürünü aynı hesaba ikinci
 * kez satmadığı için mobilde en çok bir ek takviye alınır; web fiyatı (PayTR)
 * burada gösterilmez, fiyat mağazanın yerel fiyatıdır.
 *
 * Mentol hook'u da `useIAP` dinliyor: her iki dinleyici de kendi ürün
 * kimliğine bakıp diğerinin satın almasını yok sayar.
 */

interface IapInfo {
  apple: boolean;
  google: boolean;
  accountToken: string;
}

type VerifyOutcome = { kind: "ok"; slots: BoostSlot[] } | { kind: "conflict" | "unavailable" | "failed" };

function isBoostPurchase(purchase: Purchase): boolean {
  return purchase.productId === BOOST_IAP_PRODUCT_ID && Boolean(purchase.purchaseToken);
}

/**
 * @param onVerified Kullanıcının başlattığı satın alma doğrulanınca — yeni
 *   slotlarla (takviye ekranı yeni slotu bu sunucuya uygular).
 */
export function useBoostIap(onVerified?: (slots: BoostSlot[]) => void) {
  const t = useT();
  const invalidate = useInvalidateBoosts();
  const [busy, setBusy] = useState(false);
  const silentSyncDone = useRef(false);
  const userInitiated = useRef(false);
  const verifiedRef = useRef(onVerified);
  useEffect(() => {
    verifiedRef.current = onVerified;
  }, [onVerified]);

  const info = useQuery({
    queryKey: ["mentol-iap"],
    queryFn: () => api<IapInfo>(endpoints.mentolIap),
    staleTime: 60 * 1000,
    enabled: IAP_ENABLED,
  });
  const serverReady = IAP_ENABLED && (Platform.OS === "ios" ? info.data?.apple === true : info.data?.google === true);

  const errorMessage = (error: PurchaseError): string | null => {
    switch (error.code) {
      case ErrorCode.UserCancelled:
        return null;
      case ErrorCode.Pending:
      case ErrorCode.DeferredPayment:
        return t("serverBoost.mobile.pending");
      case ErrorCode.AlreadyOwned:
        return t("serverBoost.mobile.storeLimit");
      case ErrorCode.BillingUnavailable:
      case ErrorCode.IapNotAvailable:
      case ErrorCode.FeatureNotSupported:
      case ErrorCode.ItemUnavailable:
      case ErrorCode.SkuNotFound:
        return t("serverBoost.mobile.unavailable");
      default:
        return t("serverBoost.actions.failed");
    }
  };

  const verify = async (purchase: Purchase): Promise<VerifyOutcome> => {
    const body =
      Platform.OS === "ios"
        ? { platform: "ios", signedTransaction: purchase.purchaseToken }
        : { platform: "android", productId: purchase.productId, purchaseToken: purchase.purchaseToken };
    try {
      const result = await api<{ boostSlots?: BoostSlot[] }>(endpoints.mentolIapVerify, { method: "POST", body });
      await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      return { kind: "ok", slots: Array.isArray(result.boostSlots) ? result.boostSlots : [] };
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (Platform.OS === "ios") await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
        return { kind: "conflict" };
      }
      if (error instanceof ApiError && error.status >= 500) return { kind: "unavailable" };
      return { kind: "failed" };
    }
  };

  const iap = useIAP({
    onPurchaseSuccess: (purchase) => {
      if (!isBoostPurchase(purchase)) return;
      if (purchase.purchaseState === "pending") {
        setBusy(false);
        showToast(t("serverBoost.mobile.pending"));
        return;
      }
      const loud = userInitiated.current;
      userInitiated.current = false;
      void verify(purchase).then((outcome) => {
        setBusy(false);
        invalidate();
        if (!loud) return;
        if (outcome.kind === "ok") {
          if (verifiedRef.current) verifiedRef.current(outcome.slots);
          else showToast(t("serverBoost.mobile.purchased"));
        } else if (outcome.kind === "conflict") showDialog(t("serverBoost.title"), t("serverBoost.mobile.conflict"));
        else if (outcome.kind === "unavailable") showDialog(t("serverBoost.title"), t("serverBoost.mobile.verifyLater"));
        else showDialog(t("serverBoost.title"), t("serverBoost.mobile.verifyFailed"));
      });
    },
    onPurchaseError: (error) => {
      setBusy(false);
      userInitiated.current = false;
      const message = errorMessage(error);
      if (message) showDialog(t("serverBoost.actions.buy"), message);
    },
  });
  const { connected, fetchProducts } = iap;

  useEffect(() => {
    if (IAP_ENABLED && connected) void fetchProducts({ skus: [BOOST_IAP_PRODUCT_ID], type: "subs" }).catch(() => undefined);
  }, [connected, fetchProducts]);

  // Yarıda kalmış (doğrulanmamış / onaylanmamış) takviye satın alması
  // sessizce tamamlanır — Mentol hook'uyla aynı kural.
  useEffect(() => {
    if (!connected || !serverReady || silentSyncDone.current) return;
    silentSyncDone.current = true;
    void (async () => {
      try {
        const purchases = (await getAvailablePurchases()).filter(isBoostPurchase);
        const unsynced = Platform.OS === "android" ? purchases.filter((p) => "isAcknowledgedAndroid" in p && p.isAcknowledgedAndroid === false) : purchases;
        let changed = false;
        for (const purchase of unsynced) changed = (await verify(purchase)).kind === "ok" || changed;
        if (changed) invalidate();
      } catch {
        // sessiz: bir sonraki açılışta yeniden denenir
      }
    })();
    // verify/invalidate her çizimde yeni; bir kez çalışması ref ile korunuyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, serverReady]);

  const product: ProductSubscription | null = iap.subscriptions.find((p) => p.id === BOOST_IAP_PRODUCT_ID) ?? null;

  /** Tek takviye aboneliği satın alır; sonuç dinleyiciden gelir. */
  const purchase = async () => {
    if (busy) return;
    const token = info.data?.accountToken;
    if (!serverReady || !token || !product) {
      showDialog(t("serverBoost.actions.buy"), t("serverBoost.mobile.unavailable"));
      return;
    }
    setBusy(true);
    userInitiated.current = true;
    try {
      if (Platform.OS === "ios") {
        await iap.requestPurchase({ type: "subs", request: { apple: { sku: product.id, appAccountToken: token } } });
      } else {
        const android = product.platform === "android" ? product : null;
        const offer = android?.subscriptionOffers.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? null;
        await iap.requestPurchase({
          type: "subs",
          request: {
            google: {
              skus: [product.id],
              obfuscatedAccountId: token,
              subscriptionOffers: offer ? [{ sku: product.id, offerToken: offer }] : undefined,
            },
          },
        });
      }
    } catch (error) {
      setBusy(false);
      userInitiated.current = false;
      const message = errorMessage(error as PurchaseError);
      if (message) showDialog(t("serverBoost.actions.buy"), message);
    }
  };

  return {
    enabled: IAP_ENABLED,
    connected,
    serverReady,
    loading: IAP_ENABLED && (info.isLoading || !connected),
    product,
    busy,
    purchase,
  };
}
