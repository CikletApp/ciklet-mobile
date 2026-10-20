import { AppState } from "react-native";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";
import type { SQLiteDatabase } from "expo-sqlite";

import { enqueueWrite, localDb } from "@/lib/local-db";
import type { ChatMessagePayload } from "@/realtime/events";
import { activeChatId } from "@/stores/active-chat";
import {
  expiryAt,
  pickEvictions,
  planSegmentWrite,
  snapshotSegment,
  timeOf,
  type Segment,
} from "./message-db-logic";
import type { MessageCache } from "./reaction-cache";

/**
 * Mesajlar CİHAZDA — yerel SQLite (`lib/local-db`, WhatsApp `msgstore.db`
 * karşılığı). Bkz. docs/YEREL-DEPO.md.
 *
 * Genel sorgu önbelleği mesaj geçmişini diske yazmıyor; bu modül sohbet
 * önbelleklerini izler ve her sohbetin EN YENİ uçtan geriye boşluksuz
 * kesimini (en çok {@link MESSAGES_PER_CHAT}) saklar:
 *
 *  - Sohbet açılınca ilk sayfa diskten EŞZAMANLI okunur ({@link storedMessages})
 *    ve ağ beklenmeden çizilir; tazelik `message-sync` eşitlemesiyle gelir
 *    (eksikler eklenir, büyük boşlukta geçmiş baştan çekilir).
 *  - Eski sayfalar önce diskten ({@link readStoredPage}), kesim bitince
 *    sunucudan.
 *  - Süresi dolan (kaybolan) mesaj diskten de silinir.
 *  - Sohbet sayısı ve toplam boyut sınırlı; en uzun süredir açılmayan
 *    sohbetler (LRU) atılır.
 *
 * Yazmalar sohbet başına ertelenir ve tek işlemde (transaction) yapılır;
 * uygulama arka plana geçerken bekleyenler hemen yazılır. Çıkışta her şey
 * silinir (`clearStoredMessages`).
 */

export const LOCAL_PAGE_SIZE = 50;
const MESSAGES_PER_CHAT = 1000;
const MAX_CHATS = 300;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const WRITE_DELAY_MS = 1_500;
/** Bu kadar yazmada bir LRU temizliği. */
const EVICT_EVERY_WRITES = 25;

type Message = ChatMessagePayload;
type StoredData = InfiniteData<MessagesPage<Message>, string | undefined>;

const ORDER = "ORDER BY created_at DESC, length(id) DESC, id DESC";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, Segment<Message>>();
/** Bu oturumda yazılmış satırların JSON'u — değişmeyen satır yeniden yazılmaz. */
const written = new Map<string, Map<string, string>>();
let writesSinceEvict = 0;
let stopWatching: (() => void) | null = null;
let generation = 0;

function parse(rows: { json: string }[]): Message[] {
  const out: Message[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.json) as Message);
    } catch {
      /* bozuk satır atlanır */
    }
  }
  return out;
}

function touch(chatId: string) {
  const now = Date.now();
  void enqueueWrite(async (db) => {
    await db.runAsync("UPDATE chats SET last_access = ? WHERE chat_id = ?", now, chatId);
  });
}

/** `useChatMessages` için ilk veri: varsa cihazdaki en yeni sayfa (eşzamanlı, birkaç ms). */
export function storedMessages(chatId: string): StoredData | undefined {
  const db = localDb();
  if (!db) return undefined;
  try {
    const now = Date.now();
    const rows = db.getAllSync<{ json: string }>(
      `SELECT json FROM messages WHERE chat_id = ? AND (expires_at IS NULL OR expires_at > ?) ${ORDER} LIMIT ?`,
      chatId,
      now,
      LOCAL_PAGE_SIZE + 1
    );
    if (rows.length === 0) return undefined;
    const chat = db.getFirstSync<{ next_cursor: string | null }>(
      "SELECT next_cursor FROM chats WHERE chat_id = ?",
      chatId
    );
    const items = parse(rows.slice(0, LOCAL_PAGE_SIZE));
    if (items.length === 0) return undefined;
    const more = rows.length > LOCAL_PAGE_SIZE;
    const endCursor = chat ? chat.next_cursor : items[items.length - 1].id;
    touch(chatId);
    return {
      pages: [{ items, nextCursor: more ? items[items.length - 1].id : endCursor }],
      pageParams: [undefined],
    };
  } catch {
    return undefined;
  }
}

