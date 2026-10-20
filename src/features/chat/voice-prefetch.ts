import type { QueryClient } from "@tanstack/react-query";

import { qk } from "@/api/query-keys";
import { readVoice } from "@/lib/message-extras";
import { PREFETCH_MAX_BYTES, prefetchVoice } from "@/lib/media-cache";
import { pickVoiceTargets, type VoiceCandidate } from "@/lib/media-prefetch-logic";
import type { MessageCache } from "./reaction-cache";

/**
 * Sesli mesajlar sohbete düştüğü anda ARKADA iner (WhatsApp): kullanıcı
 * dokunduğunda indirmeyi beklemez, yerel dosyadan hemen ve ağsız çalar.
 *
 * Sohbet önbelleklerini izler — cihazdaki kopyadan ilk sayfa (`added`),
 * sunucu sayfası, sayfalama ve canlı akışla gelen yeni mesaj (`updated`) —
 * ve her sohbetin EN YENİ {@link PER_CHAT} sesli mesajını kuyruğa verir
 * (`lib/media-cache` › `prefetchVoice`). Dev bir geçmişin tamamı inmesin
 * diye yalnızca en yeni {@link SCAN_LIMIT} mesaja bakılır; canlı gelenler
 * hep en yenidir, bu yüzden her zaman kapsamdadır ve önce iner.
 */

const PER_CHAT = 50;
const SCAN_LIMIT = 600;
/** Canlı akış her mesajda önbelleği yazar; tarama sohbet başına toplanır. */
const SCAN_DELAY_MS = 400;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let stop: (() => void) | null = null;

const isVoice = (message: VoiceCandidate) => readVoice(message.metadata) !== null;

function scan(queryClient: QueryClient, chatId: string) {
  timers.delete(chatId);
  const data = queryClient.getQueryData<MessageCache>(qk.messages.chat(chatId));
  if (!data?.pages?.length) return;
  prefetchVoice(
    pickVoiceTargets(data.pages, {
      maxTargets: PER_CHAT,
      maxScan: SCAN_LIMIT,
      maxBytes: PREFETCH_MAX_BYTES,
      isVoice,
      now: Date.now(),
    })
  );
}

/** Kök düzende bir kez çağrılır; dönen fonksiyon izlemeyi durdurur. */
export function startVoicePrefetch(queryClient: QueryClient): () => void {
  stop?.();
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "added" && !(event.type === "updated" && event.action.type === "success")) return;
    const key = event.query.queryKey as readonly unknown[];
    if (key[0] !== "messages" || typeof key[1] !== "string" || key[1] === "yok" || key.length !== 2) return;
    const chatId = key[1];
    if (timers.has(chatId)) return;
    timers.set(
      chatId,
      setTimeout(() => scan(queryClient, chatId), SCAN_DELAY_MS)
    );
  });
  const current = () => {
    unsubscribe();
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    if (stop === current) stop = null;
  };
  stop = current;
  return current;
}
