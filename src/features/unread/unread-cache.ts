import type { QueryClient } from "@tanstack/react-query";
import type { Channel } from "@ciklet/embedded-activities-sdk/types";

import { qk } from "@/api/query-keys";
import type { DirectSummary, UnreadCounts } from "@/api/types";
import { isAfterSnowflake } from "@/lib/snowflake";

/**
 * Okunmamış sayaçlarının cache matematiği (web: `hooks/use-unread-store.ts`).
 *
 * Kaynak `/api/unread-counts`; canlı olaylar sayıyı istemcide artırıp
 * siler, her mesajda ağır toplama sorgusu yeniden çalışmaz. Kaçan olaylar
 * için mutabakat `realtime/use-unread-sync`'te (bağlantı açılışı, ön plana
 * dönüş, dakikada bir).
 *
 * Fonksiyonlar saf: değişiklik yoksa AYNI nesneyi döndürür ki rozetler boşuna
 * yeniden çizilmesin.
 */

/** Ağdan ya da diskten gelen değeri güvenli kayda indirger (401'de HTML vb.). */
function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, T>)
    : {};
}

export function normalizeUnread(data: unknown): Required<UnreadCounts> {
  const source = asRecord<unknown>(data) as Partial<UnreadCounts>;
  return {
    channelUnreads: asRecord(source.channelUnreads),
    serverUnreads: asRecord(source.serverUnreads),
    directUnreads: asRecord(source.directUnreads),
  };
}

export function incrementChannel(data: Required<UnreadCounts>, serverId: string, channelId: string) {
  const channel = data.channelUnreads[channelId]?.count ?? 0;
  return {
    ...data,
    channelUnreads: { ...data.channelUnreads, [channelId]: { count: channel + 1, serverId } },
    serverUnreads: { ...data.serverUnreads, [serverId]: (data.serverUnreads[serverId] ?? 0) + 1 },
  };
}

export function clearChannel(data: Required<UnreadCounts>, channelId: string) {
  const entry = data.channelUnreads[channelId];
  if (!entry) return data;
  const { [channelId]: _cleared, ...channelUnreads } = data.channelUnreads;
  const left = Math.max(0, (data.serverUnreads[entry.serverId] ?? 0) - entry.count);
  const { [entry.serverId]: _server, ...serverUnreads } = data.serverUnreads;
  return {
    ...data,
    channelUnreads,
    serverUnreads: left > 0 ? { ...serverUnreads, [entry.serverId]: left } : serverUnreads,
  };
}

export function incrementDirect(data: Required<UnreadCounts>, directId: string) {
  return {
    ...data,
    directUnreads: { ...data.directUnreads, [directId]: (data.directUnreads[directId] ?? 0) + 1 },
  };
}

export function clearDirect(data: Required<UnreadCounts>, directId: string) {
  if (!(directId in data.directUnreads)) return data;
  const { [directId]: _cleared, ...directUnreads } = data.directUnreads;
  return { ...data, directUnreads };
}

/**
 * Cache'teki sayaçlara uygular. Sayılar hiç çekilmemişse dokunulmaz —
 * ilk çekim zaten güncel değeri getirecek.
 */
export function patchUnread(
  queryClient: QueryClient,
  update: (data: Required<UnreadCounts>) => Required<UnreadCounts>
) {
  queryClient.setQueryData<UnreadCounts>(qk.unreadCounts, (old) => {
    if (old === undefined) return old;
    const current = normalizeUnread(old);
    const next = update(current);
    return next === current ? old : next;
  });
}

/**
 * Okundu bilgisi geldi (kendi ack'imiz ya da başka cihazdan yayın):
 * sohbetin sayacı silinir, DM satırının imleci ilerletilir — liste
 * yeniden çekilmeden noktası kaybolsun.
 *
 * `reconcile` ("okunmadı işaretle"): imleç bilerek geri sarıldı; sayaç
 * silinmez (kesin sayı yeniden çekiliyor). Aksi hâlde imleç yalnızca
 * İLERİ gider — başka cihazdan geciken eski ack satırı okunmamışa döndürmesin
 * (sunucu da imleci geri almıyor).
 */
export function applyReadState(
  queryClient: QueryClient,
  readState: {
    channelId?: string | null;
    directId?: string | null;
    messageId?: string | null;
    reconcile?: boolean;
  }
) {
  const { channelId, directId, messageId, reconcile = false } = readState;
  // Okumadan önce başlamış bir çekim eski sayıyı geri yazmasın: yeniden başlat.
  if (!reconcile && queryClient.isFetching({ queryKey: qk.unreadCounts }) > 0) {
    void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
  }
  if (channelId && !reconcile) patchUnread(queryClient, (data) => clearChannel(data, channelId));
  if (directId) {
    if (!reconcile) patchUnread(queryClient, (data) => clearDirect(data, directId));
    if (messageId) {
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (list) =>
        Array.isArray(list)
          ? list.map((direct) =>
              direct.id === directId &&
              (reconcile || !direct.readCursor || isAfterSnowflake(messageId, direct.readCursor))
                ? { ...direct, readCursor: messageId }
                : direct
            )
          : list
      );
    }
  }
}

/**
 * Kanal bu kullanıcıya görünmüyor mu. `channel.message` sunucu odasının
 * TAMAMINA gidiyor, özel kanalı göremeyen üyeye de; kanal listesi cache'te
 * varsa ve kanal içinde yoksa olay yok sayılır (web bunu sunucu sayımında
 * eliyor). Liste hiç çekilmemişse bilinmiyor → görünür kabul.
 */
export function isHiddenChannel(queryClient: QueryClient, serverId: string, channelId: string) {
  // Kanal düzeni değişince liste geçersizlenir ama ekran kapalıysa yeniden
  // çekilmez; eski listeye güvenmek yeni/yeni açılan kanalı gizli sayardı.
  if (queryClient.getQueryState(qk.channels(serverId))?.isInvalidated) return false;
  const channels = queryClient.getQueryData<Channel[]>(qk.channels(serverId));
  if (!Array.isArray(channels) || channels.some((channel) => channel.id === channelId)) return false;
  // Alt başlıklar kanal listesinde yok; bilinen alt başlık / forum gönderisi
  // listelerinde geçiyorsa görünür. Hiçbirinde yoksa yine bilinmiyor sayılmaz:
  // web de yalnızca görülebilen alt başlıkları sayar.
  const known = queryClient
    .getQueriesData<unknown>({ queryKey: [...qk.channels(serverId)] })
    .some(([, data]) => {
      const list = Array.isArray(data) ? data : (data as { posts?: unknown } | undefined)?.posts;
      return Array.isArray(list) && list.some((row) => (row as { id?: unknown } | null)?.id === channelId);
    });
  return !known;
}
