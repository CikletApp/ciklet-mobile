import type { QueryClient } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ChatKind } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ChatMessagePayload } from "@/realtime/events";
import { useOutbox } from "@/stores/outbox";
import type { MessageCache } from "./reaction-cache";

/**
 * Sohbet önbelleğini sunucunun EN YENİ sayfasıyla eşitler.
 *
 * Sorun: geçmiş sorgusu `staleTime: Infinity` (canlı akış önbelleği güncel
 * tutuyor diye) ve canlı akış yalnızca sohbet AÇIKKEN yazıyor. Sohbetten
 * çıktıktan sonra gelen mesajlar önbelleğe hiç girmiyor, geri dönünce de
 * önbellek "taze" sayılıp yeniden çekilmiyordu: listede son mesaj görünüyor,
 * sohbette görünmüyordu.
 *
 * Çözüm: sohbet her açıldığında ve arka planda DM bildirimi geldiğinde en
 * yeni sayfa çekilip önbellekte olmayanlar başa eklenir. Sayfanın TAMAMI
 * yeniyse aradaki boşluk bir sayfadan büyük olabilir; o zaman parça
 * eklemek ortada delik bırakır, geçmiş baştan çekilsin diye sorgu bayat
 * işaretlenir.
 */

export type MergeResult = "merged" | "unchanged" | "gap" | "seeded" | "skipped";

export function mergeNewestPage(
  queryClient: QueryClient,
  chatId: string,
  page: MessagesPage<ChatMessagePayload>,
  { seedIfEmpty = false }: { seedIfEmpty?: boolean } = {}
): MergeResult {
  const key = qk.messages.chat(chatId);
  const old = queryClient.getQueryData<MessageCache>(key);
  if (!old?.pages?.length) {
    // İlk yükleme normalde `useChatMessages`'ın işi. Arka plan eşitlemesi
    // ise sayfayı "ilk sayfa" olarak yazabilir: imleci sunucudan geldiği
    // için daha eski sayfalar da doğru yüklenir.
    if (!seedIfEmpty) return "skipped";
    queryClient.setQueryData<MessageCache>(key, { pages: [page], pageParams: [undefined] });
    return "seeded";
  }
  const known = new Set(old.pages.flatMap((p) => p.items.map((item) => item.id)));
  const fresh = page.items.filter((item) => !known.has(item.id));
  if (fresh.length > 0 && fresh.length === page.items.length) {
    void queryClient.invalidateQueries({ queryKey: key });
    return "gap";
  }
  // Sohbet kapalıyken düzenlenen, tepki alan ya da silinen (mezar taşı)
  // mesajlar: en yeni sayfadaki her mesajın sunucu sürümü önbelleğe yazılır.
  const serverCopy = new Map(page.items.map((item) => [item.id, item]));
  let changed = fresh.length > 0;
  for (const item of fresh) useOutbox.getState().resolveByContent(chatId, item.content);
  queryClient.setQueryData<MessageCache>(key, (current) => {
    if (!current?.pages?.length) return current;
    const seen = new Set<string>();
    const pages = current.pages.map((p) => ({
      ...p,
      items: p.items.map((item) => {
        seen.add(item.id);
        const next = serverCopy.get(item.id);
        if (!next || JSON.stringify(next) === JSON.stringify(item)) return item;
        changed = true;
        return next;
      }),
    }));
    const add = fresh.filter((item) => !seen.has(item.id));
    if (add.length > 0) pages[0] = { ...pages[0], items: [...add, ...pages[0].items] };
    return changed ? { ...current, pages } : current;
  });
  return changed ? "merged" : "unchanged";
}

/** Sohbet başına tek uçuşta istek; sürerken gelen ikinci çağrı bir kez daha çalıştırılır. */
const inflight = new Map<string, { promise: Promise<void>; again: boolean }>();

export function syncLatestMessages(
  queryClient: QueryClient,
  kind: ChatKind,
  chatId: string,
  options: { seedIfEmpty?: boolean } = {}
): Promise<void> {
  const running = inflight.get(chatId);
  if (running) {
    running.again = true;
    return running.promise;
  }
  const entry = { again: false, promise: Promise.resolve() };
  entry.promise = (async () => {
    try {
      do {
        entry.again = false;
        try {
          const page = await api<MessagesPage<ChatMessagePayload>>(
            kind === "channel" ? endpoints.channelMessages(chatId) : endpoints.directMessages(chatId)
          );
          mergeNewestPage(queryClient, chatId, page, options);
        } catch {
          // Ağ yok ya da erişim kalktı; bir sonraki açılış/yoklama yeniden dener.
          return;
        }
      } while (entry.again);
    } finally {
      inflight.delete(chatId);
    }
  })();
  inflight.set(chatId, entry);
  return entry.promise;
}
