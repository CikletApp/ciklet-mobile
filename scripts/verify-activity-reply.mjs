// Etkinliğe yanıt (ACTIVITY_REPLY) saf mantığını doğrular — web lib/activity-reply ile aynı kural.
// Çalıştırma: node scripts/verify-activity-reply.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import {
  activityImageForMessage,
  activityRefHeadline,
  activityReplyLabel,
  activityReplyPreview,
  activityVerbLabel,
  buildActivityReplyPayload,
  normalizeActivityRef,
  readActivityReply,
} from "../src/lib/activity-reply.ts";

const ORIGIN = "https://ciklet.xyz";

test("bozuk metadata kart üretmez", () => {
  assert.equal(readActivityReply({ type: "ACTIVITY_REPLY", metadata: null }), null);
  assert.equal(readActivityReply({ type: "ACTIVITY_REPLY", metadata: { activity: "x" } }), null);
  assert.equal(readActivityReply({ type: "ACTIVITY_REPLY", metadata: { activity: { name: "  " } } }), null);
  assert.equal(readActivityReply({ type: "ACTIVITY_REPLY", metadata: [] }), null);
  assert.equal(readActivityReply({ type: "DEFAULT", metadata: { activity: { name: "Valorant" } } }), null);
});

test("normalize: bilinmeyen alan düşer, https dışı görsel atılır", () => {
  assert.deepEqual(
    normalizeActivityRef({ type: "PLAYING", name: " Valorant ", largeImageUrl: "http://x.com/a.png", evil: 1, isLive: "yes" }),
    { type: "PLAYING", name: "Valorant" },
  );
  assert.deepEqual(normalizeActivityRef({ name: "Oyun", largeImageUrl: "javascript:alert(1)" }), { type: "PLAYING", name: "Oyun" });
  assert.equal(normalizeActivityRef({ name: "Oyun", largeImageUrl: "https://cdn.x/a.png" }).largeImageUrl, "https://cdn.x/a.png");
});

test("sayısal tür Discord sırasıyla okunur", () => {
  const ref = normalizeActivityRef({ type: 2, name: "Spotify", details: "Parça", state: "Sanatçı", isLive: true });
  assert.deepEqual(activityRefHeadline(ref), { title: "Parça", subtitle: "Sanatçı" });
  assert.equal(activityVerbLabel(ref), "Dinliyor");
});

test("başlık: medya parça adı, diğerleri uygulama adı", () => {
  assert.deepEqual(activityRefHeadline({ type: "WATCHING", name: "YouTube", details: "Video" }), { title: "Video", subtitle: "YouTube" });
  assert.deepEqual(activityRefHeadline({ type: "PLAYING", name: "CS2", details: "Rekabetçi", state: "Dust II" }), {
    title: "CS2",
    subtitle: "Rekabetçi",
  });
});

test("fiil: canlıysa geniş zaman, değilse geçmiş, uygulama Katıldı", () => {
  assert.equal(activityVerbLabel({ type: "PLAYING", isLive: true }), "Oynuyor");
  assert.equal(activityVerbLabel({ type: "PLAYING" }), "Oynadı");
  assert.equal(activityVerbLabel({ type: "WORKING", isLive: true }), "Kullanıyor");
  assert.equal(activityVerbLabel({ type: "PLAYING", isActivityApp: true }), "Katıldı");
  assert.equal(activityVerbLabel({ type: "CUSTOM" }), "Aktifti");
});

test("etiket ve önizleme", () => {
  assert.equal(activityReplyLabel("🔥"), "Etkinliğe tepki verdi");
  assert.equal(activityReplyLabel("harika parça"), "Etkinliğe yanıt verdi");
  assert.equal(activityReplyPreview("❤️"), "❤️ Etkinliğe tepki verdi");
  assert.equal(activityReplyPreview("harika parça"), "harika parça");
});

test("gövde: göreli kapak API köküyle mutlak olur", () => {
  assert.equal(activityImageForMessage("/api/presence/covers/abc", ORIGIN), "https://ciklet.xyz/api/presence/covers/abc");
  assert.equal(activityImageForMessage("/api/presence/covers/abc", "http://10.0.2.2:3000"), undefined);
  assert.equal(activityImageForMessage("//evil.com/a.png", ORIGIN), undefined);
  const payload = buildActivityReplyPayload(
    { type: "LISTENING", name: "Spotify", details: "Parça", state: null, isLive: true },
    "  👍 ",
    "/api/presence/covers/abc",
    ORIGIN,
  );
  assert.deepEqual(payload, {
    content: "👍",
    messageType: "ACTIVITY_REPLY",
    metadata: {
      activity: {
        type: "LISTENING",
        name: "Spotify",
        details: "Parça",
        largeImageUrl: "https://ciklet.xyz/api/presence/covers/abc",
        isLive: true,
      },
    },
  });
  assert.equal(buildActivityReplyPayload({ type: "PLAYING", name: "X", details: null, state: null, isLive: true }, "   ", null, ORIGIN), null);
});
