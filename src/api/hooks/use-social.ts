import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  BookmarkEntry,
  MentionEntry,
  MessageRequestEntry,
  ProfileConnectionView,
  SpotifyLinkStatus,
  SpotifyNowPlaying,
} from "../types";

/**
 * Sosyal yüzeylerin veri katmanı — yer imleri, bahsetmeler, mesaj
 * istekleri, profil bağlantıları ve Spotify. Hepsi ciklet-web'de bitmiş
 * uçlar; mobil yalnızca tüketir.
 */

// ── Yer imleri ──────────────────────────────────────────────────────

/** Kaydedilmiş mesaj kimlikleri — menüde "Kaydet" / "Kaydı kaldır" kararı. */
export function useBookmarkIds() {
  return useQuery({
    queryKey: qk.bookmarkIds,
    queryFn: () => api<{ ids: string[] }>(endpoints.bookmarks(true)),
    select: (data) => new Set(data?.ids ?? []),
    staleTime: 5 * 60_000,
  });
}

/** Kaydedilenler ekranı — erişim sunucuda listede yeniden doğrulanır. */
export function useBookmarks() {
  return useQuery({
    queryKey: qk.bookmarks,
    queryFn: () => api<BookmarkEntry[]>(endpoints.bookmarks()),
  });
}

export type BookmarkTarget = { messageId: string; scope: "channel" | "direct"; chatId: string };

/**
 * Kaydet / kaldır. Kimlik kümesi iyimser güncellenir (menü anında doğru
 * etiketi göstersin); hata olursa sunucudaki gerçek liste yeniden çekilir.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, saved }: { target: BookmarkTarget; saved: boolean }) =>
      saved
        ? api(endpoints.bookmarks(), { method: "DELETE", body: { messageId: target.messageId } })
        : api(endpoints.bookmarks(), { method: "POST", body: target }),
    onMutate: ({ target, saved }) => {
      queryClient.setQueryData<{ ids: string[] }>(qk.bookmarkIds, (old) => {
        const ids = new Set(old?.ids ?? []);
        if (saved) ids.delete(target.messageId);
        else ids.add(target.messageId);
        return { ids: [...ids] };
      });
      if (saved) {
        queryClient.setQueryData<BookmarkEntry[]>(qk.bookmarks, (old) =>
          old?.filter((entry) => entry.messageId !== target.messageId)
        );
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: qk.bookmarkIds });
    },
    onSettled: (_data, _error, { saved }) => {
      // Yeni kayıt hidrasyonlu listede ancak sunucudan gelir.
      if (!saved) void queryClient.invalidateQueries({ queryKey: qk.bookmarks });
    },
  });
}

// ── Bahsetmeler ─────────────────────────────────────────────────────

export function useMentions() {
  return useQuery({
    queryKey: qk.mentions,
    queryFn: () => api<MentionEntry[]>(endpoints.mentions),
    staleTime: 30_000,
  });
}

// ── Mesaj istekleri ─────────────────────────────────────────────────

/**
 * Arkadaş olmayanlardan gelen DM'ler. Sayaç ayrı bir istekle değil listenin
 * uzunluğundan okunur (web `?count=1` kullanıyor; mobilde iki istek gereksiz).
 */
export function useMessageRequests() {
  const query = useQuery({
    queryKey: qk.messageRequests,
    queryFn: () => api<MessageRequestEntry[]>(endpoints.messageRequests()),
    staleTime: 30_000,
  });
  return { ...query, count: query.data?.length ?? 0 };
}

/**
 * Kabul / yok say / engelle. Engelleme mevcut engelleme ucuyla yapılır ve
 * istek ayrıca yok sayılır (web ile aynı sıra).
 */
