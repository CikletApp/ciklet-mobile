import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../query-keys";
import type { ForumPost } from "../types";
import type { LayoutCategory } from "@/lib/channel-layout";
import type { ForumLayout, ForumSort, ForumTag } from "@/lib/forum";

/**
 * Kanal yönetimi — web Kanal Ayarları (Genel Görünüm, İzinler), kategoriler,
 * duyuru kanalı (Yayınla / Takip et) ve forumun yapılandırılmış alanları.
 *
 * Uçlar ciklet-web'de:
 *  - `GET/POST /api/servers/:id/categories`, `PATCH/DELETE …/categories/:categoryId`
 *  - `GET/PUT/PATCH /api/channels/:id/permissions`
 *  - `GET/PUT /api/servers/:id/categories/:categoryId/permissions`
 *  - `PATCH /api/channels/:id?serverId=` (Genel Görünüm alanları)
 *  - `POST /api/channels/:id/messages/:messageId/crosspost`
 *  - `GET /api/channels/follow-targets`, `POST /api/channels/:id/followers`
 *  - `GET/PATCH /api/channels/:id/forum`
 *
 * Önbellek anahtarları `["channels", serverId, …]` altında: kanal yerleşimi
 * değişince (`server.channels_updated`) kanal listesiyle birlikte tazelenir.
 */

const enc = encodeURIComponent;

const categoriesKey = (serverId: string) => ["channels", serverId, "categories"] as const;

// ── Kategoriler ──────────────────────────────────────────────────────

export function useServerCategories(serverId: string | undefined) {
  return useQuery({
    queryKey: categoriesKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<{ items?: LayoutCategory[] } | LayoutCategory[]>(`/api/servers/${enc(serverId!)}/categories`);
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    staleTime: 30_000,
  });
}

