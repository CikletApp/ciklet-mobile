// Yerel depo, gönderim kuyruğu, medya ön indirme kuyruğu ve tanınan oyun kuralının saf mantığını doğrular.
// Çalıştırma: node scripts/verify-local-store.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import {
  compareIds,
  pickEvictions,
  planSegmentWrite,
  snapshotSegment,
} from "../src/features/chat/message-db-logic.ts";
import { backoffMs, nextSendable, nextWakeAt, queueHeads } from "../src/stores/outbox-logic.ts";
import { createPrefetchQueue, pickVoiceTargets, prefetchBackoffMs } from "../src/lib/media-prefetch-logic.ts";
import { isRecognizedGame, parseRecognizedKeys, recognitionKey, visibleActivity } from "../src/lib/recognized-games.ts";

const msg = (id, minute, extra = {}) => ({
  id,
  createdAt: new Date(Date.UTC(2026, 9, 20, 12, minute)).toISOString(),
  ...extra,
});

test("snowflake karşılaştırması uzunluğa duyarlı", () => {
  assert.ok(compareIds("100", "99") > 0);
  assert.ok(compareIds("123", "124") < 0);
  assert.equal(compareIds("5", "5"), 0);
});

test("anlık görüntü: sayfalar birleşir, tekrar ve süresi dolan düşer, imleç korunur", () => {
  const now = Date.UTC(2026, 9, 20, 13, 0);
  const pages = [
    { items: [msg("6", 6), msg("5", 5), msg("4", 4, { expiresAt: "2026-10-20T12:30:00.000Z" })], nextCursor: "4" },
    { items: [msg("4", 4), msg("3", 3)], nextCursor: "3" },
  ];
  const segment = snapshotSegment(pages, 100, now);
  assert.deepEqual(segment.items.map((m) => m.id), ["6", "5", "3"]);
  assert.equal(segment.cursor, "3");
});

test("anlık görüntü: üst sınırda kesilir, imleç tutulan en eski mesaj", () => {
  const pages = [{ items: [msg("4", 4), msg("3", 3), msg("2", 2)], nextCursor: null }];
  const segment = snapshotSegment(pages, 2, 0);
  assert.deepEqual(segment.items.map((m) => m.id), ["4", "3"]);
  assert.equal(segment.cursor, "3");
  // Kesilmediyse son sayfanın imleci (null = geçmişin başı).
  assert.equal(snapshotSegment(pages, 10, 0).cursor, null);
  assert.equal(snapshotSegment([], 10, 0), null);
});

test("birleştirme: örtüşmede eski kesim korunur, aradaki silinenler düşer", () => {
  const plan = planSegmentWrite({
    snapshotIds: new Set(["10", "9", "7"]),
    snapshotCursor: "7",
    overlap: true,
    storedInRange: ["9", "8", "7"],
    storedCursor: "1",
  });
  assert.deepEqual(plan.deleteIds, ["8"]);
  assert.equal(plan.deleteOlder, false);
  assert.equal(plan.nextCursor, "1");
});

test("birleştirme: örtüşme yoksa (boşluk) eski kesim atılır", () => {
  const plan = planSegmentWrite({
    snapshotIds: new Set(["60", "59"]),
    snapshotCursor: "59",
    overlap: false,
    storedInRange: [],
    storedCursor: "1",
  });
  assert.equal(plan.deleteOlder, true);
  assert.equal(plan.nextCursor, "59");
});

test("birleştirme: geçmişin başına ulaşıldıysa daha eskisi kalmaz", () => {
  const plan = planSegmentWrite({
    snapshotIds: new Set(["3", "2"]),
    snapshotCursor: null,
    overlap: true,
    storedInRange: ["3", "2"],
    storedCursor: "1",
  });
  assert.equal(plan.deleteOlder, true);
  assert.equal(plan.nextCursor, null);
});

test("LRU: en eski açılan sohbetler atılır, açık sohbet korunur", () => {
  const chats = [
    { chatId: "a", lastAccess: 1, bytes: 50 },
    { chatId: "b", lastAccess: 2, bytes: 50 },
    { chatId: "c", lastAccess: 3, bytes: 50 },
  ];
  assert.deepEqual(pickEvictions(chats, { maxChats: 2, maxBytes: 1e9 }), ["a"]);
  assert.deepEqual(pickEvictions(chats, { maxChats: 10, maxBytes: 60 }), ["a", "b"]);
  assert.deepEqual(pickEvictions(chats, { maxChats: 2, maxBytes: 1e9 }, new Set(["a"])), ["b"]);
  assert.deepEqual(pickEvictions(chats, { maxChats: 5, maxBytes: 1e9 }), []);
});

const entry = (id, chatId, second, status = "queued", nextAttemptAt = 0) => ({
  id,
  chatId,
  createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, second)).toISOString(),
  status,
  nextAttemptAt,
});

test("kuyruk: sohbet içinde yazılış sırası, sohbetler arası en eski önce", () => {
  const entries = [entry("b2", "B", 4), entry("a2", "A", 3), entry("a1", "A", 1), entry("b1", "B", 2)];
  assert.deepEqual(queueHeads(entries).map((e) => e.id), ["a1", "b1"]);
  assert.equal(nextSendable(entries, 0).id, "a1");
});

