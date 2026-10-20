/**
 * Gönderim kuyruğunun SAF kuralları (sıra, bekleme, yeniden deneme) —
 * `scripts/verify-local-store.mjs` ile doğrulanır; içe aktarma yok.
 *
 * Kurallar (WhatsApp'taki saat simgesi davranışı):
 *  - Aynı sohbette mesajlar YAZILDIKLARI SIRAYLA gider: sıradaki bekleyen
 *    ya da uçuştaki bir mesaj, ondan sonrakileri bekletir.
 *  - Kalıcı olarak başarısız olan ("failed") mesaj sırayı TIKAMAZ —
 *    kullanıcı onu tekrar dener ya da siler, sonrakiler gitmeye devam eder.
 *  - Ağ hatası deneme sayılmaz (bağlantı gelince yine gider); sunucu hatasında (5xx/429)
 *    üstel bekleme ile denenir, sınırı aşınca "failed" olur.
 */

export type OutboxStatus = "queued" | "sending" | "failed";

export interface QueueEntryLike {
  id: string;
  chatId: string;
  createdAt: string;
  status: OutboxStatus;
  /** Bu zamandan önce denenmez (ms). */
  nextAttemptAt?: number;
}

/** Sunucu hatasında en çok bu kadar deneme; ağ hatası sayılmaz. */
export const MAX_SERVER_ATTEMPTS = 6;

/** 1 sn, 2 sn, 4 sn … en çok 60 sn; `jitter` 0–1 (aynı anda tekrar deneyen istemciler dağılsın). */
export function backoffMs(attempt: number, jitter = 0.5): number {
  const base = Math.min(1000 * 2 ** Math.max(0, attempt), 60_000);
  return Math.round(base * (0.75 + 0.5 * Math.min(1, Math.max(0, jitter))));
}

function byCreated(a: QueueEntryLike, b: QueueEntryLike) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;
}

/** Her sohbetin sıradaki (henüz başarısız olmamış) en eski mesajı. */
export function queueHeads<T extends QueueEntryLike>(entries: readonly T[]): T[] {
  const heads = new Map<string, T>();
  for (const entry of [...entries].sort(byCreated)) {
    if (entry.status === "failed") continue;
    if (!heads.has(entry.chatId)) heads.set(entry.chatId, entry);
  }
  return [...heads.values()].sort(byCreated);
}

/** Şimdi gönderilebilecek en eski mesaj; yoksa null. Uçuşta olan sohbetler beklenir. */
export function nextSendable<T extends QueueEntryLike>(entries: readonly T[], now: number): T | null {
  for (const head of queueHeads(entries)) {
    if (head.status !== "queued") continue;
    if ((head.nextAttemptAt ?? 0) <= now) return head;
  }
  return null;
}

/** Bir sonraki denemenin zamanı (bekleyen başlar arasında en erken); yoksa null. */
export function nextWakeAt(entries: readonly QueueEntryLike[], now: number): number | null {
  let wake: number | null = null;
  for (const head of queueHeads(entries)) {
    if (head.status !== "queued") continue;
    const at = Math.max(now, head.nextAttemptAt ?? 0);
    if (wake === null || at < wake) wake = at;
  }
  return wake;
}
