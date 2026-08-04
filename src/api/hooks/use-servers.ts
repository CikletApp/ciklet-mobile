import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  Channel,
  MemberWithProfile,
} from "@ciklet/embedded-activities-sdk/types";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MembershipWithServer, UnreadCounts } from "../types";

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