export function storedAt(chatId: string): number | undefined {
  try {
    return (
      localDb()?.getFirstSync<{ saved_at: number }>("SELECT saved_at FROM chats WHERE chat_id = ?", chatId)?.saved_at ??
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * `cursor` kimlikli mesajdan eski bir sayfa — diskteki kesimden. İmleç
 * kesimde yoksa ya da kesim bittiyse (ve geçmişin başı değilse) null:
 * çağıran sunucudan ister.
 */
export async function readStoredPage(chatId: string, cursor: string): Promise<MessagesPage<Message> | null> {
  const db = localDb();
  if (!db) return null;
  try {
    const anchor = await db.getFirstAsync<{ created_at: number }>(
      "SELECT created_at FROM messages WHERE chat_id = ? AND id = ?",
      chatId,
      cursor
    );
    if (!anchor) return null;
    const rows = await db.getAllAsync<{ json: string }>(
      `SELECT json FROM messages WHERE chat_id = ?
         AND (created_at < ? OR (created_at = ? AND (length(id) < ? OR (length(id) = ? AND id < ?))))
         AND (expires_at IS NULL OR expires_at > ?)
       ${ORDER} LIMIT ?`,
      chatId,
      anchor.created_at,
      anchor.created_at,
      cursor.length,
      cursor.length,
      cursor,
      Date.now(),
      LOCAL_PAGE_SIZE + 1
    );
    const chat = await db.getFirstAsync<{ next_cursor: string | null }>(
      "SELECT next_cursor FROM chats WHERE chat_id = ?",
      chatId
    );
    const reachedStart = chat !== null && chat.next_cursor === null;
    if (rows.length === 0) return reachedStart ? { items: [], nextCursor: null } : null;
    const items = parse(rows.slice(0, LOCAL_PAGE_SIZE));
    const more = rows.length > LOCAL_PAGE_SIZE;
    const last = items[items.length - 1]?.id ?? null;
    return { items, nextCursor: more || !reachedStart ? last : null };
  } catch {
    return null;
  }
}

// ── Yazma ────────────────────────────────────────────────────────────

async function deleteIds(db: SQLiteDatabase, chatId: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.runAsync(
      `DELETE FROM messages WHERE chat_id = ? AND id IN (${chunk.map(() => "?").join(",")})`,
      chatId,
      ...chunk
    );
  }
}

async function writeChat(db: SQLiteDatabase, chatId: string, segment: Segment<Message>) {
  const now = Date.now();
  const oldest = segment.items[segment.items.length - 1];
  const oldestTime = timeOf(oldest);
  const overlap = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM messages WHERE chat_id = ? AND id = ?",
    chatId,
    oldest.id
  );
  const range = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM messages WHERE chat_id = ? AND created_at >= ?",
    chatId,
    oldestTime
  );
  const chat = await db.getFirstAsync<{ next_cursor: string | null }>(
    "SELECT next_cursor FROM chats WHERE chat_id = ?",
    chatId
  );
  const snapshotIds = new Set(segment.items.map((item) => item.id));
  const plan = planSegmentWrite({
    snapshotIds,
    snapshotCursor: segment.cursor,
    overlap: Boolean(overlap),
    storedInRange: range.map((row) => row.id),
    storedCursor: chat ? chat.next_cursor : undefined,
  });

  const memory = written.get(chatId) ?? new Map<string, string>();
  written.delete(chatId);
  written.set(chatId, memory);
  // Bellekteki kopya yalnızca son birkaç sohbet için tutulur.
  while (written.size > 8) {
    const first = written.keys().next().value;
    if (first === undefined) break;
    written.delete(first);
  }

  await deleteIds(db, chatId, plan.deleteIds);
  for (const id of plan.deleteIds) memory.delete(id);
  if (plan.deleteOlder) {
    await db.runAsync("DELETE FROM messages WHERE chat_id = ? AND created_at < ?", chatId, oldestTime);
    for (const id of [...memory.keys()]) if (!snapshotIds.has(id)) memory.delete(id);
  }

  const statement = await db.prepareAsync(
    `INSERT INTO messages (chat_id, id, created_at, expires_at, bytes, json) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(chat_id, id) DO UPDATE SET created_at = excluded.created_at, expires_at = excluded.expires_at,
       bytes = excluded.bytes, json = excluded.json`
  );
  try {
    for (const item of segment.items) {
      const json = JSON.stringify(item);
      if (memory.get(item.id) === json) continue;
      await statement.executeAsync(chatId, item.id, timeOf(item), expiryAt(item), json.length, json);
      memory.set(item.id, json);
    }
  } finally {
    await statement.finalizeAsync();
  }

  // Sohbet başına üst sınır: en eskiler atılır, imleç kesimin yeni ucuna kayar.
  let nextCursor = plan.nextCursor;
  const overflow = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM messages WHERE chat_id = ? ${ORDER} LIMIT -1 OFFSET ?`,
    chatId,
    MESSAGES_PER_CHAT
  );
  if (overflow.length > 0) {
    const ids = overflow.map((row) => row.id);
    await deleteIds(db, chatId, ids);
    for (const id of ids) memory.delete(id);
    const boundary = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM messages WHERE chat_id = ? ${ORDER} LIMIT 1 OFFSET ?`,
      chatId,
      MESSAGES_PER_CHAT - 1
    );
    nextCursor = boundary?.id ?? nextCursor;
  }

  await db.runAsync(
    `INSERT INTO chats (chat_id, saved_at, last_access, next_cursor) VALUES (?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET saved_at = excluded.saved_at, last_access = excluded.last_access,
       next_cursor = excluded.next_cursor`,
    chatId,
    now,
    now,
    nextCursor
  );
}

