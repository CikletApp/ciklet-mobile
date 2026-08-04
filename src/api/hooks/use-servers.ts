import { useQuery } from "@tanstack/react-query";
import type { ServerWithChannels } from "@ciklet/embedded-activities-sdk/types";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { UnreadCounts } from "../types";

/**
 * Üye olunan sunucular; kanallar ve üyeler yanıtta gömülü gelir.
 * Sunucu rayı, kanal listesi ve sohbet başlığı hep bu tek sorgudan beslenir —
 * kanal başına ayrı istek atılmaz.
 */
export function useServers() {
  return useQuery({
    queryKey: qk.servers.all,
    queryFn: () => api<ServerWithChannels[]>(endpoints.servers),
    // Sunucu/kanal listesi seyrek değişir; her odak değişiminde çekmeye gerek yok.
    staleTime: 5 * 60_000,
  });
}

/** Tek sunucuyu listeden türetir — ayrı ağ isteği yapmaz. */
export function useServer(serverId: string | undefined) {
  const query = useServers();
  return {
    ...query,
    data: serverId ? query.data?.find((s) => s.id === serverId) : undefined,
  };
}

/** Tek kanalı listeden türetir. */
export function useChannel(serverId: string | undefined, channelId: string | undefined) {
  const { data: server } = useServer(serverId);
  if (!channelId) return undefined;
  return server?.channels.find((c) => c.id === channelId);
}

/** Okunmamış rozetleri — sunucu rayı ve kanal listesi kullanır. */
export function useUnreadCounts() {
  return useQuery({
    queryKey: qk.unreadCounts,
    queryFn: () => api<UnreadCounts>(endpoints.unreadCounts),
    staleTime: 30_000,
  });
}
