import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

import { usePreferences } from "@/stores/preferences";
import { enqueueWrite, localDb } from "./local-db";
import { createPrefetchQueue, type PrefetchItem } from "./media-prefetch-logic";
import { networkKind, onNetworkChange } from "./network";

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
 *
 * Sesli mesajlar ayrıca ARKA PLAN KUYRUĞUYLA iner ({@link prefetchVoice},
 * kuralları `media-prefetch-logic.ts`): sohbet önbelleğine düştükleri anda
 * (`features/chat/voice-prefetch`), ekranda görünmeseler de. Kuyruk kendi
 * iki yuvasını kullanır; kullanıcının dokunduğu indirme onun arkasında
 * beklemez.
 */

export type MediaKind = "voice" | "file" | "video" | "image";

const FOLDER = "media";
const MAX_BYTES = 1024 * 1024 * 1024;
const PARALLEL = 2;
/** Arka plan kuyruğu: eşzamanlı indirme, kuyruk boyu, deneme. */
const PREFETCH_PARALLEL = 2;
const PREFETCH_MAX_JOBS = 300;
const PREFETCH_MAX_ATTEMPTS = 5;
/** Arka planda bundan büyük dosya inmez (sesli mesaj en çok 5 dk AAC, ~5 MB). */
export const PREFETCH_MAX_BYTES = 15 * 1024 * 1024;

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
/** Süren indirmelerin ilerlemesi (0–1); boyut bilinmiyorsa yok. */
const progress = new Map<string, number>();
/** `clearMedia` her çağrıda artar: temizlikten önce başlayan indirme kaydedilmez. */
let generation = 0;
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

class PermanentDownloadError extends Error {
  readonly permanent = true;
}

interface DownloadOptions {
  /** Arka plan kuyruğu: paylaşılan yuvayı beklemez (kuyruğun kendi sınırı var). */
  background?: boolean;
  /** Sunucunun bildirdiği boyut bunu aşarsa indirme kesilir. */
  maxBytes?: number;
}

function download(url: string, kind: MediaKind, options: DownloadOptions = {}): Promise<string> {
  const local = localMediaUri(url, kind);
  if (local) return Promise.resolve(local);
  const name = mediaFileName(url, kind);
  const running = inflight.get(name);
  if (running) return running;
  const task = async () => {
    ensureIndex();
    if (!folder) throw new Error("Medya klasörü yok");
    const startedIn = generation;
    // ".part"a iner, tamamlanınca asıl ada taşınır: yarıda kesilen indirme
    // bozuk bir dosyayı kalıcı hâle getirmesin.
    const partial = new File(folder, `${name}.part`);
    const abort = options.maxBytes && typeof AbortController === "function" ? new AbortController() : null;
    let tooLarge = false;
    let shownStep = -1;
    try {
      const file = await File.downloadFileAsync(url, partial, {
        idempotent: true,
        signal: abort?.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (abort && options.maxBytes && totalBytes > options.maxBytes) {
            tooLarge = true;
            abort.abort();
            return;
          }
          if (totalBytes <= 0) return;
          const ratio = Math.min(1, bytesWritten / totalBytes);
          progress.set(name, ratio);
          // Her pakette değil, %5 adımlarla yeniden çizilir.
          const step = Math.floor(ratio * 20);
          if (step !== shownStep) {
            shownStep = step;
            emit();
          }
        },
      });
      if (startedIn !== generation) {
        // İndirme sürerken önbellek temizlendi (çıkış): dosya kaydedilmez.
        file.delete();
        throw new Error("Medya önbelleği temizlendi");
      }
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
      if (tooLarge) throw new PermanentDownloadError("Dosya otomatik indirme sınırını aşıyor");
      throw err;
    }
  };
  const promise = (options.background ? task() : slot(task)).finally(() => {
    inflight.delete(name);
    progress.delete(name);
    emit();
  });
  inflight.set(name, promise);
  emit();
  return promise;
}

