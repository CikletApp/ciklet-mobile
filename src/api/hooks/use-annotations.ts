import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type {
  ProfileAnnotation,
  ProfileAnnotationEntry,
  ProfileAnnotationPatch,
} from "../types";

/**
 * Kullanıcının başkaları hakkında tuttuğu ÖZEL kayıtlar: kişisel not,
 * arkadaş takma adı, yok say (ciklet-web `use-profile-annotations.ts`
 * karşılığı). Karşı taraf bu kayıtları hiçbir yolla göremez.
 *
 * Liste tek istekte gelir ve profil kimliğine göre haritalanır; takma ad
 * kaydedildiği an DM listesi, sohbet başlığı ve profil ekranı aynı cache'i
 * okuduğu için her yerde birden görünür.
 */
export function useAnnotations() {
  const signedIn = useAuth((s) => s.status === "signedIn");
  return useQuery({
    queryKey: qk.annotations,
    enabled: signedIn,
    queryFn: () => api<ProfileAnnotationEntry[]>(endpoints.profileAnnotations),
    select: (entries) => {
      const byProfileId: Record<string, ProfileAnnotation> = {};
      for (const { targetId, nickname, note, ignored } of entries) {
        byProfileId[targetId] = { nickname, note, ignored };
      }
      return byProfileId;
    },
    staleTime: 5 * 60_000,
  });
}

/** Tek profil hakkındaki kayıt; yoksa `undefined`. */
export function useAnnotation(profileId: string | undefined) {
  const { data } = useAnnotations();
  return profileId ? data?.[profileId] : undefined;
}

/** Takma ad haritası — `directDisplay`'e başlık çözümü için verilir. */
export function useNicknames(): Record<string, string> {
  const { data } = useAnnotations();
  return useMemo(() => {
    const nicknames: Record<string, string> = {};
    for (const [profileId, annotation] of Object.entries(data ?? {})) {
      const nickname = annotation.nickname?.trim();
      if (nickname) nicknames[profileId] = nickname;
    }
    return nicknames;
  }, [data]);
}

/**
 * Kaydı yamalar. Gönderilmeyen alan korunur, `null`/boş dizge temizler;
 * uç birleşmiş SON hâli döndürür ve cache doğrudan onunla güncellenir.
 */
export function useSaveAnnotation(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: ProfileAnnotationPatch) => {
      if (!profileId) throw new Error("profileId yok");
      return api<ProfileAnnotation>(endpoints.profileAnnotation(profileId), {
        method: "PUT",
        body: patch,
      });
    },
    onSuccess: (merged) => {
      queryClient.setQueryData<ProfileAnnotationEntry[]>(qk.annotations, (current) => {
        if (!profileId) return current;
        const rest = (current ?? []).filter((entry) => entry.targetId !== profileId);
        const empty = !merged.nickname && !merged.note && !merged.ignored;
        return empty ? rest : [...rest, { targetId: profileId, ...merged }];
      });
    },
  });
}

/** Kaydı cache'te yamalar; boşalan kayıt listeden düşer. */
function patchEntries(
  entries: ProfileAnnotationEntry[] | undefined,
  profileId: string,
  patch: ProfileAnnotationPatch
): ProfileAnnotationEntry[] {
  const current = entries?.find((entry) => entry.targetId === profileId);
  const next: ProfileAnnotationEntry = {
    targetId: profileId,
    nickname: current?.nickname ?? null,
    note: current?.note ?? null,
    ignored: current?.ignored ?? false,
    ...patch,
  };
  const rest = (entries ?? []).filter((entry) => entry.targetId !== profileId);
  const empty = !next.nickname && !next.note && !next.ignored;
  return empty ? rest : [...rest, next];
}

/**
 * Yok say / yok saymayı bırak — liste menüsü gibi profil kimliğinin
 * eylem anında belli olduğu yerler için (değişkenle alır). İyimser: satırın
 * sessiz ikonu yanıt beklemeden değişir.
 */
export function useSetIgnored() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, ignored }: { profileId: string; ignored: boolean }) =>
      api<ProfileAnnotation>(endpoints.profileAnnotation(profileId), {
        method: "PUT",
        body: { ignored },
      }),
    onMutate: async ({ profileId, ignored }) => {
      await queryClient.cancelQueries({ queryKey: qk.annotations });
      const previous = queryClient.getQueryData<ProfileAnnotationEntry[]>(qk.annotations);
      queryClient.setQueryData<ProfileAnnotationEntry[]>(qk.annotations, (current) =>
        patchEntries(current, profileId, { ignored })
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      // Cache hiç dolmamışsa `undefined` geri yazılamaz; sunucudan tazelenir.
      if (context?.previous) queryClient.setQueryData(qk.annotations, context.previous);
      else void queryClient.invalidateQueries({ queryKey: qk.annotations });
    },
    onSuccess: (merged, { profileId }) => {
      queryClient.setQueryData<ProfileAnnotationEntry[]>(qk.annotations, (current) =>
        patchEntries(current, profileId, merged)
      );
    },
  });
}
