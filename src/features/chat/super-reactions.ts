import { useQuery, type QueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";

/**
 * Süper tepki haftalık hakkı (web: hooks/use-super-reactions.ts).
 *
 * Mentol Plus haftada 25, Mentol Pro sınırsız (`remaining: null`), ücretsiz
 * plan gönderemez ama görür. Hak sunucuda atomik düşülür; burası yalnızca
 * seçicideki "Bu hafta N kaldı" yazısı için.
 */
export interface SuperReactionQuota {
  plan: "FREE" | "PLUS" | "PRO";
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
}

export const SUPER_REACTION_QUERY_KEY = ["super-reactions"] as const;

export function useSuperReactionQuota(enabled = true) {
  return useQuery({
    queryKey: SUPER_REACTION_QUERY_KEY,
    queryFn: () => api<SuperReactionQuota>(endpoints.superReactions),
    staleTime: 60 * 1000,
    enabled,
  });
}

export function setSuperReactionQuota(queryClient: QueryClient, quota: SuperReactionQuota) {
  queryClient.setQueryData(SUPER_REACTION_QUERY_KEY, quota);
}

/** Kalan hak var mı: null kalan = sınırsız. */
export function canSendSuperReaction(quota: SuperReactionQuota | null | undefined): boolean {
  if (!quota || quota.plan === "FREE") return false;
  return quota.remaining === null || quota.remaining > 0;
}

/** "Bu hafta 23 kaldı" / "Sınırsız" / "Bu haftalık hakkın bitti" (web ile aynı). */
export function superReactionQuotaLabel(quota: SuperReactionQuota | null | undefined): string {
  if (!quota) return "";
  if (quota.remaining === null) return "Sınırsız";
  if (quota.remaining <= 0) return "Bu haftalık hakkın bitti";
  return `Bu hafta ${quota.remaining} kaldı`;
}

export const SUPER_REACTION_PLAN_TEXT = "Süper tepkiler Mentol'e özel.";
export const SUPER_REACTION_QUOTA_TEXT = "Bu haftalık süper tepki hakkın bitti.";
