import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Direct } from "@ciklet/embedded-activities-sdk/types";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { DirectPeer, DirectSummary } from "../types";

/**
 * Doğrudan mesaj sohbetleri.
 *
 * ⚠️ Şema BİREBİR sohbete kilitli (`Direct.profileOneId` / `profileTwoId`).
 * Grup DM'i için ciklet-web tarafında yeni model gerekir — bkz.
 * docs/ROADMAP.md "Bilinen backend boşluğu".
 *
 * Uç, sohbetleri son mesaj zamanına göre sıralı döner; istemci yeniden
 * sıralamaz (aksi halde sunucunun kararlı sıralaması bozulur).
 */
export function useDirects() {
  return useQuery({
    queryKey: qk.directs,
    queryFn: () => api<DirectSummary[]>(endpoints.directs),
  });
}

/**
 * Kendinle sohbet ("Notlarım").
 *
 * ciklet-web `getOrCreateDirect`'te `profileAId === profileBId` durumunu
 * bilerek serbest bırakıyor — kişisel not defteri özelliği bu. Web bunu
 * DM listesinden GİZLEYİP ayrı bir "Notlarım" satırı olarak gösteriyor
 * (directs-sidebar.tsx); mobil de aynısını yapar, aksi halde kullanıcı
 * mesaj listesinde kendini görüyor.
 */
export function isSelfDirect(direct: DirectSummary): boolean {
  return direct.profileOne.id === direct.profileTwo.id;
}

/** Kendi not sohbetin — henüz açılmadıysa `undefined`. */
export function useSelfDirect() {
  const query = useDirects();
  return {
    ...query,
    data: query.data?.find(isSelfDirect),
  };
}

/** DM listesi — not sohbeti hariç. */
export function useConversationList() {
  const query = useDirects();
  const conversations = useMemo(
    () => (query.data ?? []).filter((direct) => !isSelfDirect(direct)),
    [query.data]
  );
  return { ...query, conversations };
}

/**
 * Sohbetin "karşı taraf"ını çözer. İki profil alanından hangisinin karşı
 * taraf olduğu oturum sahibine bağlıdır; bu hesap her liste satırında
 * tekrarlanmasın diye burada yapılır.
 */
export function useDirectPeer(direct: DirectSummary | undefined) {
  const myId = useAuth((s) => s.profile?.id);
  return useMemo<DirectPeer | undefined>(() => {
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
 * Bir sohbette okunmamış var mı.
 *
 * Uç mesaj sayısı vermiyor; yalnızca son mesaj zamanı ile kendi okuma
 * imlecimiz karşılaştırılabiliyor. Bu yüzden sayı değil ikili bir durum
 * döner — arayüz nokta gösterir, rakam değil.
 */
export function hasUnread(direct: DirectSummary, myId: string | undefined): boolean {
  if (!direct.latestMessageAt || !myId) return false;
  const lastRead = direct.readStates?.find((r) => r.profileId === myId)?.lastReadAt;
  if (!lastRead) return true;
  return new Date(direct.latestMessageAt).getTime() > new Date(lastRead).getTime();
}

/**
 * Bir kişiyle sohbeti açar (yoksa oluşturur). Profil sayfasındaki "Mesaj"
 * düğmesi ve arkadaş listesindeki hızlı eylem bunu kullanır.
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
