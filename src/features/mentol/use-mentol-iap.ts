import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ErrorCode,
  deepLinkToSubscriptions,
  finishTransaction,
  getAvailablePurchases,
  restorePurchases as restoreStorePurchases,
  useIAP,
  type ProductSubscription,
  type Purchase,
  type ExpoPurchaseError as PurchaseError,
} from "expo-iap";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { MentolPlan, MentolStoreSubscription } from "@/api/hooks/use-settings";
import { showDialog, showToast } from "@/components/ui";
import { MENTOL_IAP_SKUS, iapProductDef } from "./iap-products";

/**
 * Mentol'ün App Store / Google Play aboneliği (expo-iap, StoreKit 2 ve Play
 * Billing). YALNIZCA `IAP_ENABLED` iken çizilen kartta kullanılır.
 *
 * Akış: mağaza bağlantısı → ürünler (fiyat mağazadan) → satın alma →
 * mağaza işlemi SUNUCUDA doğrulanır (/api/mentol/iap/verify) → hak sunucuda
 * işlenir → işlem (finishTransaction) ancak o zaman kapatılır. Sunucuya
 * ulaşılamazsa işlem açık kalır: iOS bir sonraki açılışta yeniden verir,
 * Android'de ekran açıldığında sahip olunan abonelikler sessizce yeniden
 * doğrulanır (sunucu idempotent; aynı işlem iki kez hak vermez). Android'de
 * onaylanmayan satın alma 3 günde iade edilir; sunucu doğrulamada onaylar.
 *
 * Satın almaya hesap belirteci (sunucudan) iliştirilir: başka bir Ciklet
 * hesabına geçilip aynı Apple/Google hesabıyla geri yükleme yapılırsa sunucu
 * 409 döner ve abonelik ilk hesapta kalır.
 */

interface IapInfo {
  apple: boolean;
  google: boolean;
  accountToken: string;
  store: MentolStoreSubscription | null;
}

type VerifyResponse = MentolPlan & { store: MentolStoreSubscription | null };

type VerifyOutcome = "ok" | "conflict" | "unavailable" | "failed";

const ANDROID_PACKAGE = "com.ciklet.mobile";

function purchaseErrorMessage(error: PurchaseError): string | null {
  switch (error.code) {
    case ErrorCode.UserCancelled:
      return null;
    case ErrorCode.Pending:
    case ErrorCode.DeferredPayment:
      return "Ödeme onay bekliyor. Onaylandığında Mentol kendiliğinden açılır.";
    case ErrorCode.AlreadyOwned:
      return "Bu aboneliğe zaten sahipsin. \"Satın alımları geri yükle\"yi dene.";
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceTimeout:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ConnectionClosed:
      return "Mağazaya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.";
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
    case ErrorCode.FeatureNotSupported:
      return "Bu cihazda mağaza satın alması kullanılamıyor.";
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
      return "Bu abonelik şu anda satın alınamıyor.";
    default:
      return "Satın alma tamamlanamadı. Tekrar dene.";
  }
}

function isMentolPurchase(purchase: Purchase): boolean {
  return iapProductDef(purchase.productId) !== null && Boolean(purchase.purchaseToken);
}