export function useRespondMessageRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entry, action }: { entry: MessageRequestEntry; action: "accept" | "ignore" | "block" }) => {
      if (action === "block") {
        await api(endpoints.friendBlock, { method: "POST", body: { profileId: entry.other.id } });
        await api(endpoints.messageRequests(), { method: "POST", body: { directId: entry.directId, action: "ignore" } });
        return;
      }
      await api(endpoints.messageRequests(), { method: "POST", body: { directId: entry.directId, action } });
    },
    onSuccess: (_data, { entry, action }) => {
      queryClient.setQueryData<MessageRequestEntry[]>(qk.messageRequests, (old) =>
        old?.filter((item) => item.directId !== entry.directId)
      );
      // Kabul edilen sohbet gelen kutusuna ve okunmamışlara normal DM olarak döner.
      void queryClient.invalidateQueries({ queryKey: qk.directs });
      void queryClient.invalidateQueries({ queryKey: qk.inbox });
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
      if (action === "block") {
        void queryClient.invalidateQueries({ queryKey: qk.friends });
        void queryClient.invalidateQueries({ queryKey: qk.blockedUsers });
      }
    },
  });
}

// ── Profil bağlantıları ─────────────────────────────────────────────

export function useProfileConnections() {
  return useQuery({
    queryKey: qk.profileConnections,
    queryFn: () => api<ProfileConnectionView[]>(endpoints.profileConnections),
  });
}

export function useSaveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; handle: string; visible?: boolean }) =>
      api<ProfileConnectionView>(endpoints.profileConnections, { method: "PUT", body: input }),
    onSuccess: (row) => {
      queryClient.setQueryData<ProfileConnectionView[]>(qk.profileConnections, (old) => {
        const list = old ?? [];
        return list.some((c) => c.type === row.type)
          ? list.map((c) => (c.type === row.type ? row : c))
          : [...list, row];
      });
      invalidateOwnCard(queryClient);
    },
  });
}

/**
 * Spotify bağlantısını GERÇEKTEN kaldırır (`DELETE /api/connections/spotify`:
 * token'lar silinir). Genel bağlantı ucu yalnızca profil satırını siliyordu;
 * hesap bağlı kalıyor, durum yeniden "Bağlı" geliyordu.
 */
export function useUnlinkSpotify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(endpoints.spotifyConnection, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<ProfileConnectionView[]>(qk.profileConnections, (old) =>
        old?.filter((c) => c.type !== "spotify")
      );
      void queryClient.invalidateQueries({ queryKey: qk.spotifyLink });
      void queryClient.invalidateQueries({ queryKey: qk.profileConnections });
      invalidateOwnCard(queryClient);
    },
  });
}

export function useRemoveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: string) =>
      api(endpoints.profileConnections, { method: "DELETE", body: { type } }),
    onSuccess: (_data, type) => {
      queryClient.setQueryData<ProfileConnectionView[]>(qk.profileConnections, (old) =>
        old?.filter((c) => c.type !== type)
      );
      if (type === "spotify") void queryClient.invalidateQueries({ queryKey: qk.spotifyLink });
      invalidateOwnCard(queryClient);
    },
  });
}

/** Kendi üye kartın bağlantı listesini taşıyor; hangi kimlikte olduğu bilinmeden hepsi tazelenir. */
function invalidateOwnCard(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["profile-card"] });
}

// ── Spotify ─────────────────────────────────────────────────────────

/** Oturum sahibinin Spotify bağlantısı (Birlikte dinle için bağlı + Premium gerekir). */
export function useSpotifyLink(enabled = true) {
  return useQuery({
    queryKey: qk.spotifyLink,
    enabled,
    queryFn: () => api<SpotifyLinkStatus>(endpoints.spotifyConnection),
    staleTime: 5 * 60_000,
  });
}

/**
 * Bir kullanıcının Spotify'da çalanı. Sunucu yalnızca kendisine ya da
 * doğrulanmış + görünür bağlantıya döner; 5 sn önbellekli. Kart açıkken
 * 30 sn'de bir tazelenir (şarkı değişimi), ilerleme istemcide sayılır.
 * `polling`: yalnızca ekran görünürken yoklanır (çağıran `useScreenActive` verir).
 */
export function useSpotifyNowPlaying(profileId: string | undefined, enabled = true, polling = true) {
  return useQuery({
    queryKey: qk.spotifyNowPlaying(profileId ?? "yok"),
    enabled: Boolean(profileId) && enabled,
    queryFn: () => api<{ playing: SpotifyNowPlaying | null }>(endpoints.spotifyNowPlaying(profileId!)),
    select: (data) => data?.playing ?? null,
    refetchInterval: polling ? 30_000 : false,
    staleTime: 10_000,
  });
}
