import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  AuditLogActor,
  AuditLogEntry,
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
  | "MANAGE_THREADS"
  | "ADMINISTRATOR"
  | "MANAGE_SERVER"
  | "MANAGE_ROLES"
  | "MODERATE_MEMBERS"
  | "MUTE_MEMBERS"
  | "MOVE_MEMBERS"
  | "VIEW_AUDIT_LOG"
  | "MANAGE_WEBHOOKS"
  | "MANAGE_EXPRESSIONS"
  | "CREATE_EXPRESSIONS"
  | "SEND_MESSAGES";

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

/**
 * `@` önerileri için sunucu tarafı üye araması (ilk sayfa). Boş sorgu ilk
 * sayfayı döndürür; yeni sorgu gelene kadar önceki sonuç ekranda kalır.
 */
export function useMemberSearch(serverId: string | undefined, query: string) {
  return useQuery({
    queryKey: ["members", serverId ?? "yok", "search", query] as const,
    enabled: Boolean(serverId),
    queryFn: () => api<ServerMembersPage>(endpoints.serverMembersPage(serverId!, null, query || undefined)),
    select: (page) => page.items,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
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

// ── Yasaklama ve temizleme ──────────────────────────────────────────

/** web `lib/server-bans` — yasak süresi seçenekleri. */
export const BAN_DURATIONS: { id: string; label: string; seconds: number | null }[] = [
  { id: "1h", label: "1 saat", seconds: 60 * 60 },
  { id: "1d", label: "1 gün", seconds: 24 * 60 * 60 },
  { id: "7d", label: "1 hafta", seconds: 7 * 24 * 60 * 60 },
  { id: "30d", label: "30 gün", seconds: 30 * 24 * 60 * 60 },
  { id: "forever", label: "Kalıcı", seconds: null },
];

/** web `lib/server-bans` — yasaklarken mesaj geçmişini silme seçenekleri. */
export const BAN_PURGE_OPTIONS: { id: string; label: string; hours: number }[] = [
  { id: "none", label: "Silme", hours: 0 },
  { id: "1h", label: "Son 1 saat", hours: 1 },
  { id: "24h", label: "Son 24 saat", hours: 24 },
  { id: "7d", label: "Son 7 gün", hours: 24 * 7 },
];

/** Yasak sebebinin tavanı (web `BAN_REASON_MAX`). */
export const BAN_REASON_MAX = 500;
/** Denetim kaydı sebebinin tavanı (web `AUDIT_REASON_MAX`). */
export const AUDIT_REASON_MAX = 512;
/** Tek istekte toplu yasaklanabilecek en çok üye (web ile aynı). */
export const BULK_BAN_MAX = 200;
/** Üye temizleme süreleri (gün). */
export const PRUNE_DAY_OPTIONS = [7, 30] as const;
export type PruneDays = (typeof PRUNE_DAY_OPTIONS)[number];

export interface BanInput {
  reason?: string;
  durationSeconds: number | null;
  purgeHours: number;
}

function banBody(input: BanInput) {
  return {
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
    durationSeconds: input.durationSeconds,
    purgeHours: input.purgeHours,
  };
}

/** Tek üyeyi yasakla (`POST /bans`). */
export function useBanMember(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: BanInput & { userId: string }) =>
      api<{ success: true; expiresAt: string | null; purged: number }>(endpoints.serverBans(serverId), {
        method: "POST",
        body: { userId, ...banBody(input) },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

/** Toplu yasak (`POST /bans/bulk`): yetkinin/hiyerarşinin yetmediği kişiler `failed`. */
export function useBulkBan(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, ...input }: BanInput & { userIds: string[] }) =>
      api<{ banned: string[]; failed: string[] }>(endpoints.serverBansBulk(serverId), {
        method: "POST",
        body: { userIds, ...banBody(input) },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

/** Temizlemede çıkarılacak üye sayısı (önizleme). */
export function usePrunePreview(serverId: string, days: PruneDays, enabled: boolean) {
  return useQuery({
    queryKey: qk.prunePreview(serverId, days),
    enabled,
    queryFn: () => api<{ days: number; count: number }>(endpoints.serverPrune(serverId, days)),
    staleTime: 0,
  });
}

/** Rolsüz ve `days` gündür görülmeyen üyeleri çıkar. */
export function usePruneMembers(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ days, reason }: { days: PruneDays; reason?: string }) =>
      api<{ pruned: number }>(endpoints.serverPrune(serverId), {
        method: "POST",
        body: { days, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

// ── Denetim kaydı ───────────────────────────────────────────────────

/** Sayfa boyu; dolu sayfa "devamı var" demek (web ile aynı). */
export const AUDIT_LOG_PAGE_SIZE = 50;

export function useAuditLogs(serverId: string | undefined, action: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: qk.auditLogs(serverId ?? "yok", action, userId),
    enabled: Boolean(serverId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<AuditLogEntry[]>(
        endpoints.serverAuditLogs(serverId!, { action, userId, before: pageParam, limit: AUDIT_LOG_PAGE_SIZE })
      ),
    getNextPageParam: (last) =>
      last.length >= AUDIT_LOG_PAGE_SIZE ? (last[last.length - 1]?.id ?? undefined) : undefined,
    staleTime: 30_000,
  });
}

export function useAuditLogActors(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.auditLogActors(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<AuditLogActor[]>(endpoints.serverAuditLogActors(serverId!)),
    staleTime: 60_000,
  });
}

// ── Toplu mesaj silme ───────────────────────────────────────────────

/** Toplu silmenin sınırları (web ile aynı; Discord kuralı). */
export const BULK_DELETE_MAX = 100;
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Seçilen kanal mesajlarını sil. Tek mesaj tekil silme ucuna gider (sebep
 * yok); iki ve fazlası toplu uca. Silinen mesajlar canlı akıştan mezar taşı
 * olarak gelir, önbelleğe burada dokunulmaz.
 */
export function useBulkDeleteMessages(channelId: string, serverId: string) {
  return useMutation({
    mutationFn: async ({ messageIds, reason }: { messageIds: string[]; reason?: string }) => {
      if (messageIds.length === 1) {
        await api(endpoints.editChannelMessage(messageIds[0], channelId, serverId), { method: "DELETE" });
        return { deleted: messageIds };
      }
      return api<{ deleted: string[] }>(endpoints.bulkDeleteMessages(channelId), {
        method: "POST",
        body: { messageIds, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      });
    },
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
