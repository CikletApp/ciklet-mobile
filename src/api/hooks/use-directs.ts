import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Direct } from "@ciklet/embedded-activities-sdk/types";

import { isAfterSnowflake } from "@/lib/snowflake";
import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { DirectPeer, DirectSummary } from "../types";

/**
 * Doğrudan mesaj sohbetleri — birebir VE grup.
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

/** ciklet-web'in grup üst sınırı (`api/directs/groups/route.ts`). */
export const MAX_GROUP_MEMBERS = 10;

/** Grup adı üst sınırı — uç 100 karakteri aşarsa 400 döner. */
export const MAX_GROUP_NAME_LENGTH = 100;

/** Sohbet bir grup mu. */
export function isGroupDirect(direct: DirectSummary): boolean {
  return direct.isGroup === true;
}

/**
 * Kendinle sohbet ("Notlarım").
 *
 * ciklet-web `getOrCreateDirect`'te `profileAId === profileBId` durumunu
 * bilerek serbest bırakıyor — kişisel not defteri özelliği bu.
 *
 * ⚠️ `isGroup` kontrolü ŞART. ciklet-web grup satırlarında `profileOneId` ve
 * `profileTwoId` alanlarının İKİSİNİ DE sahibe bağlıyor
 * (`api/directs/groups/route.ts`); yani yalnızca iki kimliğe bakan bir
 * kontrol HER GRUP İÇİN true döner. Bu kontrol eksikken gruplar sohbet
 * listesinden eleniyor ve ilk grup "Notlarım" diye açılıyordu.
 */
export function isSelfDirect(direct: DirectSummary): boolean {
  return !isGroupDirect(direct) && direct.profileOne.id === direct.profileTwo.id;
}

/** Kendi not sohbetin — henüz açılmadıysa `undefined`. */
export function useSelfDirect() {
  const query = useDirects();
  return {
    ...query,
    data: query.data?.find(isSelfDirect),
  };
}

/** DM listesi — not sohbeti hariç, gruplar dahil. */
export function useConversationList() {
  const query = useDirects();
  const conversations = useMemo(
    () => (query.data ?? []).filter((direct) => !isSelfDirect(direct)),
    [query.data]
  );
  return { ...query, conversations };
}

// ── Görüntüleme çözümü ──────────────────────────────────────────────

/**
 * Bir sohbetin nasıl çizileceği: başlık, avatar, karşı taraf.
 *
 * Birebir sohbette "karşı taraf" iki profil alanından oturum sahibi olmayanı;
 * grupta ise böyle bir taraf YOK ve başlık ya grubun adından ya üye
 * adlarından türer. Bu ayrım daha önce beş ayrı çağrı yerinde tekrarlanıyor
 * ve grup satırlarında hepsinde yanlış sonuç veriyordu; tek yer olsun diye
 * buraya toplandı.
 */
export interface DirectDisplay {
  /** Listede ve sohbet başlığında gösterilecek ad. */
  title: string;
  /** Avatar görseli — grupta grubun, birebirde karşı tarafın. */
  imageUrl: string | null;
  /** Avatar harf yedeği. */
  fallbackText: string;
  isGroup: boolean;
  /** Kendinle sohbet mi ("Notlarım"). */
  isSelf: boolean;
  /** Birebir sohbette karşı taraf; grupta `undefined`. */
  peer: DirectPeer | undefined;
  /** Grup üyeleri (oturum sahibi dahil); birebirde boş. */
  members: DirectPeer[];
  /** Oturum sahibi grubun sahibi mi — yalnızca sahip düzenleyebilir. */
  isOwner: boolean;
}

/**
 * Hook dışında da çağrılabilsin diye saf fonksiyon (liste `renderItem`'ı,
 * bildirim başlığı, arama sonucu…).
 */
export function directDisplay(
  direct: DirectSummary,
  myId: string | undefined
): DirectDisplay {
  if (isGroupDirect(direct)) {
    const members = (direct.groupMembers ?? []).map((member) => member.profile);
    const others = members.filter((member) => member.id !== myId);
    // Ad verilmemiş grubu web de üye adlarından türetiyor (`api/inbox`);
    // iki istemcinin aynı grubu farklı adlandırması kafa karıştırır.
    const derived = others
      .map((member) => member.name?.trim() || member.username)
      .filter(Boolean)
      .join(", ");
    const title = direct.name?.trim() || derived || "Grup Sohbeti";
    return {
      title,
      imageUrl: direct.imageUrl ?? null,
      fallbackText: title,
      isGroup: true,
      isSelf: false,
      peer: undefined,
      members,
      isOwner: Boolean(myId) && direct.ownerId === myId,
    };
  }

  const peer =
    direct.profileOne.id === myId ? direct.profileTwo : direct.profileOne;
  const isSelf = isSelfDirect(direct);

  return {
    title: isSelf ? "Notlarım" : peer.name?.trim() || peer.username,
    imageUrl: peer.imageUrl,
    fallbackText: peer.username,
    isGroup: false,
    isSelf,
    peer,
    members: [],
    isOwner: false,
  };
}

