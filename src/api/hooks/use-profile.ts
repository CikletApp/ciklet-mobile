import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OwnProfile } from "@ciklet/embedded-activities-sdk/types";

import { useAuth } from "@/stores/auth";
import { rememberDecorations } from "@/stores/decorations";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  CurrentProfile,
  MembershipWithServer,
  OwnProfileGame,
  ProfileCardResponse,
  UpdateMemberProfileInput,
  UpdateProfileInput,
} from "../types";

/** Kendi profilin — ayarlar ve profil düzenleme ekranlarının kaynağı. */
export function useCurrentProfile() {
  return useQuery({
    queryKey: qk.currentProfile,
    queryFn: async () => {
      const profile = await api<CurrentProfile>(endpoints.currentProfile);
      rememberDecorations([profile]);
      return profile;
    },
  });
}

/**
 * Profil güncelleme. Başarılı yanıt hem cache'i hem de kabuktaki
 * (sekme çubuğu avatarı) oturum profilini tazeler.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setProfile = useAuth((s) => s.setProfile);

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<CurrentProfile>(endpoints.currentProfile, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.currentProfile, updated);
      setProfile(updated as unknown as OwnProfile);
      rememberDecorations([updated]);
    },
  });
}

/**
 * Üye kartı — başka bir kullanıcının zengin profili (bio, pronouns, banner
 * rengi, Mentol rozeti, arkadaşlık durumu, ortak arkadaşlar). Sohbette
 * avatara dokununca ve profil ekranında kullanılır; mesaj listesi payload'ı
 * bu alanları bilerek taşımıyor (ciklet-web `profile-select.ts`).
 */
export function useProfileCard(profileId: string | undefined) {
  return useQuery({
    queryKey: qk.profileCard(profileId ?? "yok"),
    enabled: Boolean(profileId),
    queryFn: async () => {
      const card = await api<ProfileCardResponse>(endpoints.profileCard(profileId!));
      rememberDecorations([card.profile]);
      return card;
    },
    staleTime: 60_000,
  });
}

/**
 * Kendi üyeliklerin. "Sunucu Profilleri" sekmesi bu listeyi gösterir;
 * her satırın `id`'si `PATCH /api/members/[memberId]` için gereken
 * `memberId`'dir.
 */
export function useMyMemberships() {
  return useQuery({
    queryKey: qk.memberships,
    queryFn: () => api<MembershipWithServer[]>(endpoints.myMemberships),
  });
}

/** Sunucuya özel profil (takma ad, hitaplar, hakkımda) güncellemesi. */
export function useUpdateMemberProfile(memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMemberProfileInput) =>
      api<MembershipWithServer>(endpoints.member(memberId), {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
      // Takma ad üye listelerinde ve mesaj başlıklarında da görünür.
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

/** Kendi oyun koleksiyonun (`GET /api/profile/games`) — favori seçici. */
export function useMyGames(enabled = true) {
  return useQuery({
    queryKey: qk.profileGames,
    enabled,
    queryFn: async () => {
      const rows = await api<OwnProfileGame[]>(endpoints.profileGames);
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 30_000,
  });
}

/** Favori seçimi: `{ name, type, tag }` favori yapar, `null` kaldırır. */
export type FavoriteGameInput = { name: string; type: string; tag: string | null } | null;

/**
 * Favori oyunu kaydeder (PUT / DELETE /api/profile/games/favorite).
 * Seçici anında güncellensin diye koleksiyon önbelleği iyimser yazılır,
 * hata olursa geri alınır; bitince kendi profil kartı tazelenir.
 */
export function useSetFavoriteGame() {
  const queryClient = useQueryClient();
  const myId = useAuth((s) => s.profile?.id);

  return useMutation({
    mutationFn: (input: FavoriteGameInput) =>
      input
        ? api(endpoints.profileFavoriteGame, { method: "PUT", body: input })
        : api(endpoints.profileFavoriteGame, { method: "DELETE" }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.profileGames });
      const previous = queryClient.getQueryData<OwnProfileGame[]>(qk.profileGames);
      queryClient.setQueryData<OwnProfileGame[]>(qk.profileGames, (rows) =>
        rows?.map((row) => {
          const chosen = input !== null && row.name === input.name && row.type === input.type;
          return { ...row, favorite: chosen, favoriteTag: chosen ? input.tag : null };
        })
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(qk.profileGames, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.profileGames });
      if (myId) void queryClient.invalidateQueries({ queryKey: qk.profileCard(myId) });
    },
  });
}