test("kuyruk: uçuştaki mesaj sohbetin sonrakilerini bekletir, başarısız tıkamaz", () => {
  const sending = [entry("a1", "A", 1, "sending"), entry("a2", "A", 2)];
  assert.equal(nextSendable(sending, 0), null);
  const failed = [entry("a1", "A", 1, "failed"), entry("a2", "A", 2)];
  assert.equal(nextSendable(failed, 0).id, "a2");
});

test("kuyruk: bekleme süresi dolmadan gönderilmez; uyanma zamanı en erken bekleyen", () => {
  const entries = [entry("a1", "A", 1, "queued", 5_000), entry("b1", "B", 2, "queued", 3_000)];
  assert.equal(nextSendable(entries, 1_000), null);
  assert.equal(nextWakeAt(entries, 1_000), 3_000);
  assert.equal(nextSendable(entries, 4_000).id, "b1");
});

test("üstel bekleme 60 sn ile sınırlı", () => {
  assert.equal(backoffMs(0, 0.5), 1000);
  assert.equal(backoffMs(3, 0.5), 8000);
  assert.equal(backoffMs(20, 0.5), 60_000);
  assert.ok(backoffMs(2, 0) < backoffMs(2, 1));
});

// ── Sesli mesaj arka plan indirme kuyruğu (src/lib/media-prefetch-logic.ts) ──

