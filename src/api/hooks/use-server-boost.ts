import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PremiumTier, ServerPerks } from "@/lib/server-boost";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sunucu Takviyesi (web `hooks/use-server-boost` + `/api/boosts` uçları).
 *
 *  - `useServerBoost`: sunucunun seviyesi, ilerlemesi, ayrıcalıkları ve
 *    takviye edenler (yalnızca üyeler). Kanal Ayarları (bit hızı), takviye
 *    ekranı ve sunucu kartındaki ilerleme çubuğu aynı yanıtı okur.
 *  - `useMyBoosts`: "Takviyelerim" — kullanıcının slotları.
 *
 * Her işlemden (uygula / aktar / iptal / mağaza satın alması) sonra iki
 * önbellek de tazelenir; sunucu ayrıntısı (premiumTier) ve üye listesi
 * (takviyeci taşı) de seviye değişebildiği için geçersizlenir.
 */

export type BoostSource = "MENTOL" | "PURCHASE" | "STORE";

export interface BoostSlot {
  id: string;
  source: BoostSource;
  server: { id: string; name: string; imageUrl: string | null } | null;
  startedAt: string;
  appliedAt: string | null;
  cooldownUntil: string | null;
  expiresAt: string | null;
  canceledAt: string | null;
  /** Bekleme bitti mi (uygulanabilir / aktarılabilir). */
  available: boolean;
}

export interface MyBoosts {
  slots: BoostSlot[];
  plan: "FREE" | "PLUS" | "PRO";
  includedBoosts: number;
  /** Ek takviye indirimi (0–1); yalnızca web fiyatı için. */
  discount: number;
  mentolDiscountPercent: number;
  /** Web/PayTR fiyatı — mobilde gösterilmez (mağaza fiyatı geçerli). */
  pricing: {
    currency: string;
    monthly: number;
    yearly: number;
    unitMonthly: number;
    unitYearly: number;
    purchasable: boolean;
    maxQuantity: number;
  };
  boosterSince: string | null;
  boosterTenureMonths: number | null;
  cooldownDays: number;
  graceDays: number;
}

export interface ServerBoostView {
  serverId: string;
  tier: PremiumTier;
  count: number;
  graceUntil: string | null;
  progressBarEnabled: boolean;
  progress: { tier: PremiumTier; next: PremiumTier | null; needed: number; ratio: number };
  perks: ServerPerks;
  boosters: { profile: { id: string; username: string; name: string | null; imageUrl: string | null }; since: string; count: number }[];
  /** Oturum sahibinin bu sunucudaki ve boştaki (uygulanabilir) takviyeleri. */
  me: { here: number; available: number };
}

export function useServerBoost(serverId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.serverBoost(serverId ?? "yok"),
    enabled: Boolean(serverId) && enabled,
    queryFn: () => api<ServerBoostView>(endpoints.serverBoosts(serverId!)),
    staleTime: 60_000,
  });
}

export function useMyBoosts() {
  return useQuery({
    queryKey: qk.myBoosts,
    queryFn: () => api<MyBoosts>(endpoints.boosts),
    staleTime: 30_000,
  });
}

/** Takviye işleminden sonra etkilenen önbellekler. */
export function useInvalidateBoosts() {
  const queryClient = useQueryClient();
  return (serverIds: (string | null | undefined)[] = []) => {
    void queryClient.invalidateQueries({ queryKey: qk.myBoosts });
    void queryClient.invalidateQueries({ queryKey: ["server-boost"] });
    for (const id of serverIds) {
      if (!id) continue;
      void queryClient.invalidateQueries({ queryKey: qk.server(id) });
      void queryClient.invalidateQueries({ queryKey: qk.members(id) });
    }
  };
}

export function useApplyBoost() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateBoosts();
  return useMutation({
    mutationFn: (input: { serverId: string; quantity?: number; boostIds?: string[] }) =>
      api<{ applied: string[]; server: ServerBoostView }>(endpoints.boostsApply, { method: "POST", body: input }),
    onSuccess: (result, input) => {
      queryClient.setQueryData(qk.serverBoost(input.serverId), result.server);
      invalidate([input.serverId]);
    },
  });
}

export function useTransferBoost() {
  const invalidate = useInvalidateBoosts();
  return useMutation({
    mutationFn: ({ boostId, serverId }: { boostId: string; serverId: string }) =>
      api<{ ok: true; from: string | null; to: string }>(endpoints.boostTransfer(boostId), { method: "POST", body: { serverId } }),
    onSuccess: (result) => invalidate([result.from, result.to]),
  });
}

export function useCancelBoost() {
  const invalidate = useInvalidateBoosts();
  return useMutation({
    mutationFn: ({ boostId, canceled }: { boostId: string; canceled: boolean }) =>
      api<{ canceledAt: string | null }>(endpoints.boost(boostId), { method: "PATCH", body: { canceled } }),
    onSuccess: () => invalidate(),
  });
}
