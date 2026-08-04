import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Direct,
  DirectWithProfiles,
  PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Doğrudan mesaj sohbetleri.
 *
 * ⚠️ Şema BİREBİR sohbete kilitli (`Direct.profileOneId` / `profileTwoId`).
 * Grup DM'i için ciklet-web tarafında yeni model gerekir — bkz.
 * docs/ROADMAP.md "Bilinen backend boşluğu".
 */
export function useDirects() {
  return useQuery({
    queryKey: qk.directs,
    queryFn: () => api<DirectWithProfiles[]>(endpoints.directs),
  });
}

/**
 * Sohbetin "karşı taraf"ını çözer. İki profil alanından hangisinin
 * karşı taraf olduğu oturum sahibine bağlıdır; bu hesap her liste
 * satırında tekrarlanmasın diye burada yapılır.
 */
export function useDirectPeer(direct: DirectWithProfiles | undefined) {
  const myId = useAuth((s) => s.profile?.id);
  return useMemo<PublicProfile | undefined>(() => {
    if (!direct) return undefined;
    return direct.profileOne.id === myId ? direct.profileTwo : direct.profileOne;
  }, [direct, myId]);
}

export function useDirect(directId: string | undefined) {
  const query = useDirects();
  return {
    ...query,
    data: directId ? query.data?.find((d) => d.id === directId) : undefined,
  };
}

/**
 * Bir kişiyle sohbeti açar (yoksa oluşturur). Profil sayfasındaki
 * "Mesaj" düğmesi ve arkadaş listesindeki hızlı eylem bunu kullanır.
 */
export function useOpenDirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (friendId: string) =>
      api<Direct>(endpoints.directInit, {
        method: "POST",
        body: { friendId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    },
  });
}
