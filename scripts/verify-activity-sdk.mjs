// Aktivite host'unun Discord SDK eşdeğerliği (features/activities/sdk-host) —
// ciklet-web tests/unit/activity-sdk-parity.test.ts ile aynı kurallar.
// Çalıştırma: node scripts/verify-activity-sdk.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_LAUNCH_CONTEXT,
  activitySafeArea,
  buildActivityFrameUrl,
  closeNotice,
  currentStateFor,
  normalizeLaunchContext,
  resolveAssetImage,
  toEpochMs,
  toSdkPresence,
  usesAssetKeys,
} from "../src/features/activities/sdk-host.ts";

const CLIENT = "cik_app_955877703048b049552903d1";

test("başlatma bağlamı süzülür; kendini referrer gösteren düşer", () => {
  assert.deepEqual(normalizeLaunchContext({ customId: " room=42 ", referrerId: "u-friend", guildId: "s1" }, "me"), {
    customId: "room=42",
    referrerId: "u-friend",
    guildId: "s1",
  });
  assert.equal(normalizeLaunchContext({ referrerId: "me" }, "me").referrerId, null);
  assert.deepEqual(normalizeLaunchContext({ referrerId: "bad id!", guildId: "<x>" }), EMPTY_LAUNCH_CONTEXT);
  assert.equal(normalizeLaunchContext({ customId: "x".repeat(300) }).customId.length, 256);
});

test("iframe adresi web ile aynı parametreleri taşır, platform mobile", () => {
  const url = new URL(
    buildActivityFrameUrl("https://abcd.cikletimsi.site/?platform=web&x=1", {
      instanceId: `i-${CLIENT}-chan-1`,
      channelId: "chan-1",
      launchId: "L-1",
      frameId: `i-${CLIENT}-chan-1`,
      launch: { customId: "room=42", referrerId: "u-friend", guildId: "srv-1" },
    })
  );
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    x: "1",
    instance_id: `i-${CLIENT}-chan-1`,
    location_id: "chan-1",
    launch_id: "L-1",
    referrer_id: "u-friend",
    custom_id: "room=42",
    channel_id: "chan-1",
    guild_id: "srv-1",
    frame_id: `i-${CLIENT}-chan-1`,
    platform: "mobile",
  });
  const solo = new URL(
    buildActivityFrameUrl("https://app.example.com/", { instanceId: "i-x-solo", channelId: "", launchId: "L", frameId: "i-x-solo" })
  );
  assert.equal(solo.searchParams.has("channel_id"), false);
  assert.equal(solo.searchParams.has("location_id"), false);
  assert.equal(solo.searchParams.has("referrer_id"), false);
});

test("setActivity Discord şeklini yayınlanabilir etkinliğe çevirir", () => {
  const result = toSdkPresence(
    {
      activity: {
        type: 3,
        details: "Film",
        state: "Birlikte",
        party: { id: "gizli", size: [2, 4] },
        timestamps: { start: 1_700_000_100, end: 1_700_000_900 },
        assets: { large_image: "poster", large_text: "Afiş", small_image: "http://insecure.example/x.png", small_text: "x" },
      },
    },
    { clientId: CLIENT, appName: "Birlikte İzle", appIconUrl: "https://utfs.io/f/i", startedAt: 1, assets: { poster: "https://utfs.io/f/p" } }
  );
  assert.deepEqual(result, {
    kind: "set",
    activity: {
      type: "WATCHING",
      name: "Birlikte İzle",
      processName: "Birlikte İzle",
      startedAt: 1_700_000_100_000,
      details: "Film",
      state: "Birlikte",
      timestamps: { start: 1_700_000_100_000, end: 1_700_000_900_000 },
      largeImageUrl: "https://utfs.io/f/p",
      largeText: "Afiş",
      appIconUrl: "https://utfs.io/f/i",
      applicationId: CLIENT,
      partySize: [2, 4],
    },
  });
  assert.ok(!JSON.stringify(result).includes("gizli"));
});

test("setActivity: null temizler, metadata tek başına dokunmaz, geçersiz reddedilir", () => {
  const ctx = { clientId: CLIENT, appName: "Tavla", startedAt: 5 };
  assert.deepEqual(toSdkPresence({ activity: null }, ctx), { kind: "clear" });
  assert.equal(toSdkPresence({ metadata: {} }, ctx), null);
  assert.equal(toSdkPresence({ activity: "x" }, ctx).kind, "invalid");
  const plain = toSdkPresence({ activity: { type: 1, details: "a".repeat(200), party: { size: [5, 4] } } }, ctx);
  assert.equal(plain.activity.type, "PLAYING");
  assert.equal(plain.activity.details.length, 128);
  assert.equal(plain.activity.partySize, undefined);
  assert.equal(plain.activity.startedAt, 5);
});

test("görsel anahtarları ve zaman damgaları", () => {
  assert.equal(resolveAssetImage("__proto__", {}), undefined);
  assert.equal(resolveAssetImage("javascript:alert(1)", null), undefined);
  assert.equal(usesAssetKeys({ activity: { assets: { small_image: "icon" } } }), true);
  assert.equal(usesAssetKeys({ activity: { assets: { small_image: "https://a.example/b.png" } } }), false);
  assert.equal(toEpochMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(toEpochMs(0), null);
});

test("abonelikte güncel durum (Discord gibi)", () => {
  const snapshot = {
    layoutMode: "pip",
    orientation: "portrait",
    hidden: false,
    user: { id: "u1", username: "ayse", global_name: "Ayşe", avatar: null },
  };
  assert.deepEqual(currentStateFor("ACTIVITY_LAYOUT_MODE_UPDATE", snapshot), { layout_mode: "pip" });
  assert.deepEqual(currentStateFor("ORIENTATION_UPDATE", snapshot), { screen_orientation: "portrait", orientation: "portrait" });
  assert.deepEqual(currentStateFor("THERMAL_STATE_UPDATE", snapshot), { thermal_state: "nominal" });
  assert.deepEqual(currentStateFor("VISIBILITY_UPDATE", snapshot), { hidden: false });
  assert.equal(currentStateFor("CURRENT_USER_UPDATE", snapshot).username, "ayse");
  assert.equal(currentStateFor("READY", snapshot), null);
});

test("safe-area: tam ekran dikeyde alt/yanlar, klavye/yatay/mini'de 0", () => {
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  assert.deepEqual(activitySafeArea({ mode: "full", landscape: false, keyboardOpen: false, insets }), {
    top: 0,
    right: 0,
    bottom: 34,
    left: 0,
  });
  assert.equal(activitySafeArea({ mode: "full", landscape: false, keyboardOpen: true, insets }).bottom, 0);
  assert.deepEqual(activitySafeArea({ mode: "mini", landscape: false, keyboardOpen: false, insets }), {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
  assert.equal(activitySafeArea({ mode: "full", landscape: true, keyboardOpen: false, insets }).bottom, 0);
});

test("normal olmayan kapanışta mesaj", () => {
  assert.equal(closeNotice({ code: 1000, message: "x" }), null);
  assert.equal(closeNotice({ code: 4000, message: " Oda dolu \n" }), "Oda dolu");
  assert.equal(closeNotice({ code: 4000 }), null);
});
