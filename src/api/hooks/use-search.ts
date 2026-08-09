import { useQuery } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { ActivitySummary, SearchResults } from "../types";

/** Sunucu tarafındaki alt sınır — daha kısa sorgu boş sonuç döner. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Genel arama.
 *
 * Bu uç bir KULLANICI DİZİNİ DEĞİLDİR: yalnızca oturum sahibinin eriştiği
 * kayıtlar (üye olduğu sunucular, arkadaşları, DM geçmişi) aranır. Arayüz
 * "kullanıcı bulunamadı" derken bunu ima etmeli — kişi platformda olabilir
 * ama arama kapsamında olmayabilir.
 */
export function useSearch(query: string) {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_SEARCH_LENGTH;

  return useQuery({
    queryKey: qk.search(trimmed),
    enabled,
    queryFn: () => api<SearchResults>(endpoints.search(trimmed)),
    // Arama sonucu kısa ömürlü; yazarken her tuşta yeniden çekmemek için
    // kısa bir taze pencere bırakılır.
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  });
}

/** Onaylı aktiviteler — Faz 4'te aktivite seçicisini besler. */
export function useActivities() {
  return useQuery({
    queryKey: qk.activities,
    queryFn: async () => {
      const response = await api<
        ActivitySummary[] | { activities?: ActivitySummary[] }
      >(endpoints.activities);

      // Web ucu `{ activities: [...] }` döndürüyor. Eski mobil sürümler
      // yanıtı doğrudan dizi sanıyordu; kalıcı React Query cache'inde kalan
      // nesne ActivityInviteMessage içindeki `.some()` çağrısını release'te
      // çökertebiliyordu. Buradan sonrası daima dizi görür.
      return Array.isArray(response) ? response : response.activities ?? [];
    },
    staleTime: 10 * 60_000,
  });
}
