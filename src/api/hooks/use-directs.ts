import { useMemo } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isAfterSnowflake } from "@/lib/snowflake";
import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { DirectPeer, DirectSummary, UnreadCounts } from "../types";
import { useNicknames } from "./use-annotations";
import { useUnreadCounts } from "./use-servers";
import { showToast } from "@/components/ui/toast";
import { clearDirect, patchUnread } from "@/features/unread/unread-cache";

/**
 * Doğrudan mesaj sohbetleri — birebir VE grup.
 *
 * Uç, sohbetleri son mesaj zamanına göre sıralı döner; istemci yeniden
 * sıralamaz (aksi halde sunucunun kararlı sıralaması bozulur).
 */
export function useDirects() {
  // Çağrı katmanı (CallOverlay) kök düzende her zaman bağlı; oturum yokken
  // bu sorgu açılışta boşuna 401 alıyordu.
  const signedIn = useAuth((s) => s.status === "signedIn");
  return useQuery({
    queryKey: qk.directs,
    queryFn: () => api<DirectSummary[]>(endpoints.directs),
    enabled: signedIn,
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
 *
 * `nicknames`: kullanıcının verdiği arkadaş takma adları (profil kimliği →
 * ad; bkz. `useNicknames`). Verilirse birebir başlıkta ve grup üye
 * adlarında gerçek adın ÖNÜNE geçer — web'in DM kenar çubuğuyla aynı kural.
 */
export function directDisplay(
  direct: DirectSummary,
  myId: string | undefined,
  nicknames?: Record<string, string>
): DirectDisplay {
  const nameOf = (profile: DirectPeer) =>
    nicknames?.[profile.id] || profile.name?.trim() || profile.username;

  if (isGroupDirect(direct)) {
    const members = (direct.groupMembers ?? []).map((member) => member.profile);
    const others = members.filter((member) => member.id !== myId);
    // Ad verilmemiş grubu web de üye adlarından türetiyor (`api/inbox`);
    // iki istemcinin aynı grubu farklı adlandırması kafa karıştırır.
    const derived = others.map(nameOf).filter(Boolean).join(", ");
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
    title: isSelf ? "Notlarım" : nameOf(peer),
    imageUrl: peer.imageUrl,
    fallbackText: peer.username,
    isGroup: false,
    isSelf,
    peer,
    members: [],
    isOwner: false,
  };
}

/** `directDisplay`'in hook sarmalayıcısı — takma adları da uygular. */
export function useDirectDisplay(
  direct: DirectSummary | undefined
): DirectDisplay | undefined {
  const myId = useAuth((s) => s.profile?.id);
  const nicknames = useNicknames();
  return useMemo(
    () => (direct ? directDisplay(direct, myId, nicknames) : undefined),
    [direct, myId, nicknames]
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

/**
 * Tek sohbet. Önce liste (taze, okundu imleci var); listede yoksa
 * `useOpenDirect`'in tohumladığı satır — mesajsız birebir sohbeti ve
 * listeden kaldırılıp yeniden açılanı uç listede döndürmüyor.
 * `isListed`: satır listeden mi (tohumda `readCursor` bilinmiyor).
 */
export function useDirect(directId: string | undefined) {
  const query = useDirects();
  const seeded = useQuery<DirectSummary>({
    queryKey: qk.direct(directId ?? ""),
    queryFn: skipToken,
    staleTime: Infinity,
  });
  const listed = directId ? query.data?.find((d) => d.id === directId) : undefined;
  return {
    ...query,
    data: listed ?? (directId ? seeded.data : undefined),
    isListed: Boolean(listed),
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
      api<DirectSummary>(endpoints.directInit, {
        method: "POST",
        body: { friendId },
      }),
    onSuccess: (direct) => {
      // Yanıt iki profili de taşıyor; mesajsız sohbet listede olmadığı için
      // başlık ve karşılama bunu okur. Listeye EKLENMEZ (web de göstermiyor).
      // Okundu imleci burada bilinmiyor; bilerek boş bırakılır.
      if (direct?.id) {
        queryClient.setQueryData<DirectSummary>(qk.direct(direct.id), {
          ...direct,
          latestMessageAt: direct.latestMessageAt ?? null,
          latestMessage: direct.latestMessage ?? null,
        });
      }
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
 *
 * İyimser: satır onaydan hemen sonra düşer, hata olursa geri gelir.
 */
export function useRemoveDirect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (directId: string) =>
      api(endpoints.direct(directId), { method: "DELETE" }),
    onMutate: async (directId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.directs }),
        queryClient.cancelQueries({ queryKey: qk.inbox }),
      ]);
      const directs = queryClient.getQueryData<DirectSummary[]>(qk.directs);
      const inbox = queryClient.getQueryData<InboxItem[]>(qk.inbox);
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current?.filter((item) => item.id !== directId)
      );
      queryClient.setQueryData<InboxItem[]>(qk.inbox, (current) =>
        current?.filter((item) => item.id !== directId)
      );
      // Kaldırılan sohbetin okunmamışı sekme rozetinde kalmasın.
      const unread = queryClient.getQueryData<UnreadCounts>(qk.unreadCounts);
      patchUnread(queryClient, (data) => clearDirect(data, directId));
      return { directs, inbox, unread };
    },
    onError: (_error, _directId, context) => {
      if (context?.directs) queryClient.setQueryData(qk.directs, context.directs);
      if (context?.inbox) queryClient.setQueryData(qk.inbox, context.inbox);
      if (context?.unread) queryClient.setQueryData(qk.unreadCounts, context.unread);
      showToast("Sohbet kaldırılamadı.", "error");
    },
    onSuccess: (_data, directId) => {
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current?.filter((item) => item.id !== directId)
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inbox });
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
    },
  });
}

