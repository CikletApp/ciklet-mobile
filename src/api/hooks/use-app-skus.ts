import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import { openPaymentPage } from "./use-store";

/**
 * Uygulama ürünleri (Discord SKU / entitlement; web lib/app-monetization).
 *
 * Satın alma UYGULAMA İÇİNDE YAPILMAZ (mağaza kuralları, bkz. use-store):
 * ödeme kaydı API'de açılır, ödeme sayfası sistem tarayıcısında açılır.
 * Tarayıcı kapanınca hak listeleri yeniden çekilir.
 */

/** Discord SKU + Ciklet fiyatı (kuruş). */
export interface AppSku {
  id: string;
  type: number;
  application_id: string;
  name: string;
  slug: string;
  flags: number;
  description: string | null;
  image_url: string | null;
  price: { amount: number; currency: string };
}

/** Discord entitlement. */
export interface AppEntitlement {
  id: string;
  sku_id: string;
  application_id: string;
  user_id: string | null;
  guild_id?: string;
  type: number;
  deleted: boolean;
  consumed: boolean;
  starts_at: string | null;
  ends_at: string | null;
  promotion_id: null;
}

/** ciklet-web `GET /api/app-skus/[skuId]` (SkuOffer). */
export interface AppSkuOffer {
  sku: AppSku;
  application: { id: string; clientId: string; name: string; imageUrl: string | null };
  purchasesEnabled: boolean;
  blocker: string | null;
  guildRequired: boolean;
  eligibleGuilds: { id: string; name: string; imageUrl: string | null }[];
  entitlements: AppEntitlement[];
}

/** ciklet-web `GET /api/app-skus/mine`. */
export interface AppPurchase {
  id: string;
  type: number;
  consumed: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  active: boolean;
  sku: { id: string; name: string; type: number; imageUrl: string | null; subscriptionTarget: string | null };
  application: { id: string; name: string; imageUrl: string | null };
  server: { id: string; name: string } | null;
}

export const SkuType = { DURABLE: 2, CONSUMABLE: 3, SUBSCRIPTION: 5, SUBSCRIPTION_GROUP: 6 } as const;
export const EntitlementType = { PURCHASE: 1, TEST_MODE_PURCHASE: 4, APPLICATION_SUBSCRIPTION: 8 } as const;

/** Kuruş → "49,90 ₺" (web formatKurus ile aynı). */
export function formatKurus(amountMinor: number, currency = "TRY"): string {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function useAppSkuOffer(skuId: string | null | undefined, guildId?: string | null) {
  return useQuery({
    queryKey: [...qk.appSku(skuId ?? "yok"), guildId ?? null],
    enabled: Boolean(skuId),
    queryFn: () => api<AppSkuOffer>(`${endpoints.appSku(skuId!)}${guildId ? `?guildId=${encodeURIComponent(guildId)}` : ""}`),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAppPurchases() {
  return useQuery({
    queryKey: qk.appPurchases,
    queryFn: () => api<AppPurchase[]>(endpoints.appPurchases),
  });
}

/** Ödeme kaydını aç (tutar sunucuda) → web ödeme sayfası sistem tarayıcısında. */
export function useAppSkuCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { skuId: string; guildId?: string | null }) => {
      const { paymentId } = await api<{ paymentId: string }>(endpoints.appSkuCheckout(input.skuId), {
        method: "POST",
        body: input.guildId ? { guildId: input.guildId } : {},
      });
      await openPaymentPage(paymentId);
      return paymentId;
    },
    onSettled: (_d, _e, input) => {
      void queryClient.invalidateQueries({ queryKey: qk.appSku(input.skuId) });
      void queryClient.invalidateQueries({ queryKey: qk.appPurchases });
    },
  });
}
