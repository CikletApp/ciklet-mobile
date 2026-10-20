import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

import { usePreferences, type AutoDownload } from "@/stores/preferences";
import { enqueueWrite, localDb } from "./local-db";
import { networkKind } from "./network";

/**
 * Medya önbelleği — sesli mesaj, dosya ve videoların CİHAZDAKİ kopyası
 * (WhatsApp'ın "Media" klasörü). Bkz. docs/YEREL-DEPO.md.
 *
 * Dosya ilk görüldüğünde (otomatik indirme kuralı izin veriyorsa) ya da ilk
 * açılışta uygulamanın BELGE klasörüne iner — sistem orayı kendiliğinden
 * silmez. Ad, adresin karmasından türer; dizin `media` tablosunda (boyut,
 * son erişim). Sonraki her oynatma/açma yerel dosyadan, ağsız.
 *
 * Görseller burada değil: expo-image'ın disk önbelleği (`cachePolicy`
 * "memory-disk") onları zaten saklıyor.
 *
 * Toplam boyut {@link MAX_BYTES}'ı aşınca en uzun süredir açılmayanlar silinir.
 */

export type MediaKind = "voice" | "file" | "video" | "image";

const FOLDER = "media";
const MAX_BYTES = 1024 * 1024 * 1024;
const PARALLEL = 2;

interface Entry {
  bytes: number;
  lastAccess: number;
}

let folder: Directory | null = null;
let folderUri = "";
let index: Map<string, Entry> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<string>>();
const touched = new Set<string>();
let touchTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

/** FNV-1a (iki 32 bit tur) — eşzamanlı, bağımlılıksız; çakışma olasılığı ihmal edilebilir. */
function hash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const DEFAULT_EXT: Record<MediaKind, string> = { voice: "m4a", file: "bin", video: "mp4", image: "img" };