export function useCategoryMutations(serverId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) });
  const create = useMutation({
    mutationFn: (name: string) =>
      api<LayoutCategory>(`/api/servers/${enc(serverId)}/categories`, { method: "POST", body: { name } }),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      api<LayoutCategory>(`/api/servers/${enc(serverId)}/categories/${enc(categoryId)}`, { method: "PATCH", body: { name } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (categoryId: string) =>
      api(`/api/servers/${enc(serverId)}/categories/${enc(categoryId)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { create, rename, remove };
}

// ── Kanal Genel Görünüm ──────────────────────────────────────────────

/** Yalnızca değişen alanlar gönderilir (web overview-tab ile aynı). */
export type ChannelPatch = Partial<{
  name: string;
  type: string;
  topic: string | null;
  slowModeSeconds: number;
  nsfw: boolean;
  mediaOnly: boolean;
  stage: boolean;
  announcement: boolean;
  forum: boolean;
  voiceStatus: string | null;
  userLimit: number;
  bitrate: number;
  videoQualityMode: string;
  categoryId: string | null;
  permissionMode: "sync" | "keep";
  availableTags: { id?: string; name: string; emoji: string | null; moderated: boolean }[];
  forumRequireTag: boolean;
  forumDefaultReaction: string | null;
  forumDefaultSort: ForumSort;
  forumDefaultLayout: ForumLayout;
}>;

export function usePatchChannel(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChannelPatch) =>
      api(`/api/channels/${enc(channelId)}?serverId=${enc(serverId)}`, { method: "PATCH", body: patch }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

export function useCreateChannelIn(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: string; categoryId?: string | null }) =>
      api<{ id?: string }>(`/api/channels?serverId=${enc(serverId)}`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

// ── İzin üzerine yazmaları ───────────────────────────────────────────

export interface OverwriteWire {
  roleId: string | null;
  profileId: string | null;
  allow: string;
  deny: string;
}

export interface OverwriteProfile {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

export interface PermissionsResponse {
  overwrites: OverwriteWire[];
  profiles: OverwriteProfile[];
  /** Kanal: kategoriyle eşitli mi. */
  synced?: boolean;
  category?: { id: string; name: string } | null;
  /** Kategori: içindeki kanallar ve eşitlik durumları. */
  channels?: { id: string; name: string; type: string; permissionsSynced: boolean }[];
  /** Kanal: isteyenin etkin erişimi. */
  viewer?: { canView?: boolean; canManagePermissions?: boolean };
  /** Kategori: düzenleyebilir mi. */
  canManage?: boolean;
}

export type PermissionsTarget =
  | { kind: "channel"; channelId: string }
  | { kind: "category"; categoryId: string };

export function permissionsPath(serverId: string, target: PermissionsTarget) {
  return target.kind === "channel"
    ? `/api/channels/${enc(target.channelId)}/permissions`
    : `/api/servers/${enc(serverId)}/categories/${enc(target.categoryId)}/permissions`;
}

const permissionsKey = (serverId: string, target: PermissionsTarget) =>
  ["channels", serverId, "permissions", target.kind, target.kind === "channel" ? target.channelId : target.categoryId] as const;

export function useOverwrites(serverId: string, target: PermissionsTarget) {
  return useQuery({
    queryKey: permissionsKey(serverId, target),
    queryFn: () => api<PermissionsResponse>(permissionsPath(serverId, target)),
    staleTime: 0,
  });
}

export function useSaveOverwrites(serverId: string, target: PermissionsTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { overwrites: OverwriteWire[]; syncChannelIds?: string[] } | { synced: true }) =>
      api<PermissionsResponse>(permissionsPath(serverId, target), {
        method: "synced" in input ? "PATCH" : "PUT",
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(permissionsKey(serverId, target), (prev: PermissionsResponse | undefined) => ({ ...prev, ...data }));
      void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) });
    },
  });
}

/** Üzerine yazma için üye arama (`/api/members?serverId=&q=&limit=`). */
export function useMemberLookup(serverId: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["member-lookup", serverId, query],
    enabled,
    queryFn: async () => {
      const q = query.trim().slice(0, 64);
      const data = await api<{ items?: { profileId: string; nickname: string | null; profile: OverwriteProfile }[] }>(
        `/api/members?serverId=${enc(serverId)}&limit=20${q ? `&q=${enc(q)}` : ""}`
      );
      return (data?.items ?? []).map((m) => ({
        id: m.profileId,
        username: m.profile.username,
        name: m.nickname ?? m.profile.name,
        imageUrl: m.profile.imageUrl,
      }));
    },
    staleTime: 15_000,
  });
}

// ── Duyuru kanalı ────────────────────────────────────────────────────

export function publishMessage(channelId: string, messageId: string) {
  return api<{ delivered: number; followers: number }>(
    `/api/channels/${enc(channelId)}/messages/${enc(messageId)}/crosspost`,
    { method: "POST" }
  );
}

export interface FollowTarget {
  id: string;
  name: string;
  imageUrl: string | null;
  channels: { id: string; name: string }[];
}

export function useFollowTargets(enabled: boolean) {
  return useQuery({
    queryKey: ["follow-targets"],
    enabled,
    queryFn: () => api<FollowTarget[]>("/api/channels/follow-targets"),
    staleTime: 0,
  });
}

export function useFollowChannel(channelId: string) {
  return useMutation({
    mutationFn: (targetChannelId: string) =>
      api(`/api/channels/${enc(channelId)}/followers`, { method: "POST", body: { targetChannelId } }),
  });
}

// ── Forum (yapılandırılmış alanlar) ──────────────────────────────────

export interface ForumFeedPost extends ForumPost {
  appliedTagIds?: string[];
  /** Varsayılan tepki (forum ayarı açıksa); ilk mesaj üzerinde. */
  reaction?: { emoji: string; messageId: string; count: number; me: boolean } | null;
}

export interface ForumFeed {
  tags: string[];
  availableTags?: ForumTag[];
  settings?: { requireTag: boolean; defaultReaction: string | null; defaultSort: ForumSort; defaultLayout: ForumLayout };
  /** Sunucunun uyguladığı sıralama (istekte yoksa forum varsayılanı). */
  sort?: ForumSort;
  canPost: boolean;
  canModerate?: boolean;
  posts: ForumFeedPost[];
}

/**
 * Forum gönderileri. `sort` yoksa sunucu forumun varsayılan sıralamasını
 * uygular (web ile aynı); yanıt uygulanan sıralamayı `sort`'ta döner.
 */
export function useForumFeed(
  serverId: string | undefined,
  channelId: string | undefined,
  filter: { sort?: ForumSort | null; tag?: string; archived: boolean }
) {
  return useQuery({
    queryKey: qk.forum(serverId ?? "yok", channelId ?? "yok", `${filter.sort ?? "default"}:${filter.tag ?? ""}:${filter.archived ? 1 : 0}`),
    enabled: Boolean(serverId && channelId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.sort) params.set("sort", filter.sort);
      if (filter.tag) params.set("tag", filter.tag);
      if (filter.archived) params.set("archived", "1");
      const query = params.toString();
      return api<ForumFeed>(`/api/channels/${enc(channelId!)}/forum${query ? `?${query}` : ""}`);
    },
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useForumPostTags(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, tags }: { postId: string; tags: string[] }) =>
      api<{ appliedTags: string[]; appliedTagIds: string[] }>(`/api/channels/${enc(channelId)}/forum`, {
        method: "PATCH",
        body: { postId, tags },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels", serverId, "forum", channelId] }),
  });
}

/** Varsayılan tepki: ilk mesaja tepki aç/kapat (web forum kartı). */
export function useToggleForumReaction(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emoji, messageId }: { emoji: string; messageId: string }) =>
      api("/api/socket/reactions", { method: "POST", body: { emoji, messageId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["channels", serverId, "forum", channelId] }),
  });
}

/**
 * `GET /api/channels?serverId=` satırının `ChannelExtras`'ta olmayan
 * yerleşim / forum / izin alanları (uç hepsini seçiyor; eski önbellekte yok).
 */
export interface ChannelAdminExtras {
  categoryId?: string | null;
  position?: number;
  slowModeSeconds?: number;
  permissionsSynced?: boolean;
  availableTags?: unknown;
  forumRequireTag?: boolean;
  forumDefaultReaction?: string | null;
  forumDefaultSort?: string | null;
  forumDefaultLayout?: string | null;
}
