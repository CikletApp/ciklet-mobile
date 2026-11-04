// node --import ./tests/helpers/register-ts.mjs --test tests/store-browse.test.mjs
// Mağaza arama / filtre / sıralama (web lib/store-browse ile aynı kurallar).
import { test } from "node:test";
import assert from "node:assert/strict";

import { EMPTY_STORE_FILTERS, activeFilterCount, filterStoreItems, normalizeSearch, sortStoreItems } from "../src/lib/store-browse.ts";

const items = [
  { id: "a", name: "Işıklı Kafatası", description: "Korkunç", owned: false, collection: "cadilar-bayrami", themes: ["korku"], finalPrice: 30 },
  { id: "b", name: "Sakura", description: "Bahar", owned: true, collection: "bahar-bahcesi", themes: ["doga", "sevimli"], finalPrice: 10 },
  { id: "c", name: "Ay", description: "Gece", owned: false, collection: null, themes: [], finalPrice: 20 },
];

test("arama Türkçe/aksansız, tüm kelimeler", () => {
  assert.equal(normalizeSearch("  IŞIK "), "isik");
  assert.deepEqual(filterStoreItems(items, { ...EMPTY_STORE_FILTERS, query: "isikli kafa" }).map((i) => i.id), ["a"]);
  assert.deepEqual(filterStoreItems(items, { ...EMPTY_STORE_FILTERS, query: "yaz" }, (i) => (i.id === "b" ? "İlkbahar Yazı" : "")).map((i) => i.id), ["b"]);
});

test("tema VEYA, gruplar VE; sahip olduklarım, koleksiyon", () => {
  assert.deepEqual(filterStoreItems(items, { ...EMPTY_STORE_FILTERS, themes: ["korku", "doga"] }).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(filterStoreItems(items, { ...EMPTY_STORE_FILTERS, themes: ["korku", "doga"], ownedOnly: true }).map((i) => i.id), ["b"]);
  assert.deepEqual(filterStoreItems(items, { ...EMPTY_STORE_FILTERS, collection: "cadilar-bayrami" }).map((i) => i.id), ["a"]);
  assert.equal(activeFilterCount({ ...EMPTY_STORE_FILTERS, themes: ["a", "b"], ownedOnly: true, query: "x" }), 3);
});

test("sıralama kararlı", () => {
  assert.deepEqual(sortStoreItems(items, "price-asc").map((i) => i.id), ["b", "c", "a"]);
  assert.deepEqual(sortStoreItems(items, "price-desc").map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(sortStoreItems(items, "name").map((i) => i.id), ["c", "a", "b"]);
  assert.deepEqual(sortStoreItems(items, null).map((i) => i.id), ["a", "b", "c"]);
});
