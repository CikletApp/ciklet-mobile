import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OwnProfile } from "@ciklet/embedded-activities-sdk/types";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  CurrentProfile,
  MembershipWithServer,
  ProfileCardResponse,
  UpdateMemberProfileInput,
  UpdateProfileInput,
} from "../types";

/** Kendi profilin — ayarlar ve profil düzenleme ekranlarının kaynağı. */
export function useCurrentProfile() {
  return useQuery({
    queryKey: qk.currentProfile,
    queryFn: () => api<CurrentProfile>(endpoints.currentProfile),
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
    queryFn: () => api<ProfileCardResponse>(endpoints.profileCard(profileId!)),
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
