// Discord uyumlu grup ve düğmeler (lib/activity-party) — ciklet-web
// lib/activity-party ile aynı kural.
// Çalıştırma: node scripts/verify-activity-party.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import { activityButtons, partySize, partySizeLabel, stateWithParty } from "../src/lib/activity-party.ts";

test("grup boyutu (2/4) olarak yazılır", () => {
  assert.equal(partySizeLabel({ partySize: [2, 4] }), "(2/4)");
  assert.equal(partySizeLabel({ partySize: [4, 4] }), "(4/4)");
  assert.equal(partySizeLabel({ partySize: [1, 1_000_000] }), "(1/1000000)");
  assert.deepEqual(partySize({ partySize: [1, 5] }), [1, 5]);
});

test("geçersiz grup boyutu yok sayılır", () => {
  for (const partySize of [
    undefined,
    null,
    [],
    [2],
    [2, 4, 6],
    [0, 4],
    [5, 4],
    [2, 1_000_001],
    [1.5, 4],
    ["2", "4"],
    [-1, 4],
    [Number.NaN, 4],
    "2/4",
  ]) {
    assert.equal(partySizeLabel({ partySize }), null, JSON.stringify(partySize));
  }
  assert.equal(partySizeLabel(null), null);
  assert.equal(partySizeLabel(undefined), null);
});

test("durum satırı: durum + grup", () => {
  assert.equal(stateWithParty({ state: "Rekabetçi", partySize: [2, 4] }), "Rekabetçi (2/4)");
  assert.equal(stateWithParty({ partySize: [2, 4] }), "(2/4)");
  assert.equal(stateWithParty({ state: "   ", partySize: [2, 4] }), "(2/4)");
  assert.equal(stateWithParty({ state: "Lobide" }), "Lobide");
  assert.equal(stateWithParty({ state: "Lobide", partySize: [9, 4] }), "Lobide");
  assert.equal(stateWithParty({}), null);
  assert.equal(stateWithParty(null), null);
});

test("düğmeler: en çok 2, yalnızca https, etiket 1–32", () => {
  const ok = activityButtons({
    buttons: [
      { label: "  Sunucuya Katıl  ", url: "https://example.com/join" },
      { label: "Web", url: "https://example.org" },
      { label: "Üçüncü", url: "https://example.net" },
    ],
  });
  assert.deepEqual(ok, [
    { label: "Sunucuya Katıl", url: "https://example.com/join" },
    { label: "Web", url: "https://example.org" },
  ]);

  const filtered = activityButtons({
    buttons: [
      { label: "http", url: "http://example.com" },
      { label: "js", url: "javascript:alert(1)" },
      { label: "", url: "https://example.com" },
      { label: "   ", url: "https://example.com" },
      { label: "x".repeat(33), url: "https://example.com" },
      { label: "kimlik", url: "https://user@evil.example/x" },
      { label: "ters bölü", url: "https://evil.example\\@ciklet.xyz" },
      { label: "uzun", url: `https://example.com/${"a".repeat(600)}` },
      { label: "boş host", url: "https:///x" },
      { label: 5, url: "https://example.com" },
      null,
      "metin",
      { label: "Geçerli", url: "https://ok.example/a?b=c" },
    ],
  });
  assert.deepEqual(filtered, [{ label: "Geçerli", url: "https://ok.example/a?b=c" }]);
});

test("32 kod noktası sınırı emojiyi bölmez", () => {
  const label = "🎮".repeat(32);
  assert.equal(activityButtons({ buttons: [{ label, url: "https://a.example" }] }).length, 1);
  assert.equal(activityButtons({ buttons: [{ label: `${label}x`, url: "https://a.example" }] }).length, 0);
});

test("düğme listesi yoksa ya da bozuksa boş", () => {
  assert.deepEqual(activityButtons({}), []);
  assert.deepEqual(activityButtons({ buttons: "x" }), []);
  assert.deepEqual(activityButtons(null), []);
});
