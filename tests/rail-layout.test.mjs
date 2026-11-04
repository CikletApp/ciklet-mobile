// node --import ./tests/helpers/register-ts.mjs --test tests/rail-layout.test.mjs
// Sunucu listesi v2 düzen işlemleri — web tests/unit/sidebar-layout.test.ts ile
// aynı beklentiler (iki kopya aynı sonucu vermeli).
import { test } from "node:test";
import assert from "node:assert/strict";

import { applyDrop, moveRootBy, normalizeLayout, removeFromFolder } from "../src/lib/rail-layout.ts";
import { computeRailDrop } from "../src/features/server-rail-v2/rail-drop.ts";

const base = [
  { type: "server", id: "a" },
  { type: "folder", id: "f1", serverIds: ["b", "c"] },
  { type: "server", id: "d" },
  { type: "server", id: "e" },
];

test("kökte taşıma, birleşme ile klasör, klasörden çıkarma", () => {
  assert.deepEqual(applyDrop(base, "a", { kind: "root", index: 4 }).map((i) => i.id), ["f1", "d", "e", "a"]);
  assert.deepEqual(
    applyDrop(base, "e", { kind: "combine", serverId: "a", newFolderId: "newfolder00001" })[0],
    { type: "folder", id: "newfolder00001", serverIds: ["a", "e"] },
  );
  assert.deepEqual(
    removeFromFolder(base, "b").map((i) => `${i.type}:${i.id}`),
    ["server:a", "server:c", "server:b", "server:d", "server:e"],
  );
  assert.deepEqual(moveRootBy(base, "a", "down").map((i) => i.id), ["f1", "a", "d", "e"]);
  assert.deepEqual(normalizeLayout([{ type: "folder", id: "y", serverIds: ["s"] }]), [{ type: "server", id: "s" }]);
});

test("bırakma hedefi: kenar çizgi, orta birleşme, bant içi", () => {
  const slots = [
    { kind: "server", id: "a", rootIndex: 0, top: 0, bottom: 48 },
    { kind: "folder", id: "f1", rootIndex: 1, open: true, childCount: 2, top: 56, bottom: 112 },
    { kind: "child", id: "b", rootIndex: 1, folderId: "f1", childIndex: 0, top: 112, bottom: 160 },
    { kind: "child", id: "c", rootIndex: 1, folderId: "f1", childIndex: 1, top: 168, bottom: 216 },
    { kind: "server", id: "d", rootIndex: 2, top: 236, bottom: 284 },
  ];
  assert.deepEqual(computeRailDrop(slots, "d", 4).target, { kind: "root", index: 0 });
  assert.deepEqual(computeRailDrop(slots, "d", 24).target, { kind: "combine", serverId: "a" });
  assert.deepEqual(computeRailDrop(slots, "a", 150).target, { kind: "folder", folderId: "f1", index: 1 });
  assert.deepEqual(computeRailDrop(slots, "a", 225).target, { kind: "root", index: 2 });
});
