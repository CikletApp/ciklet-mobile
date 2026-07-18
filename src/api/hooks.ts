import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  DirectWithProfiles,
  MessagesPage,
  MessageWithMember,
  OwnProfile,
  ServerWithChannels,
} from "@ciklet/embedded-activities-sdk/types";

import { api } from "./client";

/**
 * Sunucu verisi hook'ları — isimlendirme ciklet-web'deki hook'larla paralel
 * tutulur ki iki kod tabanı arasında gidip gelmek zihinsel maliyet yaratmasın.
 */

export function useCurrentProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: () => api<OwnProfile>("/api/current-profile"),
  });
}

export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => api<ServerWithChannels[]>("/api/servers"),
  });
}

export function useDirects() {
  return useQuery({
    queryKey: ["directs"],
    queryFn: () => api<DirectWithProfiles[]>("/api/directs"),
  });
}

export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: ["messages", channelId],
    queryFn: ({ pageParam }) =>
      api<MessagesPage<MessageWithMember>>(
        `/api/messages?channelId=${channelId}${pageParam ? `&cursor=${pageParam}` : ""}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSendMessage(channelId: string, serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // Web istemcisiyle aynı uç: pages/api/socket/messages (Socket.IO
    // sunucusu mesajı kaydedip odaya yayınlar).
    mutationFn: (content: string) =>
      api(`/api/socket/messages?channelId=${channelId}&serverId=${serverId}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}
