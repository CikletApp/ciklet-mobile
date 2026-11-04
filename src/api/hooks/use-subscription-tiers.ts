import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../query-keys";

/**
 * Sunucu Ayarları › Abonelikler yönetimi (web `server-settings/subscriptions-tab.tsx`):
 * kademe ekle, satışa aç/kapat, sil, gelir özeti (yalnızca sahip).
 * Uçlar: `/api/servers/:id/subscription-tiers` (POST), `/:tierId` (PATCH/DELETE),
 * `/revenue` (GET).
 */

/** Web `lib/server-subscriptions.ts` sınırları. */
export const TIER_NAME_MAX = 50;
export const TIER_DESCRIPTION_MAX = 500;
export const TIER_PRICE_MIN = 10;
export const TIER_PRICE_MAX = 2000;

export interface TierRevenue {
  feePercent: number;
  activeSubscribers: number;
  total: { grossMinor: number; feeMinor: number; netMinor: number; count: number };
  last30Days: { grossMinor: number; feeMinor: number; netMinor: number; count: number };
}

const tiersPath = (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/subscription-tiers`;

export function useTierRevenue(serverId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["server-tier-revenue", serverId ?? "yok"],
    enabled: Boolean(serverId) && enabled,
    // Sahip değilse 403 — kartlar gizlenir (web `.catch(() => null)`).
    queryFn: () => api<TierRevenue>(`${tiersPath(serverId!)}/revenue`).catch(() => null),
  });
}

function useRefresh(serverId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.serverTiers(serverId) });
    void queryClient.invalidateQueries({ queryKey: ["server-tier-revenue", serverId] });
  };
}

export function useCreateTier(serverId: string) {
  const refresh = useRefresh(serverId);
  return useMutation({
    mutationFn: (input: { name: string; price: number; description: string; roleId: string }) =>
      api(tiersPath(serverId), { method: "POST", body: input }),
    onSuccess: refresh,
  });
}

export function usePatchTier(serverId: string) {
  const refresh = useRefresh(serverId);
  return useMutation({
    mutationFn: ({ tierId, active }: { tierId: string; active: boolean }) =>
      api(`${tiersPath(serverId)}/${encodeURIComponent(tierId)}`, { method: "PATCH", body: { active } }),
    onSuccess: refresh,
  });
}

export function useDeleteTier(serverId: string) {
  const refresh = useRefresh(serverId);
  return useMutation({
    mutationFn: (tierId: string) => api(`${tiersPath(serverId)}/${encodeURIComponent(tierId)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}
