import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

/**
 * Cihazdaki yerel veritabanı (WhatsApp `msgstore.db` karşılığı) — bkz.
 * docs/YEREL-DEPO.md.
 *
 * Tek SQLite dosyası (`ciklet.db`, WAL kipinde): mesajlar, sohbet
 * kesimleri, medya dizini ve küçük anahtar/değer anlık görüntüleri (sohbet
 * listesi, okunmamışlar, gönderim kuyruğu, son profil).
 *
 * Okuma ilkesi: ekranın İLK karesi için gereken küçük okumalar EŞZAMANLI
 * (birkaç ms; ağ ve AsyncStorage'ı beklemeden çizim). Yazmaların hepsi
 * EŞZAMANSIZ ve {@link enqueueWrite} kuyruğundan, toplu işlemle geçer —
 * aynı bağlantıda iki işlem iç içe geçmesin.
 *
 * Çıkışta {@link wipeLocalDb} her şeyi siler (gizlilik).
 */

const DB_NAME = "ciklet.db";
const SCHEMA_VERSION = 1;

let instance: SQLiteDatabase | null | undefined;

function migrate(db: SQLiteDatabase) {
  db.execSync("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;");
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  db.execSync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chats (
      chat_id TEXT PRIMARY KEY NOT NULL,
      saved_at INTEGER NOT NULL,
      last_access INTEGER NOT NULL,
      -- Saklanan kesimin en eskisinden geriye sunucu imleci; NULL = geçmişin başı.
      next_cursor TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      chat_id TEXT NOT NULL,
      id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      bytes INTEGER NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (chat_id, id)
    );
    CREATE INDEX IF NOT EXISTS messages_chat_time ON messages (chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS messages_expiry ON messages (expires_at) WHERE expires_at IS NOT NULL;
    CREATE TABLE IF NOT EXISTS media (
      name TEXT PRIMARY KEY NOT NULL,
      url TEXT NOT NULL,
      kind TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      last_access INTEGER NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

/** Veritabanı; açılamazsa (bozuk dosya, desteklenmeyen ortam) null — çağıranlar yerelsiz çalışır. */
export function localDb(): SQLiteDatabase | null {
  if (instance !== undefined) return instance;
  try {
    const db = openDatabaseSync(DB_NAME);
    migrate(db);
    instance = db;
  } catch (err) {
    if (__DEV__) console.warn("[yerel-db] açılamadı", err);
    instance = null;
  }
  return instance;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Yazma kuyruğu: işler sırayla, her biri tek işlem (transaction) içinde.
 * Bir işin hatası sonrakileri durdurmaz.
 */
export function enqueueWrite(task: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = localDb();
  if (!db) return Promise.resolve();
  const run = queue.then(() => db.withTransactionAsync(() => task(db)));
  queue = run.catch((err) => {
    if (__DEV__) console.warn("[yerel-db] yazma başarısız", err);
  });
  return queue as Promise<void>;
}

// ── Anahtar / değer ────────────────────────────────────────────────

export function kvGet<T>(key: string): { value: T; updatedAt: number } | null {
  const db = localDb();
  if (!db) return null;
  try {
    const row = db.getFirstSync<{ value: string; updated_at: number }>(
      "SELECT value, updated_at FROM kv WHERE key = ?",
      key
    );
    if (!row) return null;
    return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: unknown, updatedAt = Date.now()): Promise<void> {
  const json = JSON.stringify(value ?? null);
  return enqueueWrite(async (db) => {
    await db.runAsync(
      "INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      key,
      json,
      updatedAt
    );
  });
}

export function kvDelete(key: string): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.runAsync("DELETE FROM kv WHERE key = ?", key);
  });
}

/** Mesaj kopyasının diskte kapladığı yaklaşık bayt. */
export async function messageStorageBytes(): Promise<number> {
  const db = localDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ total: number | null }>("SELECT SUM(bytes) AS total FROM messages");
  return row?.total ?? 0;
}

/** Çıkış: bütün tablolar boşaltılır, dosya küçültülür. */
export function wipeLocalDb(): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.execAsync("DELETE FROM messages; DELETE FROM chats; DELETE FROM media; DELETE FROM kv;");
  }).then(async () => {
    const db = localDb();
    // VACUUM işlem içinde çalışmaz; silinen içerik dosyada da kalmasın.
    await db?.execAsync("VACUUM").catch(() => {});
  });
}
