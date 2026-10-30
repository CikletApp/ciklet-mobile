import { AppState, Platform } from "react-native";

import CikletMedia, { type NativeMediaSession } from "../../../modules/ciklet-media";
import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { RichPresence } from "@/api/types";
import { ClientEvent } from "@/realtime/events";
import { onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { usePreferences } from "@/stores/preferences";
import {
  HOSTED_COVER_PATH,
  activityKey,
  artworkCacheKey,
  decodeBase64,
  toMediaActivity,
} from "./media-activity";

/**
 * "Dinlediğimi paylaş" — telefonda çalan müzik/video → ağ geçidi.
 *
 * Akış (web realtime-provider'daki masaüstü yolunun mobil eşi):
 *   modules/ciklet-media `onMediaChange` → toMediaActivity (masaüstüyle aynı
 *   biçim) → 750 ms kısma + tekrar eleme → `rich_presence.update`.
 *   Kapak önce kapaksız yayınlanır; /api/presence/covers'a yüklenince kapaklı
 *   hâli gider (data URL ağa hiç çıkmaz, ağ geçidi sınırı 8 KB).
 *
 * Masaüstüyle birlikte: rich presence kullanıcı başına TEK kayıt (son yazan
 * kazanır). Telefon hiç etkinlik yayınlamadıysa `null` da göndermez — yoksa
 * masaüstündeki oyun etkinliğini, telefonda bir şey çalmadığı için silerdi.
 *
 * Arka plan: native dinleyici süreç yaşadıkça olay verir; JS de çoğu zaman
 * çalışır. Ama Android arka plandaki soketi bir süre sonra öldürür (ağ
 * geçidi 60 sn sessizlikte kapatır). O arada gönderim düşer; ön plana
 * dönüşte bağlantı açılınca güncel etkinlik yeniden gönderilir. Son
 * bağlantı da kapanınca ağ geçidi etkinliği kendisi temizler
 * (finalize_offline → rich presence null).
 */

/**
 * Gömülü aktivitenin etkinliğini yayınlar / kaldırır (null). Kaldırınca
 * telefonda çalan medya varsa o yeniden yayınlanır, yoksa kayıt silinir
 * (yalnızca kayıt bizimse — masaüstündeki oyun etkinliği silinmez).
 */
export function setEmbeddedActivityPresence(activity: RichPresence | null): void {
  embedded = activity;
  // Yeni bağlantıda sunucu tarafı boş: aktivite etkinliği yeniden gider.
  if (activity && !embeddedOpenHook) {
    embeddedOpenHook = onGatewayOpen(() => {
      if (!embedded) return;
      sentKey = null;
      queue(current);
    });
  } else if (!activity && embeddedOpenHook) {
    embeddedOpenHook();
    embeddedOpenHook = null;
  }
  queue(current);
}

/** Bu cihazda özellik var mı (Android + modüllü derleme). */
export const mediaPresenceSupported = Platform.OS === "android" && CikletMedia !== null;

/** İki yayın arasındaki en kısa süre — web ve ağ geçidiyle aynı (750 ms). */
const MIN_INTERVAL_MS = 750;
const COVER_CACHE_LIMIT = 32;

let session: NativeMediaSession | null = null;
/** Oturumun alındığı an — konum bu ana göre; tercih değişince yeniden hesaplanırken kaymaz. */
let sessionAt = 0;
/** Aynı uygulamada süren dinlemenin başlangıcı (parça değişince sabit). */
let listening: { packageName: string; startedAt: number } | null = null;
/** Son hesaplanan (kapaklı olabilir) etkinlik. */
let current: RichPresence | null = null;

let pending: RichPresence | null | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let sentAt = 0;
let sentKey: string | null = null;
/** Ağ geçidindeki kayıt bizim gönderdiğimiz bir etkinlik mi. */
let serverHasOurs = false;
/**
 * Açık gömülü aktivitenin SDK `setActivity` etkinliği (features/activities/
 * sdk-host). Varken yayında ÖNCELİKLİ — web realtime-provider
 * `embeddedActivity` ile aynı kural: aktivite kapanınca (null) medya
 * etkinliği geri gelir. Medya paylaşımı kapalı / Android dışı cihazda da
 * çalışır; aynı kısma ve tekrar eleme kuyruğundan geçer.
 */
let embedded: RichPresence | null = null;
let embeddedOpenHook: (() => void) | null = null;

const covers = new Map<string, string>();
const coverUploads = new Map<string, Promise<string | null>>();

// ── Yayın ───────────────────────────────────────────────────────────

function flush(): void {
  timer = null;
  const next = pending;
  if (next === undefined) return;
  pending = undefined;
  const key = activityKey(next);
  if (key === sentKey) return;
  if (next === null && !serverHasOurs) {
    sentKey = key;
    return;
  }
  // Bağlantı yoksa düşer; açılışta (onGatewayOpen) güncel hâl yeniden gider.
  if (!sendGatewayEvent({ event_type: ClientEvent.RICH_PRESENCE_UPDATE, activity: next })) return;
  sentKey = key;
  sentAt = Date.now();
  serverHasOurs = next !== null;
}

function queue(activity: RichPresence | null): void {
  pending = embedded ?? activity;
  if (timer) return;
  timer = setTimeout(flush, Math.max(0, MIN_INTERVAL_MS - (Date.now() - sentAt)));
}

// ── Kapak ───────────────────────────────────────────────────────────

function rememberCover(key: string, path: string): void {
  covers.delete(key);
  covers.set(key, path);
  if (covers.size > COVER_CACHE_LIMIT) {
    const oldest = covers.keys().next().value;
    if (oldest !== undefined) covers.delete(oldest);
  }
}

/** Kapağı sunucuya yükler; kısa yolu döner. Hata / hız sınırı → null (kapaksız kalır). */
function hostCover(media: NativeMediaSession, base64: string): Promise<string | null> {
  const key = artworkCacheKey(media, base64);
  const cached = covers.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = coverUploads.get(key);
  if (inFlight) return inFlight;

  const bytes = decodeBase64(base64);
  if (!bytes || bytes.length === 0) return Promise.resolve(null);
  const upload = api<{ url?: unknown } | undefined>(endpoints.presenceCovers, {
    method: "POST",
    body: bytes,
    headers: { "Content-Type": "image/jpeg" },
  })
    .then((res) => {
      const url = typeof res?.url === "string" && HOSTED_COVER_PATH.test(res.url) ? res.url : null;
      if (url) rememberCover(key, url);
      return url;
    })
    .catch(() => null)
    .finally(() => coverUploads.delete(key));
  coverUploads.set(key, upload);
  return upload;
}

// ── Değerlendirme ───────────────────────────────────────────────────

function evaluate(): void {
  const prefs = usePreferences.getState();
  const media = prefs.shareMediaActivity ? session : null;

  if (!media?.playing) {
    listening = null;
  } else if (listening?.packageName !== media.packageName) {
    listening = { packageName: media.packageName, startedAt: sessionAt - Math.max(0, media.positionMs) };
  }

  const artwork = media?.artworkBase64 ?? null;
  const knownCover = media && artwork ? covers.get(artworkCacheKey(media, artwork)) : undefined;
  const activity = toMediaActivity(media, {
    sharing: { music: prefs.shareMusicActivity, video: prefs.shareVideoActivity },
    now: sessionAt,
    startedAt: listening?.startedAt,
    coverUrl: knownCover,
  });
  current = activity;
  queue(activity);

  if (activity && media && artwork && !knownCover) {
    void hostCover(media, artwork).then((path) => {
      // Bu arada parça değiştiyse eski kapak yayınlanmaz.
      if (!path || current !== activity) return;
      current = { ...activity, largeImageUrl: path };
      queue(current);
    });
  }
}

function applySession(media: NativeMediaSession | null): void {
  session = media;
  sessionAt = Date.now();
  evaluate();
}

/**
 * Dinlemeyi başlatır (oturum açık + "Dinlediğimi paylaş" açıkken; bkz.
 * RealtimeProvider). İzin yoksa native taraf hiçbir şey yapmaz; ön plana
 * dönüşte (kullanıcı izni ayarlardan verip geldiğinde) yeniden denenir.
 */
export function startMediaPresence(): () => void {
  const native = CikletMedia;
  if (!native || Platform.OS !== "android") return () => {};

  const subscription = native.addListener("onMediaChange", ({ media }) => applySession(media ?? null));

  // Yeni bağlantıda son gönderilenin anahtarı geçersiz; güncel hâl yeniden gider.
  const offOpen = onGatewayOpen(() => {
    sentKey = null;
    if (current) queue(current);
  });

  const offPrefs = usePreferences.subscribe((state, prev) => {
    if (
      state.shareMusicActivity !== prev.shareMusicActivity ||
      state.shareVideoActivity !== prev.shareVideoActivity
    ) {
      evaluate();
    }
  });

  const appState = AppState.addEventListener("change", (next) => {
    if (next === "active") void native.start().catch(() => false);
  });

  void native.start().catch(() => false);

  return () => {
    subscription.remove();
    offOpen();
    offPrefs();
    appState.remove();
    void native.stop().catch(() => {});
    session = null;
    listening = null;
    current = null;
    // Telefondan yayınlanan etkinlik varsa kalkar (yoksa hiçbir şey gitmez).
    queue(null);
  };
}

/** Sistem "Bildirim erişimi" izni verildi mi (Android). */
export function isMediaPermissionGranted(): boolean {
  try {
    return CikletMedia?.isPermissionGranted() ?? false;
  } catch {
    return false;
  }
}

export function openMediaPermissionSettings(): void {
  try {
    CikletMedia?.openPermissionSettings();
  } catch {
    // Ayar ekranı yok (bazı ROM'lar) — kullanıcı elle açar.
  }
}
