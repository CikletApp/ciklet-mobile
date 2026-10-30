import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ChannelType, type Channel } from "@ciklet/embedded-activities-sdk/types";

import { ApiError, api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { ChannelExtras, ForumResponse, ServerThread, ThreadMembersState, ThreadSummary } from "../types";

/**
 * Alt başlıklar (thread) ve forum gönderileri.
 *
 * Web tasarımı: alt başlık üst kanala bağlı bir KANAL satırıdır
 * (`Channel.parentChannelId`); mesaj deposu, ağ geçidi, okunmamış ve
 * arama değişmeden çalışır. `GET /api/channels?serverId=` alt başlıkları
 * DÖNDÜRMEZ; kenar listesi sunucunun açık alt başlıklarını tek istekte
 * (`GET /api/servers/[id]/threads`) çeker. Kanal başına liste yalnızca alt
 * başlık listesi ekranında ve arşivde kullanılır. Anahtarlar `["channels", serverId, ...]`
 * altında: kanal yerleşimi değişince (`server.channels_updated`, arşivleme
 * de bunu yayınlıyor) kanal listesiyle birlikte tazelenir.
 */

export function useChannelThreads(
  serverId: string | undefined,
  channelId: string | undefined,
  archived = false,
  enabled = true
) {
  return useQuery({
    queryKey: qk.threads(serverId ?? "yok", channelId ?? "yok", archived),
    enabled: Boolean(serverId && channelId) && enabled,
    queryFn: () => api<ThreadSummary[]>(endpoints.channelThreads(channelId!, archived)),
    staleTime: 60_000,
  });
}

/**
 * Sunucunun görünür, açık, forum dışı alt başlıkları — tek istek. Uç henüz
 * yoksa (404, eski sunucu) metin kanallarının listeleri tek tek çekilip aynı
 * biçime çevrilir.
 */
export function useServerThreads(serverId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.sidebarThreads(serverId ?? "yok"),
    enabled: Boolean(serverId) && enabled,
    queryFn: () => fetchServerThreads(queryClient, serverId!),
    staleTime: 60_000,
  });
}

async function fetchServerThreads(queryClient: QueryClient, serverId: string): Promise<ServerThread[]> {
  try {
    // Web `{ threads: [...] }` döndürüyor; düz dizi de kabul edilir.
    const res = await api<ServerThread[] | { threads: ServerThread[] }>(endpoints.serverThreads(serverId));
    return Array.isArray(res) ? res : res.threads ?? [];
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  const channels = await queryClient.ensureQueryData({
    queryKey: qk.channels(serverId),
    queryFn: () => api<Channel[]>(endpoints.serverChannels(serverId)),
  });
  const parents = channels.filter(
    (channel) => channel.type === ChannelType.TEXT && !(channel as Channel & ChannelExtras).forum
  );
  const lists = await Promise.all(
    parents.map((channel) =>
      api<ThreadSummary[]>(endpoints.channelThreads(channel.id, false)).then(
        (rows) =>
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            parentChannelId: channel.id,
            latestMessageId: row.latestMessageId,
          })),
        // Kanal görülemiyorsa 404; satır yalnızca alt başlıksız kalır.
        () => [] as ServerThread[]
      )
    )
  );
  return lists.flat();
}

/** Kenar listesi: açık alt başlıklar, üst kanal kimliğine göre. */
export function useSidebarThreads(serverId: string | undefined) {
  const { data } = useServerThreads(serverId);
  return useMemo(() => {
    const map = new Map<string, ServerThread[]>();
    for (const thread of data ?? []) {
      const list = map.get(thread.parentChannelId);
      if (list) list.push(thread);
      else map.set(thread.parentChannelId, [thread]);
    }
    return map;
  }, [data]);
}

/** Yeni açılan alt başlığı kenar listesine ekler (tazeleme beklenmeden görünsün). */
export function addSidebarThread(queryClient: QueryClient, serverId: string, thread: ServerThread) {
  queryClient.setQueryData<ServerThread[]>(qk.sidebarThreads(serverId), (list) =>
    Array.isArray(list) && !list.some((row) => row.id === thread.id) ? [thread, ...list] : list
  );
}