/**
 * Dosyayı cihaza indirir (varsa hemen döner) ve yerel adresini verir.
 * Aynı adres için eşzamanlı çağrılar (arka plan kuyruğu dahil) tek indirmeyi paylaşır.
 */
export function ensureMedia(url: string, kind: MediaKind): Promise<string> {
  return download(url, kind);
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

/**
 * Otomatik indirme kuralı. Sesli mesaj her ağda iner (WhatsApp; ayar:
 * "Sesli mesajlar", varsayılan açık); video ve dosyalar ağ türüne göre.
 */
export function autoDownloadAllowed(kind: MediaKind): boolean {
  const net = networkKind();
  if (net === "none") return false;
  const prefs = usePreferences.getState();
  if (kind === "voice") return prefs.autoDownloadVoice;
  return net === "wifi" ? prefs.autoDownloadMediaWifi : prefs.autoDownloadMediaCellular;
}

// ── Arka plan kuyruğu (sesli mesaj) ──────────────────────────────────

const voiceQueue = createPrefetchQueue<ReturnType<typeof setTimeout>>({
  concurrency: PREFETCH_PARALLEL,
  maxJobs: PREFETCH_MAX_JOBS,
  maxAttempts: PREFETCH_MAX_ATTEMPTS,
  run: (url) => download(url, "voice", { background: true, maxBytes: PREFETCH_MAX_BYTES }),
  isDone: (url) => peekLocalMedia(url, "voice") !== null,
  canRun: () => autoDownloadAllowed("voice"),
  now: () => Date.now(),
  random: () => Math.random(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (timer) => clearTimeout(timer),
});

let prefetchWired = false;
function wirePrefetch() {
  if (prefetchWired) return;
  prefetchWired = true;
  // Bağlantı geldi, uygulama öne döndü ya da ayar açıldı: beklemeler sıfırlanır.
  onNetworkChange((online) => {
    if (online) voiceQueue.resume();
  });
  AppState.addEventListener("change", (next) => {
    if (next === "active") voiceQueue.resume();
  });
  usePreferences.subscribe((state, previous) => {
    if (state.autoDownloadVoice && !previous.autoDownloadVoice) voiceQueue.resume();
  });
}

/**
 * Sesli mesajları arka plan kuyruğuna ekler (tekilleştirilir; cihazda
 * olanlar atlanır). En yeni (büyük öncelik) önce iner; ağ yokken ya da
 * ayar kapalıyken bekler.
 */
export function prefetchVoice(items: readonly PrefetchItem[]): void {
  if (Platform.OS === "web" || items.length === 0) return;
  wirePrefetch();
  voiceQueue.add(items);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Bir ekin yerel durumu. `auto` true ise ve kural izin veriyorsa arka planda
 * indirmeye başlar. `uri`: yerel kopya (yoksa null); `progress`: süren
 * indirmenin oranı (0–1; boyut henüz bilinmiyorsa null).
 */
export function useLocalMedia(url: string | null | undefined, kind: MediaKind, auto = true) {
  useSyncExternalStore(subscribe, () => version);
  const uri = url ? peekLocalMedia(url, kind) : null;
  const downloading = url ? isDownloading(url, kind) : false;
  const ratio = url && downloading ? (progress.get(mediaFileName(url, kind)) ?? null) : null;
  useEffect(() => {
    if (uri && url) localMediaUri(url, kind);
    if (!url || !auto || uri || Platform.OS === "web") return;
    if (!/^https?:/i.test(url) || !autoDownloadAllowed(kind)) return;
    void ensureMedia(url, kind).catch(() => {});
  }, [url, kind, auto, uri]);
  return { uri, downloading, progress: ratio };
}

export function mediaUsage(): { bytes: number; count: number } {
  let bytes = 0;
  const entries = ensureIndex();
  for (const entry of entries.values()) bytes += entry.bytes;
  return { bytes, count: entries.size };
}

/** "Önbelleği temizle" ve çıkış: bütün yerel medya silinir. */
export async function clearMedia(): Promise<void> {
  generation += 1;
  voiceQueue.clear();
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
