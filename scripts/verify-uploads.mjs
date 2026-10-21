// Yükleme adresi/hata eşlemesi ve profil efekti kataloğunun saf mantığını doğrular.
// Çalıştırma: node scripts/verify-uploads.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import { UserFacingUploadError, uploadErrorMessage, uploadRouteUrl } from "../src/lib/upload-logic.ts";
import { PROFILE_EFFECTS, effectFrame, effectParticles, findProfileEffect } from "../src/lib/profile-effects.ts";

test("yükleme adresi çağrı anındaki global URL sınıfıyla kurulur", () => {
  const url = uploadRouteUrl("https://ciklet.xyz");
  assert.equal(url.href, "https://ciklet.xyz/api/uploadthing");
  assert.ok(url instanceof globalThis.URL);

  // LiveKit `setupURLPolyfill()` global URL'i değiştirir: önceden kurulan
  // nesne yeni sınıfın örneği DEĞİL (asıl hata), çağrı anında kurulan öyle.
  const before = uploadRouteUrl("https://ciklet.xyz");
  const original = globalThis.URL;
  class PolyfillURL extends original {}
  globalThis.URL = PolyfillURL;
  try {
    assert.equal(before instanceof globalThis.URL, false);
    assert.ok(uploadRouteUrl("https://ciklet.xyz") instanceof globalThis.URL);
  } finally {
    globalThis.URL = original;
  }
});

test("yükleme hataları Türkçe ve anlaşılır", () => {
  // Hermes'in ham TypeError iletisi asla ekrana çıkmaz.
  assert.equal(
    uploadErrorMessage(new TypeError("Cannot read property 'origin' of undefined")),
    "Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene."
  );
  assert.equal(uploadErrorMessage({ code: "TOO_LARGE" }), "Dosya bu plan için çok büyük.");
  assert.equal(uploadErrorMessage({ code: "FILE_LIMIT_EXCEEDED" }), "Dosya bu plan için çok büyük.");
  assert.equal(uploadErrorMessage({ code: "FORBIDDEN" }), "Bu dosyayı yükleme iznin yok.");
  assert.equal(uploadErrorMessage(null), "Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene.");
  const own = new UserFacingUploadError("Bu plan için tek dosya üst sınırı 8 MB.");
  assert.equal(uploadErrorMessage(own), own.message);
});

test("profil efekti kataloğu web ile aynı kimlikleri taşır", () => {
  // ciklet-web src/lib/store-catalog.ts PROFILE_EFFECTS sırası.
  assert.deepEqual(
    PROFILE_EFFECTS.map((e) => e.id),
    [
      "fx_bubbles",
      "fx_leaves",
      "fx_turkiye",
      "fx_mint",
      "fx_sparkle",
      "fx_sakura",
      "fx_fireflies",
      "fx_confetti",
      "fx_snow",
      "fx_hearts",
      "fx_stars",
    ]
  );
  assert.equal(new Set(PROFILE_EFFECTS.map((e) => e.id)).size, PROFILE_EFFECTS.length);
  assert.equal(findProfileEffect("fx_snow")?.motion, "fall");
  assert.equal(findProfileEffect("fx_turkiye")?.art, "turkiye");
  assert.equal(findProfileEffect("yok"), null);
  assert.equal(findProfileEffect(null), null);
});

test("parçacık yuvaları ve zamanlaması web formülüyle aynı", () => {
  const particles = effectParticles(findProfileEffect("fx_stars"));
  assert.equal(particles.length, 7);
  assert.deepEqual(particles.map((p) => p.left), [8, 22, 37, 51, 64, 78, 91]);
  assert.deepEqual(particles.map((p) => p.top), [18, 62, 34, 76, 22, 55, 40]);
  assert.deepEqual(particles.map((p) => p.glyph), ["⭐", "🌟", "✦", "⭐", "🌟", "✦", "⭐"]);
  assert.equal(particles[1].delayMs, 610);
  assert.equal(particles[1].durationMs, 4100);
  assert.ok(effectParticles(findProfileEffect("fx_snow")).every((p) => p.top === null));
});

test("hareket kareleri: yağan aşağı iner, yükselen yukarı çıkar, uçlarda solar", () => {
  const fallStart = effectFrame("fall", 0, 100);
  const fallEnd = effectFrame("fall", 1, 100);
  assert.ok(fallEnd.translateY > fallStart.translateY);
  assert.equal(fallStart.opacity, 0);
  assert.equal(effectFrame("fall", 0.5, 100).opacity, 1);

  const riseStart = effectFrame("rise", 0, 100);
  const riseEnd = effectFrame("rise", 1, 100);
  assert.ok(riseEnd.translateY < riseStart.translateY);
  assert.equal(riseEnd.opacity, 0);

  const dim = effectFrame("twinkle", 0, 100);
  const bright = effectFrame("twinkle", 0.5, 100);
  assert.ok(Math.abs(dim.opacity - 0.15) < 1e-9);
  assert.ok(Math.abs(bright.opacity - 1) < 1e-9);
  assert.ok(bright.scale > dim.scale);
});