/**
 * Bilinen alt başlık mı: `threadId` önbellekteki bir listede (kenar listesi
 * ya da kanalın açık / arşiv listesi) gerçekten `parentId` kanalının alt
 * başlığı olarak geçiyor mu. Ağ isteği atmaz.
 */
export function isKnownThreadOf(
  queryClient: QueryClient,
  serverId: string,
  parentId: string,
  threadId: string
): boolean {
  const sidebar = queryClient.getQueryData<ServerThread[]>(qk.sidebarThreads(serverId));
  if (sidebar?.some((row) => row.id === threadId && row.parentChannelId === parentId)) return true;
  return [false, true].some((archived) =>
    queryClient
      .getQueryData<ThreadSummary[]>(qk.threads(serverId, parentId, archived))
      ?.some((row) => row.id === threadId)
  );
}

export type ThreadParentStatus = "channel" | "thread" | "pending" | "unknown" | "error";

/**
 * Kanal kimliğinin alt başlık olup olmadığını ve üst kanalını çözer —
 * `parentId`'siz gelen bağlantılar (bahsetmeler, kaydedilenler, arama,
 * bildirimler) için. Sıra: kanal listesi → kenar listesi → (yalnızca hâlâ
 * bulunamadıysa) metin kanallarının açık + arşiv listeleri.
 *  - `channel`  normal kanal (ya da sunucu bilinmiyor)
 *  - `thread`   alt başlık; `parentId` dolu
 *  - `pending`  listeler yükleniyor
 *  - `unknown`  hiçbir listede yok (silinmiş ya da erişim yok)
 *  - `error`    kanal listesi yüklenemedi
 */
export function useThreadParent(
  serverId: string | undefined,
  channelId: string,
  parentIdParam: string | undefined,
  channels: { data: Channel[] | undefined; isError: boolean }
): { status: ThreadParentStatus; parentId?: string } {
  const listed = Boolean(channels.data?.some((channel) => channel.id === channelId));
  const needLookup = Boolean(serverId) && !parentIdParam && Boolean(channels.data) && !listed;
  const sidebar = useServerThreads(serverId, needLookup);
  const fromSidebar = sidebar.data?.find((thread) => thread.id === channelId)?.parentChannelId;
  const needScan = needLookup && Boolean(sidebar.data || sidebar.isError) && !fromSidebar;
  const textChannels = useMemo(
    () => (needScan ? (channels.data ?? []).filter((channel) => channel.type === ChannelType.TEXT) : []),
    [needScan, channels.data]
  );
  const scans = useQueries({
    queries: textChannels.flatMap((channel) =>
      [false, true].map((archived) => ({
        queryKey: qk.threads(serverId ?? "yok", channel.id, archived),
        queryFn: () => api<ThreadSummary[]>(endpoints.channelThreads(channel.id, archived)),
        staleTime: 60_000,
        retry: false,
      }))
    ),
  });

  if (parentIdParam) return { status: "thread", parentId: parentIdParam };
  if (!serverId || listed) return { status: "channel" };
  if (!channels.data) return { status: channels.isError ? "error" : "pending" };
  if (fromSidebar) return { status: "thread", parentId: fromSidebar };
  if (!needScan) return { status: "pending" };
  const index = scans.findIndex((scan) => scan.data?.some((thread) => thread.id === channelId));
  const parent = index >= 0 ? textChannels[Math.floor(index / 2)] : undefined;
  if (parent) return { status: "thread", parentId: parent.id };
  if (scans.some((scan) => scan.isPending)) return { status: "pending" };
  return { status: "unknown" };
}

export function useCreateThread(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    /** `private` + `invitable`: özel alt başlık (web lib/threads; yalnızca mesajsız açılış). */
    mutationFn: (input: { name: string; private?: boolean; invitable?: boolean }) =>
      api<{ id: string; name: string }>(endpoints.channelThreads(channelId), { method: "POST", body: input }),
    onSuccess: (thread) => {
      addSidebarThread(queryClient, serverId, {
        id: thread.id,
        name: thread.name,
        parentChannelId: channelId,
        latestMessageId: null,
      });
      void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) });
    },
  });
}

