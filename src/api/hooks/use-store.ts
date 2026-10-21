import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";

import { API_BASE_URL } from "@/lib/config";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { CheckoutResponse, ServerTiersResponse, StoreCatalogResponse } from "../types";

/**
 * Para yüzeyleri — Mağaza, Mentol hediyesi, sunucu abonelikleri.
 *
 * ÖDEME UYGULAMA İÇİNDE YAPILMAZ. Dijital ürün satışı App Store / Play
 * kurallarına göre mağazanın kendi ödeme sistemini (IAP / Play Billing)
 * gerektiriyor; PayTR iframe'ini uygulamaya gömmek inceleme reddi demek.
 * Bu yüzden ödeme kaydı API'de açılır ve web ödeme sayfası
 * (`/mentol/odeme/[id]`) sistem tarayıcısında açılır. Katalog, önizleme ve
 * sahip olunan ürünü takma tamamen uygulama içinde.
 */

export function useStoreCatalog() {
  return useQuery({
    queryKey: qk.store,
    queryFn: () => api<StoreCatalogResponse>(endpoints.store),
    staleTime: 60_000,
  });
}

/**
 * Ücretsiz mağaza modunda ürünü alır (`free: true` katalog). Para yok, ödeme
 * sayfası yok: hak sunucuda doğrudan yazılır, katalog tazelenir.
 */
export function useClaimStoreItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: true; owned: true; itemId: string; alreadyOwned: boolean }>(endpoints.storeClaim, { method: "POST", body: { itemId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.store });
    },
  });
}

export function useServerTiers(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.serverTiers(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerTiersResponse>(endpoints.serverTiers(serverId!)),
    staleTime: 60_000,
  });
}

/**
 * Ödeme sayfasını sistem tarayıcısında açar; dönüşte ilgili listeler tazelenir.
 *
 * Tarayıcıda Ciklet oturumu yok: önce bu ödemeye özel, süreli bir yol
 * alınır (`/odeme/[id]?t=`, web lib/payment-link) — uygulama ağacının
 * dışında, telefon kapısı olmayan sayfa.
 */
export async function openPaymentPage(paymentId: string) {
  const { path } = await api<{ path: string }>(endpoints.paymentLink(paymentId), { method: "POST" });
  await WebBrowser.openBrowserAsync(`${API_BASE_URL}${path}`);
}

export type CheckoutRequest =
  | { kind: "store"; itemId: string; giftTo?: string }
  | { kind: "mentol"; plan: "PLUS" | "PRO"; period: "monthly" | "yearly"; giftTo?: string }
  | { kind: "tier"; serverId: string; tierId: string };

/**
 * Ödeme kaydını açar (fiyat, alıcı ve sahiplik denetimi sunucuda) ve web
 * ödeme sayfasına yönlendirir. Tarayıcı kapanınca Mentol planı, mağaza ve
 * kademe listeleri yeniden çekilir — ödeme tamamlandıysa sonuç görünür.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CheckoutRequest) => {
      const path =
        request.kind === "store"
          ? endpoints.storeCheckout
          : request.kind === "mentol"
            ? endpoints.mentolCheckout
            : endpoints.serverTierCheckout(request.serverId, request.tierId);
      const body =
        request.kind === "store"
          ? { itemId: request.itemId, giftTo: request.giftTo || undefined }
          : request.kind === "mentol"
            ? { plan: request.plan, period: request.period, giftTo: request.giftTo || undefined }
            : {};
      const { paymentId } = await api<CheckoutResponse>(path, { method: "POST", body });
      await openPaymentPage(paymentId);
      return request;
    },
    onSettled: (request) => {
      void queryClient.invalidateQueries({ queryKey: ["mentol-plan"] });
      void queryClient.invalidateQueries({ queryKey: qk.store });
      if (request?.kind === "tier") {
        void queryClient.invalidateQueries({ queryKey: qk.serverTiers(request.serverId) });
      }
    },
  });
}
