import { useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChannelType, type Channel } from "@ciklet/embedded-activities-sdk/types";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { ChannelExtras, ForumResponse, ThreadSummary } from "../types";

/**
 * Alt başlıklar (thread) ve forum gönderileri.
 *
 * Web tasarımı: alt başlık üst kanala bağlı bir KANAL satırıdır
 * (`Channel.parentChannelId`); mesaj deposu, ağ geçidi, okunmamış ve
 * arama değişmeden çalışır. `GET /api/channels?serverId=` alt başlıkları
 * DÖNDÜRMEZ; kanal listesinde göstermek için her metin kanalının açık alt
 * başlıkları ayrı çekilir. Anahtarlar `["channels", serverId, ...]`
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

/** Kenar listesi: metin kanallarının (forum hariç) açık alt başlıkları, üst kanal kimliğine göre. */
export function useSidebarThreads(serverId: string | undefined, channels: Channel[] | undefined) {
  const parents = useMemo(
    () =>
      (channels ?? []).filter(
        (channel) => channel.type === ChannelType.TEXT && !(channel as Channel & ChannelExtras).forum
      ),
    [channels]
  );
  const results = useQueries({
    queries: parents.map((channel) => ({
      queryKey: qk.threads(serverId ?? "yok", channel.id, false),
      enabled: Boolean(serverId),
      queryFn: () => api<ThreadSummary[]>(endpoints.channelThreads(channel.id, false)),
      staleTime: 60_000,
      // Kanal görülemiyorsa 404; satır yalnızca alt başlıksız kalır.
      retry: false,
    })),
  });
  // Ucuz bir eşleme; her çizimde yeniden kurulur.
  const map = new Map<string, ThreadSummary[]>();
  parents.forEach((channel, index) => {
    const list = results[index]?.data;
    if (list?.length) map.set(channel.id, list);
  });
  return map;
}

export function useCreateThread(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api<{ id: string; name: string }>(endpoints.channelThreads(channelId), { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
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