/**
 * Sohbeti okundu işaretler — web'deki "Okunmuş Olarak İşaretle"
 * (`direct-context-menu.tsx`). İmleç son mesaja taşınır; rozet ve sekme
 * sayısı yanıtı beklemeden düşer.
 *
 * `messageId` sohbete ait OLMALI (yoksa 403) — süresi dolmuş/silinmiş son
 * mesajda geri alınır ve liste tazelenir.
 */
export function useMarkDirectRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { directId: string; messageId: string }) =>
      api(endpoints.readStateAck, { method: "POST", body: input }),
    onMutate: async ({ directId, messageId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.directs }),
        queryClient.cancelQueries({ queryKey: qk.inbox }),
        queryClient.cancelQueries({ queryKey: qk.unreadCounts }),
      ]);
      const directs = queryClient.getQueryData<DirectSummary[]>(qk.directs);
      const inbox = queryClient.getQueryData<InboxItem[]>(qk.inbox);
      const unread = queryClient.getQueryData<UnreadCounts>(qk.unreadCounts);
      queryClient.setQueryData<DirectSummary[]>(qk.directs, (current) =>
        current?.map((item) =>
          item.id === directId ? { ...item, readCursor: messageId } : item
        )
      );
      queryClient.setQueryData<InboxItem[]>(qk.inbox, (current) =>
        current?.filter((item) => item.id !== directId)
      );
      // Rozetlerin kaynağı `/api/unread-counts`; sayaç da hemen düşsün.
      patchUnread(queryClient, (data) => clearDirect(data, directId));
      return { directs, inbox, unread };
    },
    onError: (_error, _input, context) => {
      if (context?.directs) queryClient.setQueryData(qk.directs, context.directs);
      if (context?.inbox) queryClient.setQueryData(qk.inbox, context.inbox);
      if (context?.unread) queryClient.setQueryData(qk.unreadCounts, context.unread);
      showToast("Okundu olarak işaretlenemedi.", "error");
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inbox });
      void queryClient.invalidateQueries({ queryKey: qk.unreadCounts });
    },
  });
}

export interface InboxItem {
  type: string;
  /** directId */
  id: string;
  name: string;
  imageUrl: string | null;
  count: number;
}

/** Okunmamış sohbetler (gruplar dahil) — `/api/inbox`, sayıya göre sıralı. */
export function useInbox() {
  return useQuery({
    queryKey: qk.inbox,
    queryFn: () => api<InboxItem[]>(endpoints.inbox),
    staleTime: 30_000,
  });
}

/**
 * Sohbet başına okunmamış mesaj SAYISI — liste rozetleri ve sekme çubuğu.
 *
 * Kaynak `/api/unread-counts` → `directUnreads` (web DM kenar çubuğu da
 * buradan okuyor; birebir + grup). `/api/inbox` KULLANILMAZ: spam süzgecinden
 * geçiyor (arkadaş olmayanların DM'leri düşüyor) ve 8 sohbetle kesik.
 * Kayıt yoksa sohbet okunmuş sayılır; not sohbeti sayılmaz.
 */
export function useDirectUnreadCounts() {
  const { data } = useUnreadCounts();
  const { data: directs } = useDirects();
  return useMemo(() => {
    const selfId = directs?.find(isSelfDirect)?.id;
    const counts: Record<string, number> = {};
    let total = 0;
    let chats = 0;
    for (const [directId, count] of Object.entries(data?.directUnreads ?? {})) {
      if (directId === selfId || !(count > 0)) continue;
      counts[directId] = count;
      total += count;
      chats += 1;
    }
    /**
     * `chats`: okunmamış mesajı olan sohbet sayısı — sekme rozeti bunu gösterir.
     * `ready`: sayılar geldi mi; gelmeden satırlar imleçten tahmin edilir.
     */
    return { counts, total, chats, ready: data !== undefined };
  }, [data, directs]);
}

/** Satır okunmamış mı: sayılar geldiyse onlar, gelmediyse okundu imleci. */
export function isDirectUnread(
  direct: DirectSummary,
  myId: string | undefined,
  unread: { counts: Record<string, number>; ready: boolean }
): boolean {
  return unread.ready ? (unread.counts[direct.id] ?? 0) > 0 : hasUnread(direct, myId);
}