export function useArchiveThread(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, archived }: { threadId: string; archived: boolean }) =>
      api<{ archived: boolean }>(endpoints.threadArchive(threadId), { method: "POST", body: { archived } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

/** Alt başlığı kilitle / kilidi aç (web `POST /api/channels/[id]/lock`). */
export function useLockThread(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, locked }: { threadId: string; locked: boolean }) =>
      api<{ locked: boolean }>(endpoints.threadLock(threadId), { method: "POST", body: { locked } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

/**
 * Forum gönderisini sabitle / sabitini kaldır (forum başına bir; sunucu
 * öncekini düşürür). Forum listeleri `["channels", serverId, ...]` altında.
 */
export function usePinForumPost(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) =>
      api<{ pinned: boolean }>(endpoints.forumPin(postId), { method: "POST", body: { pinned } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

/**
 * Alt başlığın durumu: üst kanalın açık listesinde mi, arşivde mi.
 * `undefined` = henüz bilinmiyor (listeler yükleniyor).
 */
export function useThreadState(serverId: string | undefined, parentId: string | undefined, threadId: string) {
  const open = useChannelThreads(serverId, parentId, false);
  const inOpen = open.data?.find((thread) => thread.id === threadId);
  const archived = useChannelThreads(serverId, parentId, true, Boolean(open.data) && !inOpen);
  const inArchive = archived.data?.find((thread) => thread.id === threadId);
  const thread = inOpen ?? inArchive;
  const known = Boolean(inOpen) || Boolean(archived.data);
  return { thread, archived: known ? !inOpen && Boolean(inArchive) : undefined };
}

// ── Alt başlık üyeliği (takip) ──────────────────────────────────────
//
// Web lib/server/thread-members: katılmak = takip etmek (kenar listesi,
// okunmamış, bildirim); özel alt başlığı yalnızca üyeler ve "Alt
// Başlıkları Yönet" görür. Kurallar sunucuda; arayüz `ThreadMembersState`
// bayraklarına bakar.

export function useThreadMembers(serverId: string | undefined, threadId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.threadMembers(serverId ?? "yok", threadId ?? "yok"),
    enabled: Boolean(serverId && threadId) && enabled,
    queryFn: () => api<ThreadMembersState>(endpoints.threadMembers(threadId!)),
    staleTime: 30_000,
  });
}

/** Takip Et (`join: true`) / Takibi Bırak; ekle (`userId`) / çıkar. */
export function useThreadMembership(serverId: string, threadId: string) {
  const queryClient = useQueryClient();
  // Kenar listesi, alt başlık listeleri ve üye listesi aynı anahtar altında.
  const refresh = () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) });
  return useMutation({
    mutationFn: ({ userId, add }: { userId: string; add: boolean }) =>
      api<null>(endpoints.threadMember(threadId, userId), { method: add ? "PUT" : "DELETE" }),
    onSuccess: refresh,
  });
}

/** Özel alt başlıkta "Herkes davet edebilir". */
export function useSetThreadInvitable(serverId: string, threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitable: boolean) =>
      api<{ invitable: boolean }>(endpoints.threadMembers(threadId), { method: "PATCH", body: { invitable } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.threadMembers(serverId, threadId) }),
  });
}

// ── Forum ───────────────────────────────────────────────────────────

export interface ForumFilter {
  sort: "activity" | "created";
  tag?: string;
  archived: boolean;
}

export function useForumPosts(serverId: string | undefined, channelId: string | undefined, filter: ForumFilter) {
  return useQuery({
    queryKey: qk.forum(serverId ?? "yok", channelId ?? "yok", `${filter.sort}:${filter.tag ?? ""}:${filter.archived ? 1 : 0}`),
    enabled: Boolean(serverId && channelId),
    queryFn: () => api<ForumResponse>(endpoints.forumPosts(channelId!, filter)),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useCreateForumPost(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; content: string; tags: string[] }) =>
      api<{ id: string }>(endpoints.forumPosts(channelId), { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}