/** `directDisplay`'in hook sarmalayıcısı. */
export function useDirectDisplay(
  direct: DirectSummary | undefined
): DirectDisplay | undefined {
  const myId = useAuth((s) => s.profile?.id);
  return useMemo(
    () => (direct ? directDisplay(direct, myId) : undefined),
    [direct, myId]
  );
}

/**
 * Birebir sohbetin karşı tarafı.
 *
 * ⚠️ Grupta `undefined` döner — arama, profil açma gibi "karşı taraf"
 * gerektiren eylemler grupta zaten anlamsız ve çağıran bunu görmek zorunda.
 */
export function useDirectPeer(direct: DirectSummary | undefined) {
  return useDirectDisplay(direct)?.peer;
}

export function useDirect(directId: string | undefined) {
  const query = useDirects();
  return {
    ...query,
    data: directId ? query.data?.find((d) => d.id === directId) : undefined,
  };
}

// ── Okunmamış durumu ────────────────────────────────────────────────

/**
 * Bir sohbette okunmamış var mı.
 *
 * ADR-0002 ile okundu imleci mesajların yanına taşındı: uç artık
 * `readStates` dizisi değil TEK bir `readCursor` snowflake'i döndürüyor
 * (`ciklet-web/src/lib/direct.ts`). Eski kod hâlâ `readStates` aradığı için
 * imleç her zaman `undefined` çıkıyor ve son mesajı olan HER sohbet
 * okunmamış görünüyordu.
 *
 * Karar, sunucudaki `unreadCounts()` ile AYNI üç kuralı uygular:
 *   1. kendi mesajın sana hiç okunmamış değildir,
 *   2. silinmiş mesaj saymaz,
 *   3. imleçten SONRAKİ mesaj okunmamıştır.
 *
 * ⚠️ Karşılaştırma `compareSnowflake` ile; `Number` snowflake'i sessizce
 * yuvarlar (bkz. `lib/snowflake.ts`).
 */
export function hasUnread(
  direct: DirectSummary,
  myId: string | undefined
): boolean {
  const latest = direct.latestMessage;
  if (!latest || !myId) return false;
  if (latest.deleted) return false;
  if (latest.profileId === myId) return false;
  // İmleç hiç yoksa sohbet hiç açılmamıştır: son mesaj okunmamıştır.
  if (!direct.readCursor) return true;
  return isAfterSnowflake(latest.id, direct.readCursor);
}

// ── Mutasyonlar ─────────────────────────────────────────────────────

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

/**
 * Grup sohbeti oluşturur.
 *
 * Uç yalnızca ARKADAŞLARIN eklenmesine izin veriyor ve toplam kişi sayısını
 * `MAX_GROUP_MEMBERS` ile sınırlıyor; arayüz seçimi baştan bu kurallara göre
 * kısıtlar, aksi halde kullanıcı ancak gönderdikten sonra 403/400 görür.
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { memberIds: string[]; name?: string }) =>
      api<DirectSummary>(endpoints.createGroupDirect, {
        method: "POST",
        body: {
          memberIds: input.memberIds,
          name: input.name?.trim() || undefined,
        },
      }),
    onSuccess: (created) => {
      // Yeni grup listede HEMEN görünsün: uç yeni satırı zaten döndürüyor,
      // yalnızca invalidate etmek yeniden çekim süresince boşluk bırakırdı.
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current
          ? [created, ...current.filter((d) => d.id !== created.id)]
          : [created]
      );
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    },
  });
}

/**
 * Grubun adını ve üye listesini günceller.
 *
 * ⚠️ Uç YALNIZCA GRUP SAHİBİNE izin veriyor (başkasına 403) ve `memberIds`
 * eklenecek/çıkarılacak FARK DEĞİL, TAM LİSTEDİR (oturum sahibi hariç) —
 * eksik gönderilen üye gruptan çıkarılır.
 */
export function useUpdateGroup(directId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string; memberIds?: string[] }) => {
      if (!directId) throw new Error("directId yok");
      return api<DirectSummary>(endpoints.groupDirect(directId), {
        method: "PATCH",
        body: input,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current?.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
      );
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    },
  });
}

/**
 * Sohbeti listeden kaldırır.
 *
 * Aynı uç iki farklı şey yapıyor ve çağıranın bunu BİLMESİ gerekiyor:
 *   • birebir sohbette YUMUŞAK silme — yalnızca senin listenden düşer,
 *     karşı taraf konuşmayı görmeye devam eder;
 *   • grupta GRUPTAN AYRILMA — üyelikten çıkarsın, son üyeysen grup silinir,
 *     sahibiysen sahiplik kalan ilk üyeye geçer.
 *
 * Onay metni bu yüzden çağrı yerinde gruba göre değişir.
 */
export function useRemoveDirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (directId: string) =>
      api(endpoints.direct(directId), { method: "DELETE" }),
    onSuccess: (_data, directId) => {
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current?.filter((item) => item.id !== directId)
      );
    },
  });
}