export function mediaFileName(url: string, kind: MediaKind): string {
  const path = url.split(/[?#]/)[0];
  const match = /\.([a-z0-9]{1,5})$/i.exec(path.slice(path.lastIndexOf("/") + 1));
  return `${hash(url)}.${(match?.[1] ?? DEFAULT_EXT[kind]).toLowerCase()}`;
}

function ensureIndex(): Map<string, Entry> {
  if (index) return index;
  index = new Map();
  if (Platform.OS === "web") return index;
  try {
    folder = new Directory(Paths.document, FOLDER);
    if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    folderUri = folder.uri.endsWith("/") ? folder.uri : `${folder.uri}/`;
    const rows =
      localDb()?.getAllSync<{ name: string; bytes: number; last_access: number }>(
        "SELECT name, bytes, last_access FROM media"
      ) ?? [];
    for (const row of rows) index.set(row.name, { bytes: row.bytes, lastAccess: row.last_access });
  } catch {
    folder = null;
  }
  return index;
}

function scheduleTouchWrite() {
  if (touchTimer) return;
  touchTimer = setTimeout(() => {
    touchTimer = null;
    const names = [...touched];
    touched.clear();
    const now = Date.now();
    void enqueueWrite(async (db) => {
      for (const name of names) await db.runAsync("UPDATE media SET last_access = ? WHERE name = ?", now, name);
    });
  }, 5_000);
}

/** Yerel kopyanın adresi — erişim zamanına dokunmaz (render içinde güvenli). */
function peekLocalMedia(url: string, kind: MediaKind): string | null {
  if (/^(file|content|data):/i.test(url)) return url;
  const name = mediaFileName(url, kind);
  return ensureIndex().has(name) && folderUri ? `${folderUri}${name}` : null;
}

/** Yerel kopya varsa `file://` adresi; yoksa null. LRU için erişim zamanını günceller. */
export function localMediaUri(url: string | null | undefined, kind: MediaKind): string | null {
  if (!url || /^(file|content|data):/i.test(url)) return url ?? null;
  const name = mediaFileName(url, kind);
  const entry = ensureIndex().get(name);
  if (!entry || !folderUri) return null;
  entry.lastAccess = Date.now();
  touched.add(name);
  scheduleTouchWrite();
  return `${folderUri}${name}`;
}

async function record(name: string, url: string, kind: MediaKind, bytes: number) {
  const now = Date.now();
  ensureIndex().set(name, { bytes, lastAccess: now });
  await enqueueWrite(async (db) => {
    await db.runAsync(
      "INSERT INTO media (name, url, kind, bytes, last_access) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET bytes = excluded.bytes, last_access = excluded.last_access",
      name,
      url,
      kind,
      bytes,
      now
    );
  });
  emit();
  void enforceBudget();
}

/** Toplam boyut sınırı: en eski erişilenler silinir. */
async function enforceBudget() {
  const entries = [...ensureIndex().entries()];
  let total = entries.reduce((sum, [, entry]) => sum + entry.bytes, 0);
  if (total <= MAX_BYTES || !folder) return;
  entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const removed: string[] = [];
  for (const [name, entry] of entries) {
    if (total <= MAX_BYTES * 0.9) break;
    try {
      const file = new File(folder, name);
      if (file.exists) file.delete();
    } catch {
      /* silinemeyen dosya bir sonraki turda yeniden denenir */
    }
    index?.delete(name);
    removed.push(name);
    total -= entry.bytes;
  }
  await enqueueWrite(async (db) => {
    for (const name of removed) await db.runAsync("DELETE FROM media WHERE name = ?", name);
  });
  emit();
}

let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

/**
 * Dosyayı cihaza indirir (varsa hemen döner) ve yerel adresini verir.
 * Aynı adres için eşzamanlı çağrılar tek indirmeyi paylaşır.
 */
export function ensureMedia(url: string, kind: MediaKind): Promise<string> {
  const local = localMediaUri(url, kind);
  if (local) return Promise.resolve(local);
  const name = mediaFileName(url, kind);
  const running = inflight.get(name);
  if (running) return running;
  const promise = slot(async () => {
    ensureIndex();
    if (!folder) throw new Error("Medya klasörü yok");
    // ".part"a iner, tamamlanınca asıl ada taşınır: yarıda kesilen indirme
    // bozuk bir dosyayı kalıcı hâle getirmesin.
    const partial = new File(folder, `${name}.part`);
    try {
      const file = await File.downloadFileAsync(url, partial, { idempotent: true });
      const target = new File(folder, name);
      if (target.exists) target.delete();
      file.move(target);
      await record(name, url, kind, target.size ?? 0);
      return target.uri;
    } catch (err) {
      try {
        if (partial.exists) partial.delete();
      } catch {
        /* yok say */
      }
      throw err;
    }
  }).finally(() => inflight.delete(name));
  inflight.set(name, promise);
  emit();
  return promise;
}

/** Kendi gönderdiğimiz dosya: yüklemeden sonra yerel kopya önbelleğe alınır, bir daha inmez. */
export async function adoptMedia(url: string, kind: MediaKind, sourceUri: string): Promise<void> {
  try {
    ensureIndex();
    if (!folder) return;
    const name = mediaFileName(url, kind);
    const target = new File(folder, name);
    if (target.exists) target.delete();
    new File(sourceUri).copy(target);
    await record(name, url, kind, target.size ?? 0);
  } catch {
    /* kopyalanamazsa ilk açılışta iner */
  }
}

export function isDownloading(url: string, kind: MediaKind): boolean {
  return inflight.has(mediaFileName(url, kind));
}

/** Otomatik indirme kuralı: ağ türü × ayar × medya türü. */
export function autoDownloadAllowed(kind: MediaKind): boolean {
  const net = networkKind();
  if (net === "none") return false;
  const prefs = usePreferences.getState();
  const policy: AutoDownload = net === "wifi" ? prefs.autoDownloadWifi : prefs.autoDownloadCellular;
  if (policy === "none") return false;
  return kind === "voice" || policy === "all";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Bir ekin yerel durumu. `auto` true ise ve kural izin veriyorsa arka planda
 * indirmeye başlar. `uri`: yerel kopya (yoksa null).
 */
export function useLocalMedia(url: string | null | undefined, kind: MediaKind, auto = true) {
  useSyncExternalStore(subscribe, () => version);
  const uri = url ? peekLocalMedia(url, kind) : null;
  const downloading = url ? isDownloading(url, kind) : false;
  useEffect(() => {
    if (uri && url) localMediaUri(url, kind);
    if (!url || !auto || uri || Platform.OS === "web") return;
    if (!/^https?:/i.test(url) || !autoDownloadAllowed(kind)) return;
    void ensureMedia(url, kind).catch(() => {});
  }, [url, kind, auto, uri]);
  return { uri, downloading };
}

export function mediaUsage(): { bytes: number; count: number } {
  let bytes = 0;
  const entries = ensureIndex();
  for (const entry of entries.values()) bytes += entry.bytes;
  return { bytes, count: entries.size };
}

/** "Önbelleği temizle" ve çıkış: bütün yerel medya silinir. */
export async function clearMedia(): Promise<void> {
  ensureIndex();
  try {
    if (folder?.exists) folder.delete();
    folder?.create({ intermediates: true, idempotent: true });
  } catch {
    /* klasör silinemezse dosyalar dizinden düşer, üzerine yazılır */
  }
  index?.clear();
  await enqueueWrite(async (db) => {
    await db.runAsync("DELETE FROM media");
  });
  emit();
}
