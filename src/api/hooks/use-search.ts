import { useQuery } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { ActivitySummary, SearchResponse, SearchScope } from "../types";

/** Sunucu tarafındaki alt sınır — daha kısa sorgu boş sonuç döner. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Discord'un hızlı geçiş önekleri (web `lib/global-search.ts` ile aynı):
 * @ kişi, # metin kanalı, ! ses kanalı, * sunucu.
 */
export const SEARCH_PREFIXES: Record<string, SearchScope> = {
  "@": "people",
  "#": "text",
  "!": "voice",
  "*": "servers",
};

/** Yazılan metni kapsam + sorguya ayırır ("@ali" → people/"ali"). */
export function parseSearchQuery(raw: string): { scope: SearchScope; query: string } {
  const trimmed = raw.trimStart();
  const scope = SEARCH_PREFIXES[trimmed[0] ?? ""];
  if (scope) return { scope, query: trimmed.slice(1).trim() };
  return { scope: "all", query: trimmed.trim() };
}

/**
 * Genel arama.
 *
 * Uç 2026-09-25'te düz `{items}` listesine geçti (bkz. `SearchItem`);
 * kapsam `scope` ile daraltılır — ekrandaki çipler ya da yazılan önek.
 *
 * Bu uç bir KULLANICI DİZİNİ DEĞİLDİR: yalnızca oturum sahibinin eriştiği
 * kayıtlar (üye olduğu sunucular, arkadaşları, DM geçmişi, ortak sunucu
 * üyeleri) aranır. Arayüz "kullanıcı bulunamadı" derken bunu ima etmeli —
 * kişi platformda olabilir ama arama kapsamında olmayabilir.
 */
export function useSearch(query: string, scope: SearchScope = "all") {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_SEARCH_LENGTH;

  return useQuery({
    queryKey: qk.search(trimmed, scope),
    enabled,
    queryFn: () =>
      api<SearchResponse>(endpoints.search(trimmed, scope === "all" ? undefined : scope)),
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
