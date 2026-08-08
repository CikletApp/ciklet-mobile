import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Channel,
  ChannelType,
  MemberWithProfile,
} from "@ciklet/embedded-activities-sdk/types";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MembershipWithServer, ServerDetails, UnreadCounts } from "../types";

/**
 * Sunucu verisi.
 *
 * ⚠️ `GET /api/servers` DİYE BİR UÇ YOK — ciklet-web'de o yolun yalnızca
 * POST (sunucu oluşturma) handler'ı var ve GET isteği 405 döner. İlk
 * sürümde sunucu rayının boş görünmesinin sebebi buydu.
 *
 * Gerçek sözleşme üç ayrı uca dağılmış durumda:
 *   sunucu listesi → GET /api/members/mine   (server alanı gömülü)
 *   kanallar       → GET /api/channels?serverId=
 *   üyeler         → GET /api/members?serverId=
 *
 * Bu yüzden kanal ve üye listeleri sunucu listesinden TÜRETİLEMEZ; ihtiyaç
 * duyulan ekranda ayrıca çekilir. Karşılığında liste ucu hafifler.
 */

/** Kullanıcının üye olduğu sunucular — ray ve sunucu seçici bunu kullanır. */
export function useMyServers() {
  const query = useQuery({
    queryKey: qk.memberships,
    queryFn: () => api<MembershipWithServer[]>(endpoints.myMemberships),
    staleTime: 5 * 60_000,
  });

  const servers = useMemo(
    () => (query.data ?? []).map((membership) => membership.server),
    [query.data]
  );

  return { ...query, servers };
}

/** Tek sunucunun özeti — liste zaten cache'te, ayrı istek atılmaz. */
export function useServerSummary(serverId: string | undefined) {
  const { servers, ...rest } = useMyServers();
  return {
    ...rest,
    data: serverId ? servers.find((s) => s.id === serverId) : undefined,
  };
}

/** Oturum sahibinin bu sunucudaki üyelik kaydı (sunucu profili düzenleme). */
export function useMyMembership(serverId: string | undefined) {
  const query = useMyServers();
  return {
    ...query,
    data: serverId ? query.data?.find((m) => m.serverId === serverId) : undefined,
  };
}

export function useServerChannels(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.channels(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<Channel[]>(endpoints.serverChannels(serverId!)),
    staleTime: 5 * 60_000,
  });
}

export function useServerDetails(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.server(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerDetails>(endpoints.server(serverId!)),
  });
}

export function useUpdateServer(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Pick<ServerDetails, "name" | "description" | "isPublic" | "isDiscoverable" | "systemChannelId">>) =>
      api<ServerDetails>(endpoints.server(serverId), { method: "PATCH", body: input }),
    onSuccess: (server) => {
      queryClient.setQueryData(qk.server(serverId), server);
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
    },
  });
}

export function useDeleteServer(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(endpoints.server(serverId), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.memberships }),
  });
}

export function useLeaveServer(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(endpoints.serverLeave(serverId), { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.memberships }),
  });
}

export function useCreateChannel(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: ChannelType }) =>
      api(endpoints.createChannel(serverId), { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

export function useUpdateChannel(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: ChannelType }) =>
      api(endpoints.manageChannel(channelId, serverId), { method: "PATCH", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

export function useDeleteChannel(serverId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(endpoints.manageChannel(channelId, serverId), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.channels(serverId) }),
  });
}

/** Tek kanalı sunucunun kanal listesinden türetir. */
export function useChannel(
  serverId: string | undefined,
  channelId: string | undefined
) {
  const { data: channels } = useServerChannels(serverId);
  return useMemo(
    () => (channelId ? channels?.find((c) => c.id === channelId) : undefined),
    [channels, channelId]
  );
}

export function useServerMembers(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.members(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<MemberWithProfile[]>(endpoints.serverMembers(serverId!)),
    staleTime: 60_000,
  });
}

/** Okunmamış rozetleri — sunucu rayı ve kanal listesi kullanır. */
export function useUnreadCounts() {
  return useQuery({
    queryKey: qk.unreadCounts,
    queryFn: () => api<UnreadCounts>(endpoints.unreadCounts),
    staleTime: 30_000,
  });
}