export function useMentolIap() {
  const queryClient = useQueryClient();
  const [busySku, setBusySku] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const silentSyncDone = useRef(false);
  /** Kullanıcının bu oturumda başlattığı satın alma; açılışta yeniden gelen işlemler sessiz işlenir. */
  const userInitiated = useRef(false);

  const info = useQuery({
    queryKey: ["mentol-iap"],
    queryFn: () => api<IapInfo>(endpoints.mentolIap),
    staleTime: 60 * 1000,
  });
  const serverReady = Platform.OS === "ios" ? info.data?.apple === true : info.data?.google === true;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["mentol-plan"] });
    void queryClient.invalidateQueries({ queryKey: ["mentol-iap"] });
  };

  /** Mağaza işlemini sunucuya doğrulatır; başarıda işlemi kapatır. */
  const verify = async (purchase: Purchase): Promise<VerifyOutcome> => {
    const body =
      Platform.OS === "ios"
        ? { platform: "ios", signedTransaction: purchase.purchaseToken }
        : { platform: "android", productId: purchase.productId, purchaseToken: purchase.purchaseToken };
    try {
      const result = await api<VerifyResponse>(endpoints.mentolIapVerify, { method: "POST", body });
      queryClient.setQueryData(["mentol-plan"], result);
      await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
      return "ok";
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // iOS işlemi kapatılmazsa her açılışta yeniden gelir; Android'de
        // onaylanmayan satın alma Google tarafından iade edilir.
        if (Platform.OS === "ios") await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
        return "conflict";
      }
      if (error instanceof ApiError && (error.status === 503 || error.status === 502 || error.status >= 500)) return "unavailable";
      return "failed";
    }
  };

  const iap = useIAP({
    onPurchaseSuccess: (purchase) => {
      if (!isMentolPurchase(purchase)) return;
      if (purchase.purchaseState === "pending") {
        setBusySku(null);
        showToast("Ödeme onay bekliyor. Onaylandığında Mentol kendiliğinden açılır.");
        return;
      }
      const loud = userInitiated.current;
      userInitiated.current = false;
      void verify(purchase).then((outcome) => {
        setBusySku(null);
        refresh();
        if (!loud) return;
        if (outcome === "ok") showDialog("Mentol etkin", "Aboneliğin hesabına işlendi. Teşekkürler!");
        else if (outcome === "conflict") showDialog("Abonelik başka hesapta", "Bu mağaza aboneliği başka bir Ciklet hesabına bağlı.");
        else if (outcome === "unavailable") showDialog("Doğrulama bekliyor", "Ödemen alındı ama sunucuya şu an ulaşılamadı. Uygulamayı yeniden açtığında otomatik tamamlanır.");
        else showDialog("Doğrulanamadı", "Satın alma doğrulanamadı. \"Satın alımları geri yükle\"yi dene ya da destekle iletişime geç.");
      });
    },
    onPurchaseError: (error) => {
      setBusySku(null);
      userInitiated.current = false;
      const message = purchaseErrorMessage(error);
      if (message) showDialog("Satın alma", message);
    },
  });
  const { connected, fetchProducts } = iap;

  useEffect(() => {
    if (connected) void fetchProducts({ skus: [...MENTOL_IAP_SKUS], type: "subs" }).catch(() => undefined);
  }, [connected, fetchProducts]);

  // Ekran açılınca mağazadaki Mentol satın almaları sessizce doğrulanır:
  // yarıda kalmış (doğrulanmamış / onaylanmamış) satın alma tamamlanır.
  useEffect(() => {
    if (!connected || !serverReady || silentSyncDone.current) return;
    silentSyncDone.current = true;
    void (async () => {
      try {
        const purchases = (await getAvailablePurchases()).filter(isMentolPurchase);
        const unsynced = Platform.OS === "android" ? purchases.filter((p) => "isAcknowledgedAndroid" in p && p.isAcknowledgedAndroid === false) : purchases;
        let changed = false;
        for (const purchase of unsynced) changed = (await verify(purchase)) === "ok" || changed;
        if (changed) refresh();
      } catch {
        // sessiz: kullanıcı geri yüklemeyi elle de yapabilir
      }
    })();
    // verify/refresh her çizimde yeni; bir kez çalışması ref ile korunuyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, serverReady]);

  const products: ProductSubscription[] = iap.subscriptions.filter((product) => iapProductDef(product.id) !== null);

  /** Satın alma / yükseltme. Sonuç dinleyiciden gelir (onPurchaseSuccess/Error). */
  const purchase = async (product: ProductSubscription) => {
    if (busySku) return;
    const token = info.data?.accountToken;
    if (!serverReady || !token) {
      showDialog("Şu anda kullanılamıyor", "Mağaza satın alımları şu anda kullanılamıyor. Biraz sonra tekrar dene.");
      return;
    }
    setBusySku(product.id);
    userInitiated.current = true;
    try {
      if (Platform.OS === "ios") {
        await iap.requestPurchase({ type: "subs", request: { apple: { sku: product.id, appAccountToken: token } } });
      } else {
        const android = product.platform === "android" ? product : null;
        const offer = android?.subscriptionOffers.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? null;
        // Etkin bir Mentol aboneliği varsa planı değiştir (yükseltme); yoksa yeni abonelik.
        const owned = (await getAvailablePurchases().catch(() => [] as Purchase[])).find(
          (p) => isMentolPurchase(p) && p.productId !== product.id,
        );
        await iap.requestPurchase({
          type: "subs",
          request: {
            google: {
              skus: [product.id],
              obfuscatedAccountId: token,
              subscriptionOffers: offer ? [{ sku: product.id, offerToken: offer }] : undefined,
              ...(owned?.purchaseToken
                ? {
                    purchaseToken: owned.purchaseToken,
                    subscriptionProductReplacementParams: { oldProductId: owned.productId, replacementMode: "with-time-proration" as const },
                  }
                : {}),
            },
          },
        });
      }
    } catch (error) {
      setBusySku(null);
      userInitiated.current = false;
      const message = purchaseErrorMessage(error as PurchaseError);
      if (message) showDialog("Satın alma", message);
    }
  };

  const restore = async () => {
    if (restoring) return;
    if (!serverReady) {
      showDialog("Şu anda kullanılamıyor", "Mağaza satın alımları şu anda kullanılamıyor. Biraz sonra tekrar dene.");
      return;
    }
    setRestoring(true);
    try {
      await restoreStorePurchases().catch(() => undefined);
      const purchases = (await getAvailablePurchases()).filter(isMentolPurchase);
      if (purchases.length === 0) {
        showDialog("Geri yüklenecek abonelik yok", "Bu mağaza hesabında etkin bir Mentol aboneliği bulunamadı.");
        return;
      }
      const outcomes: VerifyOutcome[] = [];
      for (const p of purchases) outcomes.push(await verify(p));
      refresh();
      if (outcomes.includes("ok")) showDialog("Geri yüklendi", "Mentol aboneliğin hesabına işlendi.");
      else if (outcomes.includes("conflict")) showDialog("Abonelik başka hesapta", "Bu mağaza aboneliği başka bir Ciklet hesabına bağlı.");
      else if (outcomes.includes("unavailable")) showDialog("Sunucuya ulaşılamadı", "Biraz sonra tekrar dene.");
      else showDialog("Geri yüklenemedi", "Abonelik doğrulanamadı. Destekle iletişime geçebilirsin.");
    } catch (error) {
      const message = purchaseErrorMessage(error as PurchaseError);
      showDialog("Geri yüklenemedi", message ?? "Tekrar dene.");
    } finally {
      setRestoring(false);
    }
  };

  /** Mağazanın abonelik yönetim ekranı (iptal, plan değiştirme, ödeme yöntemi). */
  const manage = (productId?: string | null) => {
    void deepLinkToSubscriptions({ skuAndroid: productId ?? info.data?.store?.productId ?? MENTOL_IAP_SKUS[0], packageNameAndroid: ANDROID_PACKAGE }).catch(() =>
      showToast("Abonelik ayarları açılamadı.", "error"),
    );
  };

  return {
    connected,
    serverReady,
    infoLoading: info.isLoading,
    infoError: info.isError,
    store: info.data?.store ?? null,
    products,
    busySku,
    restoring,
    purchase,
    restore,
    manage,
    reloadProducts: () => void fetchProducts({ skus: [...MENTOL_IAP_SKUS], type: "subs" }).catch(() => undefined),
  };
}
