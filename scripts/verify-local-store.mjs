// Yerel depo ve gönderim kuyruğunun saf kurallarını doğrular.
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
