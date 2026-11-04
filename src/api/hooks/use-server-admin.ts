import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../query-keys";
import type { MyServerPermissions } from "../types";
import type { ServerRoleDetails } from "./use-roles";

/**
 * Sunucu yönetimi uçları — web Sunucu Ayarları'nın Yasaklar, Roller (oluştur,
 * sil, izinler, üyeler), Emoji/Çıkartma/Soundboard yönetimi, İstatistikler ve
 * Üyeler › Rol sekmelerinin mobil karşılığı. Yetkileri uçlar yeniden denetler.
 */

const enc = encodeURIComponent;
const serverPath = (serverId: string) => `/api/servers/${enc(serverId)}`;

// ── İfade yetkisi (web lib/role-permissions canManageExpression) ──────────

/** İfadeleri Yönet ya da kendi yüklediği + İfade Oluştur. */
export function canEditExpression(
  actor: MyServerPermissions | undefined,
  createdById: string | null | undefined,
  profileId: string | undefined
): boolean {
  if (!actor) return false;
  if (actor.isOwner || actor.keys.includes("MANAGE_EXPRESSIONS")) return true;
  return Boolean(createdById) && createdById === profileId && actor.keys.includes("CREATE_EXPRESSIONS");
}

/** Yükleme: İfade Oluştur ya da İfadeleri Yönet. */
export function canUploadExpression(actor: MyServerPermissions | undefined): boolean {
  if (!actor) return false;
  return actor.isOwner || actor.keys.includes("MANAGE_EXPRESSIONS") || actor.keys.includes("CREATE_EXPRESSIONS");
}

// ── Yasaklar ───────────────────────────────────────────────────────────

export interface ServerBan {
  id: string;
  userId: string;
  reason: string | null;
  expiresAt?: string | null;
  createdAt: string;
  user: { id: string; username: string; name: string | null; imageUrl: string | null } | null;
}

const bansKey = (serverId: string) => ["server-bans", serverId] as const;

export function useServerBans(serverId: string | undefined) {
  return useQuery({
    queryKey: bansKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<ServerBan[]>(`${serverPath(serverId!)}/bans`);
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useUnban(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api<unknown>(`${serverPath(serverId)}/bans/${enc(userId)}`, { method: "DELETE" }),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<ServerBan[]>(bansKey(serverId), (list) => list?.filter((ban) => ban.userId !== userId));
    },
  });
}

/** web lib/server-bans `banExpiryLabel`. */
export function banExpiryLabel(expiresAt: string | null | undefined, now = Date.now()): string {
  if (!expiresAt) return "Kalıcı";
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return "Kalıcı";
  if (t <= now) return "Süresi doldu";
  const hours = Math.ceil((t - now) / 3_600_000);
  if (hours < 24) return `${hours} sa kaldı`;
  return `${Math.ceil(hours / 24)} gün kaldı`;
}

// ── Üyenin taban rolü (sahip) ─────────────────────────────────────────

export function useChangeMemberRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: "GUEST" | "MODERATOR" }) =>
      api<unknown>(`/api/members/${enc(memberId)}?serverId=${enc(serverId)}`, { method: "PATCH", body: { role } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.members(serverId) }),
  });
}

// ── Roller: oluştur, sil, izinler, üyeler ─────────────────────────────

const rolesDetailsKey = (serverId: string) => ["server-roles-details", serverId] as const;

function refreshRoles(queryClient: ReturnType<typeof useQueryClient>, serverId: string) {
  void queryClient.invalidateQueries({ queryKey: rolesDetailsKey(serverId) });
  void queryClient.invalidateQueries({ queryKey: ["server-roles", serverId] });
}

export function useCreateRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string | null }) =>
      api<ServerRoleDetails>(`${serverPath(serverId)}/roles`, { method: "POST", body: input }),
    onSuccess: () => refreshRoles(queryClient, serverId),
  });
}

export function useDeleteRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => api<unknown>(`${serverPath(serverId)}/roles/${enc(roleId)}`, { method: "DELETE" }),
    onSuccess: (_data, roleId) => {
      queryClient.setQueryData<ServerRoleDetails[]>(rolesDetailsKey(serverId), (list) => list?.filter((role) => role.id !== roleId));
      refreshRoles(queryClient, serverId);
      void queryClient.invalidateQueries({ queryKey: qk.members(serverId) });
    },
  });
}