function flush(chatId: string) {
  const timer = timers.get(chatId);
  if (timer) clearTimeout(timer);
  timers.delete(chatId);
  const segment = pending.get(chatId);
  pending.delete(chatId);
  if (!segment) return;
  const startedIn = generation;
  void enqueueWrite(async (db) => {
    // Çıkış yazma sırasında geldiyse eski hesabın mesajı diske dönmesin.
    if (startedIn !== generation) return;
    await writeChat(db, chatId, segment);
  }).then(() => {
    writesSinceEvict += 1;
    if (writesSinceEvict >= EVICT_EVERY_WRITES) {
      writesSinceEvict = 0;
      void evictStale();
    }
  });
}

function flushAll() {
  for (const chatId of [...pending.keys()]) flush(chatId);
}

function schedule(chatId: string, data: MessageCache | undefined) {
  const segment = snapshotSegment(data?.pages, MESSAGES_PER_CHAT, Date.now());
  if (!segment) return;
  pending.set(chatId, segment);
  if (timers.has(chatId)) return;
  timers.set(
    chatId,
    setTimeout(() => flush(chatId), WRITE_DELAY_MS)
  );
}

/** Süresi dolan kaybolan mesajlar diskten silinir (açık olmayan sohbetler dahil). */
export function purgeExpiredMessages(): Promise<void> {
  return enqueueWrite(async (db) => {
    const result = await db.runAsync(
      "DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
      Date.now()
    );
    if (result.changes > 0) written.clear();
  });
}

/** LRU: sınırları aşan, en uzun süredir açılmamış sohbetler bütünüyle atılır. */
export function evictStale(): Promise<void> {
  return enqueueWrite(async (db) => {
    const chats = await db.getAllAsync<{ chat_id: string; last_access: number; bytes: number }>(
      `SELECT c.chat_id, c.last_access, COALESCE(SUM(m.bytes), 0) AS bytes
         FROM chats c LEFT JOIN messages m ON m.chat_id = c.chat_id GROUP BY c.chat_id`
    );
    const keep = new Set<string>();
    const active = activeChatId();
    if (active) keep.add(active);
    const evict = pickEvictions(
      chats.map((row) => ({ chatId: row.chat_id, lastAccess: row.last_access, bytes: row.bytes })),
      { maxChats: MAX_CHATS, maxBytes: MAX_TOTAL_BYTES },
      keep
    );
    for (const chatId of evict) {
      await db.runAsync("DELETE FROM messages WHERE chat_id = ?", chatId);
      await db.runAsync("DELETE FROM chats WHERE chat_id = ?", chatId);
      written.delete(chatId);
    }
  });
}

/**
 * Sohbet önbelleklerini izlemeye başlar. Kök düzende bir kez çağrılır;
 * dönen fonksiyon izlemeyi durdurur.
 */
export function startMessageStore(queryClient: QueryClient): () => void {
  stopWatching?.();
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    const key = event.query.queryKey as readonly unknown[];
    if (key[0] !== "messages" || typeof key[1] !== "string" || key[1] === "yok") return;
    schedule(key[1], event.query.state.data as MessageCache | undefined);
  });
  // Arka plana geçerken bekleyen yazmalar hemen: sistem uygulamayı öldürebilir.
  // Ön plana dönüşte süresi dolan kaybolan mesajlar diskten de düşer.
  const appState = AppState.addEventListener("change", (next) => {
    if (next !== "active") flushAll();
    else void purgeExpiredMessages();
  });
  // Açılışta (ilk kareyi geciktirmeden) bakım.
  const maintenance = setTimeout(() => {
    void purgeExpiredMessages();
    void evictStale();
  }, 5_000);
  const stop = () => {
    unsubscribe();
    appState.remove();
    clearTimeout(maintenance);
    if (stopWatching === stop) stopWatching = null;
  };
  stopWatching = stop;
  return stop;
}

/** Çıkış: bekleyen yazmalar iptal, bellekteki izler silinir (tablolar `wipeLocalDb` ile). */
export function clearStoredMessages() {
  generation += 1;
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  pending.clear();
  written.clear();
}

/** Ayarlar › "Yerel mesaj kopyasını sil": diskteki mesajlar silinir (oturum sürer, sohbetler sunucudan yeniden iner). */
export async function wipeStoredMessages(): Promise<void> {
  clearStoredMessages();
  await enqueueWrite(async (db) => {
    await db.execAsync("DELETE FROM messages; DELETE FROM chats;");
  });
}
