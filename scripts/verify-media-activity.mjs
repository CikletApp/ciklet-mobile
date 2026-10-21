// Telefonda çalan medya → rich presence eşlemesinin saf mantığını doğrular.
// Çalıştırma: node scripts/verify-media-activity.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import {
  activityKey,
  artworkCacheKey,
  clampText,
  decodeBase64,
  fallbackAppName,
  isMobileActivity,
  resolveMediaApp,
  toMediaActivity,
} from "../src/features/presence/media-activity.ts";

const ALL = { music: true, video: true };
const NOW = 1_800_000_000_000;

function session(overrides = {}) {
  return {
    packageName: "com.spotify.music",
    appName: "Spotify",
    appCategory: "audio",
    title: "Parça",
    artist: "Sanatçı",
    album: "Albüm",
    durationMs: 200_000,
    positionMs: 50_000,
    playing: true,
    ...overrides,
  };
}

test("Spotify masaüstüyle aynı biçimde LISTENING olur", () => {
  const activity = toMediaActivity(session(), { sharing: ALL, now: NOW });
  assert.deepEqual(activity, {
    type: "LISTENING",
    name: "Spotify",
    details: "Parça",
    state: "Sanatçı",
    processName: "com.spotify.music",
    startedAt: NOW - 50_000,
    timestamps: { start: NOW - 50_000, end: NOW + 150_000 },
    device: "mobile",
  });
  assert.ok(isMobileActivity(activity));
});

test("YouTube WATCHING, YouTube Music LISTENING; adlar masaüstüyle aynı", () => {
  const yt = toMediaActivity(session({ packageName: "com.google.android.youtube", appName: "YouTube" }), { sharing: ALL, now: NOW });
  assert.equal(yt.type, "WATCHING");
  assert.equal(yt.name, "YouTube");
  const ytm = toMediaActivity(session({ packageName: "com.google.android.apps.youtube.music", appName: "YT Music" }), { sharing: ALL, now: NOW });
  assert.equal(ytm.type, "LISTENING");
  assert.equal(ytm.name, "YouTube Music");
});

test("kategori anahtarları süzer", () => {
  assert.equal(toMediaActivity(session(), { sharing: { music: false, video: true }, now: NOW }), null);
  const yt = session({ packageName: "com.google.android.youtube" });
  assert.equal(toMediaActivity(yt, { sharing: { music: true, video: false }, now: NOW }), null);
  assert.ok(toMediaActivity(yt, { sharing: { music: false, video: true }, now: NOW }));
});

test("çalmayan, başlıksız, tarayıcı ve mesajlaşma oturumları paylaşılmaz", () => {
  assert.equal(toMediaActivity(null, { sharing: ALL, now: NOW }), null);
  assert.equal(toMediaActivity(session({ playing: false }), { sharing: ALL, now: NOW }), null);
  assert.equal(toMediaActivity(session({ title: "  " }), { sharing: ALL, now: NOW }), null);
  assert.equal(resolveMediaApp({ packageName: "com.android.chrome", appName: "Chrome", appCategory: null }), null);
  assert.equal(resolveMediaApp({ packageName: "com.whatsapp", appName: "WhatsApp", appCategory: null }), null);
  assert.equal(resolveMediaApp({ packageName: "com.example.game", appName: "Oyun", appCategory: "game" }), null);
});

test("bilinmeyen uygulama etiketiyle; video kategorisi WATCHING", () => {
  assert.deepEqual(resolveMediaApp({ packageName: "au.com.shiftyjelly.pocketcasts", appName: "Pocket Casts", appCategory: "audio" }), { name: "Pocket Casts", kind: "music" });
  assert.deepEqual(resolveMediaApp({ packageName: "org.videolan.vlc", appName: "VLC", appCategory: "video" }), { name: "VLC", kind: "video" });
  assert.equal(fallbackAppName("com.example.podcastapp"), "Podcastapp");
  assert.equal(fallbackAppName("org.videolan.vlc.android"), "Vlc");
});

test("süre bilinmiyorsa zaman çizelgesi yok; startedAt korunur; sanatçı yoksa albüm", () => {
  const activity = toMediaActivity(session({ durationMs: 0, artist: null }), { sharing: ALL, now: NOW, startedAt: NOW - 600_000 });
  assert.equal(activity.timestamps, undefined);
  assert.equal(activity.startedAt, NOW - 600_000);
  assert.equal(activity.state, "Albüm");
});

test("kapak yalnızca kendi depomuzun yolu olarak eklenir", () => {
  const hash = "a".repeat(64);
  const ok = toMediaActivity(session(), { sharing: ALL, now: NOW, coverUrl: `/api/presence/covers/${hash}` });
  assert.equal(ok.largeImageUrl, `/api/presence/covers/${hash}`);
  const bad = toMediaActivity(session(), { sharing: ALL, now: NOW, coverUrl: "data:image/jpeg;base64,AAAA" });
  assert.equal(bad.largeImageUrl, undefined);
});

test("metinler 128 kod noktasında kesilir; yük 8 KB'ın çok altında", () => {
  const long = "🎵".repeat(500);
  assert.equal(Array.from(clampText(long)).length, 128);
  const activity = toMediaActivity(session({ title: long, artist: long }), { sharing: ALL, now: NOW });
  const bytes = new TextEncoder().encode(JSON.stringify({ event_type: "rich_presence.update", activity })).length;
  assert.ok(bytes < 7 * 1024, `${bytes} bayt`);
});

test("anahtar ve kapak önbelleği anahtarı kararlı", () => {
  assert.equal(activityKey(null), "null");
  const a = toMediaActivity(session(), { sharing: ALL, now: NOW });
  assert.equal(activityKey(a), activityKey({ ...a }));
  assert.notEqual(artworkCacheKey(session(), "AAAA"), artworkCacheKey(session({ title: "Başka" }), "AAAA"));
});

test("base64 çözümü Buffer ile aynı", () => {
  for (const sample of [new Uint8Array([]), new Uint8Array([0xff]), new Uint8Array([1, 2]), new Uint8Array([0, 255, 128, 7, 9])]) {
    const encoded = Buffer.from(sample).toString("base64");
    assert.deepEqual(Array.from(decodeBase64(encoded)), Array.from(sample));
  }
  const random = new Uint8Array(4096).map((_, i) => (i * 131 + 7) & 0xff);
  assert.deepEqual(Buffer.from(decodeBase64(Buffer.from(random).toString("base64"))), Buffer.from(random));
  assert.equal(decodeBase64("@@@@"), null);
});
