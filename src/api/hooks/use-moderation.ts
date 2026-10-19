import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  MyServerPermissions,
  ServerMemberListItem,
  ServerMembersPage,
  ServerRulesState,
} from "../types";

/**
 * Sunucu izinleri ve moderasyon (web rol izin sistemi, `lib/role-permissions`).
 *
 * İzinler yalnızca ARAYÜZ İPUCU: hangi eylemin gösterileceğine karar verir,
 * her uç yine kendi denetimini yapar. Bit adları web `BotPermissions`
 * anahtarlarıdır (`my-permissions` yanıtındaki `keys`).
 */
export type ServerPermissionKey =
  | "KICK_MEMBERS"
  | "BAN_MEMBERS"
  | "MANAGE_CHANNELS"
  | "MANAGE_MESSAGES"
  | "ADMINISTRATOR"
  | "MANAGE_SERVER"
  | "MANAGE_ROLES"
  | "MODERATE_MEMBERS"
  | "MUTE_MEMBERS"
  | "MOVE_MEMBERS"
  | "VIEW_AUDIT_LOG";

export function useMyPermissions(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.myPermissions(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<MyServerPermissions>(endpoints.myPermissions(serverId!)),
    staleTime: 60_000,
  });
}

/** İzin bitine sahip mi (sahip her şeye). */
export function hasServerPermission(
  actor: MyServerPermissions | undefined,
  key: ServerPermissionKey
): boolean {
  if (!actor) return false;
  return actor.isOwner || actor.keys.includes(key);
}

function tierRank(role: string | null | undefined): number {
  return role === "ADMIN" ? 2 : role === "MODERATOR" ? 1 : 0;
}

/**
 * Bit + hiyerarşi (web `canActOn`): sahip > katman (ADMIN > MODERATOR >
 * üye) > en yüksek rol konumu; ADMIN eşitleri birbirini yönetebilir.
 */
export function canActOnMember(
  actor: MyServerPermissions | undefined,
  target: { isOwner: boolean; role: string | null | undefined; topPosition: number },
  key: ServerPermissionKey
): boolean {
  if (!actor || target.isOwner) return false;
  if (!hasServerPermission(actor, key)) return false;
  if (actor.isOwner) return true;
  const a = tierRank(actor.memberRole);
  const t = tierRank(target.role);
  if (a !== t) return a > t;
  if (a === 2) return true;
  return actor.topPosition > target.topPosition;
}

/** Üyenin en yüksek rol konumu (rolü yoksa 0). */
export function topRolePosition(member: Pick<ServerMemberListItem, "roles">): number {
  return member.roles.reduce((max, role) => Math.max(max, role.position ?? 0), 0);
}

// ── Kural kabulü ────────────────────────────────────────────────────

export function useServerRules(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.serverRules(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerRulesState>(endpoints.serverRules(serverId!)),
    staleTime: 5 * 60_000,
  });
}

export function useAcceptRules(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>(endpoints.serverRulesAccept(serverId), { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData<ServerRulesState>(qk.serverRules(serverId), (state) =>
        state ? { ...state, pending: false, acceptedAt: new Date().toISOString() } : state
      );
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
    },
  });
}

// ── Üye listesi ve eylemler ─────────────────────────────────────────

/** Sayfalı üye listesi (arama destekli) — moderasyon ekranı. */
export function useServerMemberPages(serverId: string | undefined, query: string) {
  return useInfiniteQuery({
    queryKey: qk.memberPages(serverId ?? "yok", query),
    enabled: Boolean(serverId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<ServerMembersPage>(endpoints.serverMembersPage(serverId!, pageParam, query || undefined)),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

/** Zaman aşımı ver (`seconds`) ya da kaldır (`null`). */
export function useTimeoutMember(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, seconds, reason }: { memberId: string; seconds: number | null; reason?: string }) =>
      api<{ ok: true; timedOutUntil: string | null }>(endpoints.memberTimeout(memberId), {
        method: "POST",
        body: { seconds, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

export function useKickMember(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api<unknown>(endpoints.memberKick(memberId, serverId), { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

// ── Zaman aşımı (saf) ───────────────────────────────────────────────

/** web `lib/timeouts` — süre seçenekleri. */
export const TIMEOUT_DURATIONS: { id: string; label: string; seconds: number }[] = [
  { id: "60s", label: "60 saniye", seconds: 60 },
  { id: "5m", label: "5 dakika", seconds: 5 * 60 },
  { id: "10m", label: "10 dakika", seconds: 10 * 60 },
  { id: "1h", label: "1 saat", seconds: 60 * 60 },
  { id: "1d", label: "1 gün", seconds: 24 * 60 * 60 },
  { id: "1w", label: "1 hafta", seconds: 7 * 24 * 60 * 60 },
];

export function isTimedOut(timedOutUntil: string | null | undefined, now: number): boolean {
  if (!timedOutUntil) return false;
  const t = new Date(timedOutUntil).getTime();
  return Number.isFinite(t) && t > now;
}

/** "3 sa 12 dk kaldı" biçiminde kalan süre (web `timeoutRemainingLabel`). */
export function timeoutRemainingLabel(timedOutUntil: string, now: number): string {
  const ms = new Date(timedOutUntil).getTime() - now;
  if (ms <= 0) return "süresi doldu";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} dk kaldı`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa ${mins % 60} dk kaldı`;
  const days = Math.floor(hours / 24);
  return `${days} gün ${hours % 24} sa kaldı`;
}