function fakeQueue(overrides = {}) {
  const state = { now: 0, online: true, done: new Set(), calls: [], pending: new Map(), timers: [] };
  const queue = createPrefetchQueue({
    concurrency: 2,
    maxJobs: 4,
    maxAttempts: 3,
    run: (url) => {
      state.calls.push(url);
      return new Promise((resolve, reject) => state.pending.set(url, { resolve, reject }));
    },
    isDone: (url) => state.done.has(url),
    canRun: () => state.online,
    now: () => state.now,
    random: () => 0.5,
    setTimer: (fn, ms) => {
      const timer = { fn, at: state.now + ms, cleared: false };
      state.timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timer.cleared = true;
    },
    ...overrides,
  });
  const settle = async (url, ok = true, err = new Error("ağ")) => {
    const entry = state.pending.get(url);
    state.pending.delete(url);
    if (ok) {
      state.done.add(url);
      entry.resolve();
    } else entry.reject(err);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const tick = (ms) => {
    state.now += ms;
    for (const timer of state.timers.splice(0)) {
      if (!timer.cleared && timer.at <= state.now) timer.fn();
      else if (!timer.cleared) state.timers.push(timer);
    }
  };
  return { queue, state, settle, tick };
}

test("ön indirme: en yeni önce, en çok 2 eşzamanlı, tekrar eklenen tekilleşir", async () => {
  const { queue, state, settle } = fakeQueue();
  queue.add([
    { url: "a", priority: 1 },
    { url: "b", priority: 3 },
    { url: "c", priority: 2 },
    { url: "b", priority: 3 },
  ]);
  assert.deepEqual(state.calls, ["b", "c"]);
  queue.add([{ url: "b", priority: 9 }]);
  assert.equal(queue.stats().waiting, 1);
  await settle("b");
  assert.deepEqual(state.calls, ["b", "c", "a"]);
});

test("ön indirme: cihazdaki atlanır, kuyruk sınırında en eskiler düşer", () => {
  const { queue, state } = fakeQueue({ concurrency: 0 });
  state.done.add("x");
  queue.add([{ url: "x", priority: 10 }]);
  assert.equal(queue.stats().waiting, 0);
  queue.add([1, 2, 3, 4, 5, 6].map((n) => ({ url: `m${n}`, priority: n })));
  assert.equal(queue.stats().waiting, 4);
  assert.equal(state.calls.length, 0);
});

test("ön indirme: çevrimdışı bekler, bağlantı gelince sürer; ağsız hata deneme sayılmaz", async () => {
  const { queue, state, settle } = fakeQueue();
  state.online = false;
  queue.add([{ url: "a", priority: 1 }]);
  assert.equal(state.calls.length, 0);
  state.online = true;
  queue.resume();
  assert.deepEqual(state.calls, ["a"]);
  state.online = false;
  await settle("a", false);
  assert.equal(queue.stats().waiting, 1);
  state.online = true;
  queue.resume();
  assert.deepEqual(state.calls, ["a", "a"]);
});

test("ön indirme: hata üstel beklemeyle denenir, sınırda bırakılır; kalıcı hata hemen", async () => {
  const { queue, state, settle, tick } = fakeQueue();
  queue.add([{ url: "a", priority: 1 }]);
  await settle("a", false);
  assert.equal(state.calls.length, 1);
  tick(prefetchBackoffMs(0, 0.5) - 1);
  assert.equal(state.calls.length, 1);
  tick(1);
  assert.equal(state.calls.length, 2);
  await settle("a", false);
  tick(prefetchBackoffMs(1, 0.5));
  await settle("a", false);
  assert.deepEqual(queue.stats(), { waiting: 0, running: 0, gaveUp: 1 });
  // Bırakılan, bağlantı/ön plan gelene kadar yeniden eklenmez.
  queue.add([{ url: "a", priority: 1 }]);
  assert.equal(state.calls.length, 3);

  queue.add([{ url: "big", priority: 2 }]);
  await settle("big", false, Object.assign(new Error("büyük"), { permanent: true }));
  assert.equal(queue.stats().gaveUp, 2);
  // Bağlantı/ön plan: bırakılanlar yeniden eklenebilir.
  queue.resume();
  queue.add([{ url: "a", priority: 1 }]);
  assert.equal(state.calls.length, 5);
});

test("ön indirme: temizlikten sonra uçuştaki sonucu yok sayılır", async () => {
  const { queue, state, settle } = fakeQueue();
  queue.add([{ url: "a", priority: 1 }, { url: "b", priority: 0 }, { url: "c", priority: -1 }]);
  queue.clear();
  await settle("a", false);
  assert.deepEqual(queue.stats(), { waiting: 0, running: 0, gaveUp: 0 });
  assert.equal(state.calls.length, 2);
});

test("üstel bekleme (indirme) 5 dk ile sınırlı", () => {
  assert.equal(prefetchBackoffMs(0, 0.5), 2000);
  assert.equal(prefetchBackoffMs(2, 0.5), 8000);
  assert.equal(prefetchBackoffMs(30, 0.5), 300_000);
});

test("sesli mesaj seçimi: en yeniler, silinen/süresi dolan/büyük/ses olmayan atlanır", () => {
  const voice = (id, minute, extra = {}) =>
    msg(id, minute, { fileUrl: `https://cdn/${id}.m4a`, metadata: { voice: { durationMs: 1000 } }, ...extra });
  const pages = [
    {
      items: [
        voice("9", 9),
        msg("8", 8, { fileUrl: "https://cdn/8.png", metadata: {} }),
        voice("7", 7, { deleted: true }),
        voice("6", 6, { expiresAt: "2026-10-20T12:00:30.000Z" }),
        voice("5", 5, { metadata: { voice: { durationMs: 1 }, attachment: { size: 20 * 1024 * 1024 } } }),
        voice("4", 4, { fileUrl: "file:///yerel.m4a" }),
      ],
    },
    { items: [voice("3", 3), voice("2", 2), voice("1", 1)] },
  ];
  const options = {
    maxTargets: 3,
    maxScan: 100,
    maxBytes: 15 * 1024 * 1024,
    isVoice: (m) => Boolean(m.metadata?.voice),
    now: Date.UTC(2026, 9, 20, 13, 0),
  };
  const picked = pickVoiceTargets(pages, options);
  assert.deepEqual(picked.map((t) => t.url), ["https://cdn/9.m4a", "https://cdn/3.m4a", "https://cdn/2.m4a"]);
  assert.equal(picked[0].priority, Date.UTC(2026, 9, 20, 12, 9));
  // Tarama sınırı: dev geçmişin tamamına bakılmaz.
  assert.deepEqual(pickVoiceTargets(pages, { ...options, maxScan: 6 }).map((t) => t.url), ["https://cdn/9.m4a"]);
  assert.deepEqual(pickVoiceTargets(undefined, options), []);
});

// ── Tanınan oyunlar (src/lib/recognized-games.ts — web ile birebir) ──

test("tanıma anahtarı: web normalizeGameName ile aynı, Latin dışı ad ham küçük harf", () => {
  assert.equal(recognitionKey("VALORANT"), "valorant");
  assert.equal(recognitionKey("Valorant™"), "valorant");
  assert.equal(recognitionKey("  Pokémon® Légendes: Z-A "), "pokemon legendes z a");
  assert.equal(recognitionKey("原神"), "原神");
  assert.equal(recognitionKey("  ГТА  "), "гта");
});

test("tanıma: oyun/program kovası küme yokken gizli, müzik/yayın hep görünür", () => {
  const set = parseRecognizedKeys({ keys: ["valorant", 3, null, "visual studio code"] });
  assert.deepEqual([...set], ["valorant", "visual studio code"]);
  for (const type of ["PLAYING", "COMPETING", "WORKING", "CREATING"]) {
    assert.equal(isRecognizedGame(null, "VALORANT", type), false);
    assert.equal(isRecognizedGame(set, "VALORANT", type), true);
    assert.equal(isRecognizedGame(set, "Kendi Uygulamam", type), false);
  }
  for (const type of ["LISTENING", "WATCHING", "STREAMING"]) assert.equal(isRecognizedGame(null, "Spotify", type), true);
  assert.equal(isRecognizedGame(set, "", "PLAYING"), false);
  const game = { name: "Visual Studio Code", type: "WORKING" };
  assert.equal(visibleActivity(game, set), game);
  assert.equal(visibleActivity({ name: "x", type: "PLAYING" }, set), null);
  assert.equal(visibleActivity(null, set), null);
  assert.deepEqual([...parseRecognizedKeys(null)], []);
});
