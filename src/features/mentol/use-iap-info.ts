import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { MentolStoreSubscription } from "@/api/hooks/use-settings";
import { applyServerCatalog } from "./iap-products";

/**
 * GET /api/mentol/iap — Mentol ve Sunucu Takviyesi mağaza satın almalarının
 * ortak bilgisi: hangi mağaza sunucuda açık, ürün kimlikleri (katalog),
 * satın almaya iliştirilecek hesap belirteci ve etkin Mentol mağaza aboneliği.
 *
 * `accountToken`: sunucunun profil kimliğinden türettiği UUID. Apple
 * `appAccountToken` ve Google `obfuscatedAccountId` olarak satın almaya
 * iliştirilir; sunucu doğrulamada belirteci olmayan ya da başka hesaba ait
 * işlemi reddeder (409), yani belirteçsiz satın alma BAŞLATILMAZ.
 */
export interface IapInfo {
  apple: boolean;
  google: boolean;
  accountToken: string;
  store: MentolStoreSubscription | null;
  products?: unknown;
  boostProducts?: unknown;
}

export const IAP_INFO_KEY = ["mentol-iap"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Apple `appAccountToken` UUID olmak ZORUNDA; değilse satın alma başlatılmaz. */
export function validAccountToken(token: string | null | undefined): token is string {
  return typeof token === "string" && UUID_RE.test(token);
}

export function useIapInfo(enabled = true) {
  return useQuery({
    queryKey: IAP_INFO_KEY,
    queryFn: async () => {
      const info = await api<IapInfo>(endpoints.mentolIap);
      applyServerCatalog(info);
      return info;
    },
    staleTime: 60 * 1000,
    enabled,
  });
}
