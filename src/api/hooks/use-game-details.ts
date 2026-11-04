import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { qk } from "../query-keys";
import type { OwnProfileGame } from "../types";
import { useAuth } from "@/stores/auth";

/**
 * Oyun / program detayı (web `components/games/game-detail-dialog.tsx`) ve
 * profil koleksiyonu düzenleme (web `settings/profile-games-editor.tsx`).
 * Sözleşme ciklet-web `lib/game-details.ts` + `api/games/details`,
 * `api/profile/games`. Uçlar burada; `endpoints.ts` paylaşımlı.
 */
export const gameEndpoints = {
  details: (params: { name: string; type: string; profileId?: string; igdbId?: number }) => {
    const q = new URLSearchParams({ name: params.name, type: params.type });
    if (params.profileId) q.set("profileId", params.profileId);
    if (params.igdbId) q.set("igdbId", String(params.igdbId));
    return `/api/games/details?${q.toString()}`;
  },
  profileGames: "/api/profile/games",
} as const;

export type GameDataSource = "steam" | "igdb" | "wikidata" | "wikipedia" | "builtin";
export type GamePlatform = "windows" | "mac" | "linux" | "playstation" | "xbox" | "switch" | "android" | "ios";

export interface GameExternalData {
  sources: GameDataSource[];
  storeUrl: string | null;
  igdbUrl: string | null;
  coverUrl: string | null;
  headerUrl: string | null;
  heroUrl: string | null;
  shortDescription: string | null;
  description: string | null;
  screenshots: { url: string; thumbUrl: string }[];
  genres: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
  releaseDateIso: string | null;
  platforms: GamePlatform[];
  metacritic: { score: number; url: string | null } | null;
  website: string | null;
  reviews: { label: string; score: number; percent: number; total: number } | null;
  news: { id: string; title: string; url: string; date: string; excerpt: string; imageUrl: string | null }[];
  similar: { name: string; coverUrl: string | null; igdbId: number | null }[];
  logoUrl: string | null;
  license: { kind: "openSource" | "freeware" | "proprietary" | null; names: string[] } | null;
  wikidataUrl: string | null;
  wikipediaUrl: string | null;
  descriptionCredit: { source: "wikipedia"; title: string; url: string; lang: string } | null;
  mediaCredits: { kind: "logo" | "screenshot"; url: string; title: string; pageUrl: string; license: string | null; author: string | null }[];
}

export interface GameDetailsResponse {
  name: string;
  type: string;
  bucket: "game" | "program";
  coverUrl: string | null;
  iconUrl: string | null;
  external: GameExternalData;
  owner: {
    id: string;
    displayName: string;
    isSelf: boolean;
    playtimeMs: number;
    sessionCount: number;
    lastPlayedAt: string;
    hidden: boolean;
  } | null;
  friends: { id: string; username: string; name: string | null; imageUrl: string | null; playtimeMs: number; playingNow: boolean }[];
  friendsTotal: number;
  rank: { rank: number; of: number } | null;
  servers: { id: string; name: string; imageUrl: string | null; description: string | null; memberCount: number; onlineCount: number | null; isMember: boolean }[];
  usage: { players: number; totalMs: number } | null;
}

export function useGameDetails(params: { name: string; type: string; profileId?: string; igdbId?: number }) {
  return useQuery({
    queryKey: ["game-details", params.name, params.type, params.profileId ?? null, params.igdbId ?? null],
    queryFn: () => api<GameDetailsResponse>(gameEndpoints.details(params)),
    enabled: Boolean(params.name && params.type),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Koleksiyonda tek oyunu/programı gizle ya da göster (yalnızca kendi
 * profili). Liste anında güncellensin diye koleksiyon önbelleği iyimser
 * yazılır, hata olursa geri alınır.
 */
export function useSetGameHidden() {
  const queryClient = useQueryClient();
  const myId = useAuth((s) => s.profile?.id);
  return useMutation({
    mutationFn: (input: { name: string; type: string; hidden: boolean }) =>
      api(gameEndpoints.profileGames, { method: "PATCH", body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.profileGames });
      const previous = queryClient.getQueryData<OwnProfileGame[]>(qk.profileGames);
      queryClient.setQueryData<OwnProfileGame[]>(qk.profileGames, (rows) =>
        rows?.map((row) => (row.name === input.name && row.type === input.type ? { ...row, hidden: input.hidden } : row))
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(qk.profileGames, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.profileGames });
      void queryClient.invalidateQueries({ queryKey: ["game-details"] });
      if (myId) void queryClient.invalidateQueries({ queryKey: qk.profileCard(myId) });
    },
  });
}