/**
 * İzin bitleri (ondalık dizge). Sunucu aktörde olmayan bitleri düşürebilir;
 * yanıttaki gerçek değer önbelleğe yazılır (web ile aynı).
 */
export function useUpdateRolePermissions(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string }) =>
      api<ServerRoleDetails>(`${serverPath(serverId)}/roles/${enc(roleId)}`, { method: "PATCH", body: { permissions } }),
    onMutate: ({ roleId, permissions }) => {
      const previous = queryClient.getQueryData<ServerRoleDetails[]>(rolesDetailsKey(serverId));
      queryClient.setQueryData<ServerRoleDetails[]>(rolesDetailsKey(serverId), (list) =>
        list?.map((role) => (role.id === roleId ? { ...role, permissions } : role))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(rolesDetailsKey(serverId), context.previous);
    },
    onSuccess: (role, { roleId }) => {
      if (typeof role?.permissions === "string") {
        queryClient.setQueryData<ServerRoleDetails[]>(rolesDetailsKey(serverId), (list) =>
          list?.map((item) => (item.id === roleId ? { ...item, permissions: role.permissions } : item))
        );
      }
      void queryClient.invalidateQueries({ queryKey: qk.myPermissions(serverId) });
    },
  });
}

export function useToggleRoleMember(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, memberId, assigned }: { roleId: string; memberId: string; assigned: boolean }) =>
      api<unknown>(`${serverPath(serverId)}/roles/${enc(roleId)}/members`, { method: "POST", body: { memberId, assigned } }),
    onSuccess: (_data, { roleId, assigned }) => {
      queryClient.setQueryData<ServerRoleDetails[]>(rolesDetailsKey(serverId), (list) =>
        list?.map((role) =>
          role.id === roleId
            ? { ...role, _count: { members: Math.max(0, (role._count?.members ?? 0) + (assigned ? 1 : -1)) } }
            : role
        )
      );
      void queryClient.invalidateQueries({ queryKey: qk.members(serverId) });
    },
  });
}

// ── Emoji: yükle, yeniden adlandır, sil ───────────────────────────────

function refreshEmojis(queryClient: ReturnType<typeof useQueryClient>, serverId: string) {
  void queryClient.invalidateQueries({ queryKey: ["server-emojis-admin", serverId] });
  void queryClient.invalidateQueries({ queryKey: ["server-emojis", serverId] });
}

export function useCreateEmoji(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; imageUrl: string }) =>
      api<unknown>(`${serverPath(serverId)}/emojis`, { method: "POST", body: input }),
    onSuccess: () => refreshEmojis(queryClient, serverId),
  });
}

export function useRenameEmoji(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<unknown>(`${serverPath(serverId)}/emojis/${enc(id)}`, { method: "PATCH", body: { name } }),
    onSuccess: () => refreshEmojis(queryClient, serverId),
  });
}

export function useDeleteEmoji(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`${serverPath(serverId)}/emojis/${enc(id)}`, { method: "DELETE" }),
    onSuccess: () => refreshEmojis(queryClient, serverId),
  });
}

// ── Çıkartmalar ───────────────────────────────────────────────────────

/** web lib/stickers. */
export const STICKER_NAME_MAX = 30;
export const STICKER_DESCRIPTION_MAX = 100;

export interface ServerStickerAdmin {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  createdById: string | null;
}

const stickersAdminKey = (serverId: string) => ["server-stickers-admin", serverId] as const;

function refreshStickers(queryClient: ReturnType<typeof useQueryClient>, serverId: string) {
  void queryClient.invalidateQueries({ queryKey: stickersAdminKey(serverId) });
  void queryClient.invalidateQueries({ queryKey: ["server-stickers", serverId] });
}

export function useServerStickersAdmin(serverId: string | undefined) {
  return useQuery({
    queryKey: stickersAdminKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<unknown>(`${serverPath(serverId!)}/stickers`);
      if (!Array.isArray(data)) return [] as ServerStickerAdmin[];
      return data.flatMap((raw): ServerStickerAdmin[] => {
        const r = raw as Partial<ServerStickerAdmin> | null;
        if (!r || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.imageUrl !== "string") return [];
        return [
          {
            id: r.id,
            name: r.name,
            imageUrl: r.imageUrl,
            description: typeof r.description === "string" ? r.description : null,
            createdById: typeof r.createdById === "string" ? r.createdById : null,
          },
        ];
      });
    },
  });
}

