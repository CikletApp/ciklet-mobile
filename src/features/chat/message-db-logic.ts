/**
 * Yerel mesaj deposunun SAF kuralları — veritabanı ve React'ten bağımsız,
 * `scripts/verify-local-store.mjs` ile doğrulanır. Bu dosya bilinçli olarak
 * hiçbir modül içe aktarmıyor (Node doğrudan çalıştırabilsin).
 *
 * Temel değişmez: bir sohbet için cihazda tutulan mesajlar, sunucudaki
 * geçmişin EN YENİ uçtan geriye BOŞLUKSUZ bir kesimidir. Ekran bu kesimden
 * sayfa okuduğunda ortada "delik" görmez; kesimin bittiği yerden sonrası
 * `next_cursor` ile sunucudan istenir.
 */

/** Depolama kuralları için gereken en dar mesaj biçimi. */
export interface StoredMessageLike {
  id: string;
  createdAt?: string | Date | null;
  expiresAt?: string | null;
}

export interface PageLike<T> {
  items: T[];
  nextCursor?: string | null;
}

/** Snowflake karşılaştırması (lib/snowflake ile aynı kural; bağımlılıksız kopya). */
export function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function timeOf(message: StoredMessageLike): number {
  const raw = message.createdAt;
  const at = raw instanceof Date ? raw.getTime() : typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isFinite(at) ? at : 0;
}

export function expiryAt(message: StoredMessageLike): number | null {
  const raw = (message as { expiresAt?: unknown }).expiresAt;
  if (typeof raw !== "string" || !raw) return null;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? at : null;
}

/** En yeni önce: zaman, eşitlikte kimlik. */
export function newestFirst(a: StoredMessageLike, b: StoredMessageLike): number {
  return timeOf(b) - timeOf(a) || compareIds(b.id, a.id);
}

export interface Segment<T> {
  /** En yeni önce. */
  items: T[];
  /** Kesimin en eskisinden geriye sunucu imleci; null = geçmişin başına ulaşıldı. */
  cursor: string | null;
}

/**
 * Sorgu önbelleğindeki sayfalardan (en yeni sayfa başta, sayfa içi en yeni
 * önce) diske yazılacak kesim. Süresi dolanlar düşer, en çok `cap` mesaj.
 * Kesilirse imleç, tutulan en eski mesajın kimliği olur (sunucu imleci de
 * "bu kimlikten eskiler" demek).
 */
export function snapshotSegment<T extends StoredMessageLike>(
  pages: readonly PageLike<T>[] | undefined,
  cap: number,
  now: number
): Segment<T> | null {
  if (!pages?.length) return null;
  const seen = new Set<string>();
  const items: T[] = [];
  let truncated = false;
  outer: for (const page of pages) {
    for (const item of page.items ?? []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const expires = expiryAt(item);
      if (expires !== null && expires <= now) continue;
      if (items.length >= cap) {
        truncated = true;
        break outer;
      }
      items.push(item);
    }
  }
  if (items.length === 0) return null;
  const last = pages[pages.length - 1];
  return {
    items,
    cursor: truncated ? items[items.length - 1].id : (last?.nextCursor ?? null),
  };
}

export interface WritePlan {
  /** Kesimin zaman aralığında olup yeni kopyada bulunmayanlar (silinmiş / süresi dolmuş). */
  deleteIds: string[];
  /** Kesimden daha eski satırlar da silinsin mi (örtüşme yok ya da geçmişin başına ulaşıldı). */
  deleteOlder: boolean;
  nextCursor: string | null;
}

/**
 * Yeni anlık görüntü diskteki kesimle nasıl birleşir.
 *
 *  - `overlap`: anlık görüntünün EN ESKİ mesajı diskte var. Diskteki
 *    kesim boşluksuz olduğu için ondan eskiler de yeniyle bitişik:
 *    korunur, imleç diskteki kalır.
 *  - Örtüşme yoksa arada boşluk olabilir: eski kesim atılır, yerine yalnızca
 *    yeni görüntü yazılır (değişmez bozulmasın diye).
 *
 * `storedInRange`: diskte, anlık görüntünün en eski mesajının zamanından
 * yeni ya da eşit olan kimlikler.
 */
export function planSegmentWrite(input: {
  snapshotIds: ReadonlySet<string>;
  snapshotCursor: string | null;
  overlap: boolean;
  storedInRange: readonly string[];
  storedCursor: string | null | undefined;
}): WritePlan {
  const deleteIds = input.storedInRange.filter((id) => !input.snapshotIds.has(id));
  const reachedStart = input.snapshotCursor === null;
  if (input.overlap && !reachedStart) {
    return { deleteIds, deleteOlder: false, nextCursor: input.storedCursor ?? input.snapshotCursor };
  }
  return { deleteIds, deleteOlder: true, nextCursor: input.snapshotCursor };
}

export interface ChatUsage {
  chatId: string;
  lastAccess: number;
  bytes: number;
}

/**
 * LRU temizliği: sohbet sayısı ve toplam boyut sınırını aşan, EN UZUN
 * SÜREDİR açılmamış sohbetler (bütün kesimleriyle) atılır. `keep` (ör. açık
 * sohbet) asla atılmaz.
 */
export function pickEvictions(
  chats: readonly ChatUsage[],
  limits: { maxChats: number; maxBytes: number },
  keep: ReadonlySet<string> = new Set()
): string[] {
  const ordered = [...chats].sort((a, b) => a.lastAccess - b.lastAccess);
  let count = chats.length;
  let bytes = chats.reduce((sum, chat) => sum + chat.bytes, 0);
  const evict: string[] = [];
  for (const chat of ordered) {
    if (count <= limits.maxChats && bytes <= limits.maxBytes) break;
    if (keep.has(chat.chatId)) continue;
    evict.push(chat.chatId);
    count -= 1;
    bytes -= chat.bytes;
  }
  return evict;
}
