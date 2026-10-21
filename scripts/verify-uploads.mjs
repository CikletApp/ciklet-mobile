// Yükleme adresi/hata eşlemesinin saf mantığını doğrular (kozmetik kataloğu: verify-cosmetics.mjs).
// Çalıştırma: node scripts/verify-uploads.mjs   (Node 22.18+: .ts tip ayıklama)
import assert from "node:assert/strict";
import test from "node:test";

import { UserFacingUploadError, uploadErrorMessage, uploadRouteUrl } from "../src/lib/upload-logic.ts";

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