export function useCreateSticker(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; imageUrl: string }) =>
      api<unknown>(`${serverPath(serverId)}/stickers`, { method: "POST", body: input }),
    onSuccess: () => refreshStickers(queryClient, serverId),
  });
}

export function useUpdateSticker(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string }) =>
      api<unknown>(`${serverPath(serverId)}/stickers/${enc(id)}`, { method: "PATCH", body: { name, description } }),
    onSuccess: () => refreshStickers(queryClient, serverId),
  });
}

export function useDeleteSticker(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`${serverPath(serverId)}/stickers/${enc(id)}`, { method: "DELETE" }),
    onSuccess: () => refreshStickers(queryClient, serverId),
  });
}

// ── Soundboard ────────────────────────────────────────────────────────

/** web lib/soundboard. */
export const SOUND_NAME_MAX = 32;
export const SOUND_MAX_SECONDS = 5.5;

export interface ServerSoundAdmin {
  id: string;
  name: string;
  emoji: string | null;
  audioUrl: string;
  volume: number;
  createdById: string | null;
}

const soundsAdminKey = (serverId: string) => ["server-sounds-admin", serverId] as const;

function refreshSounds(queryClient: ReturnType<typeof useQueryClient>, serverId: string) {
  void queryClient.invalidateQueries({ queryKey: soundsAdminKey(serverId) });
  void queryClient.invalidateQueries({ queryKey: qk.serverSounds(serverId) });
}

export function useServerSoundsAdmin(serverId: string | undefined) {
  return useQuery({
    queryKey: soundsAdminKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      // Varsayılan sesler olmadan: yalnızca sunucunun kendi sesleri (web sekmesi gibi).
      const data = await api<unknown>(`${serverPath(serverId!)}/sounds`);
      if (!Array.isArray(data)) return [] as ServerSoundAdmin[];
      return data.flatMap((raw): ServerSoundAdmin[] => {
        const r = raw as Partial<ServerSoundAdmin> & { isDefault?: boolean } | null;
        if (!r || r.isDefault || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.audioUrl !== "string") return [];
        return [
          {
            id: r.id,
            name: r.name,
            audioUrl: r.audioUrl,
            emoji: typeof r.emoji === "string" ? r.emoji : null,
            volume: typeof r.volume === "number" ? r.volume : 100,
            createdById: typeof r.createdById === "string" ? r.createdById : null,
          },
        ];
      });
    },
  });
}

export function useCreateSound(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; audioUrl: string }) =>
      api<unknown>(`${serverPath(serverId)}/sounds`, { method: "POST", body: input }),
    onSuccess: () => refreshSounds(queryClient, serverId),
  });
}

export function useUpdateSound(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; volume?: number }) =>
      api<unknown>(`${serverPath(serverId)}/sounds/${enc(id)}`, { method: "PATCH", body }),
    onMutate: ({ id, volume, name }) => {
      queryClient.setQueryData<ServerSoundAdmin[]>(soundsAdminKey(serverId), (list) =>
        list?.map((sound) =>
          sound.id === id ? { ...sound, ...(volume !== undefined ? { volume } : {}), ...(name !== undefined ? { name } : {}) } : sound
        )
      );
    },
    onSettled: () => refreshSounds(queryClient, serverId),
  });
}

export function useDeleteSound(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`${serverPath(serverId)}/sounds/${enc(id)}`, { method: "DELETE" }),
    onSuccess: () => refreshSounds(queryClient, serverId),
  });
}

// ── İstatistikler ─────────────────────────────────────────────────────

export interface DayPoint {
  day: string;
  value: number;
}

/** web lib/server-insights `ServerInsights`. */
export interface ServerInsights {
  generatedAt: string;
  days: number;
  memberCount: number;
  joins: DayPoint[];
  leaves: DayPoint[];
  messages: DayPoint[];
  activeAuthors: DayPoint[];
  totals: { joins: number; leaves: number; messages: number; activeAuthors7d: number };
  topChannels: { channelId: string; name: string; count: number }[];
}

export function useServerInsights(serverId: string | undefined) {
  return useQuery({
    queryKey: ["server-insights", serverId ?? "yok"],
    enabled: Boolean(serverId),
    queryFn: () => api<ServerInsights>(`${serverPath(serverId!)}/insights`),
    staleTime: 5 * 60_000,
  });
}
