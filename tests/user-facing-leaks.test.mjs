// node --import ./tests/helpers/register-ts.mjs --test tests/user-facing-leaks.test.mjs
// Kullanıcıya görünen metinlerde iç teknoloji adı (Next.js, Expo, LiveKit…),
// ortam değişkeni ya da ham JS hatası olmamalı. Sözlüklerin (16 dil),
// app.json izin metinlerinin ve hata → metin çevirisinin denetimi.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { LOCALES } from "../src/lib/i18n/locales.ts";
import { en } from "../src/lib/i18n/messages/en.ts";
import { tr } from "../src/lib/i18n/messages/tr.ts";
import { isTechnicalMessage, userErrorMessage } from "../src/lib/user-error.ts";

const FORBIDDEN =
  /next\.?js|vercel|prisma|drizzle|mongo|redis|postgres|livekit|uploadthing|\bexpo\b|react[ -]?native|hermes|nginx|docker|process\.env|EXPO_PUBLIC|NEXT_PUBLIC|TypeError|ReferenceError|SyntaxError|network request failed|localhost|127\.0\.0\.1|node_modules/i;

const leaves = (node, prefix = "", out = new Map()) => {
  if (typeof node === "string") out.set(prefix, node);
  else for (const [k, v] of Object.entries(node)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
};

test("sözlükler (16 dil): iç teknoloji adı / ham hata yok", async () => {
  const dicts = { tr, en };
  for (const locale of LOCALES.filter((l) => l !== "tr" && l !== "en")) {
    dicts[locale] = (await import(`../src/lib/i18n/messages/locales/${locale}/index.ts`)).messages;
  }
  assert.equal(Object.keys(dicts).length, 16);
  const hits = [];
  for (const [locale, dict] of Object.entries(dicts)) {
    for (const [key, text] of leaves(dict)) if (FORBIDDEN.test(text)) hits.push(`${locale}:${key}: ${text}`);
  }
  assert.deepEqual(hits, []);
});

test("app.json: ad, izin açıklamaları ve eklenti metinleri temiz", () => {
  const app = JSON.parse(fs.readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo;
  const texts = [app.name, app.description ?? "", ...Object.values(app.ios?.infoPlist ?? {}).filter((v) => typeof v === "string")];
  for (const plugin of app.plugins ?? []) {
    if (!Array.isArray(plugin)) continue;
    for (const [key, value] of Object.entries(plugin[1] ?? {})) {
      if (typeof value === "string" && /permission|description|text|title/i.test(key)) texts.push(value);
    }
  }
  assert.deepEqual(texts.filter((text) => FORBIDDEN.test(text)), []);
});

const apiError = (message) => Object.assign(new Error(message), { name: "ApiError" });

test("userErrorMessage: yalnızca kullanıcı için yazılmış metin geçer", () => {
  assert.equal(userErrorMessage(apiError("Bu kanala yazma iznin yok."), "yedek"), "Bu kanala yazma iznin yok.");
  const upload = Object.assign(new Error("Rol simgesi en fazla 256 KB olabilir."), { name: "UserFacingUploadError" });
  assert.equal(userErrorMessage(upload, "yedek"), "Rol simgesi en fazla 256 KB olabilir.");

  // Ham JS / yerel modül / kütüphane iletileri — yedek metin.
  assert.equal(userErrorMessage(new TypeError("Network request failed"), "yedek"), "yedek");
  assert.equal(userErrorMessage(new Error("profileId yok"), "yedek"), "yedek");
  assert.equal(
    userErrorMessage(new Error("Call to function 'ExponentImagePicker.launchImageLibraryAsync' has been rejected."), "yedek"),
    "yedek",
  );
  assert.equal(userErrorMessage("dize", "yedek"), "yedek");
  assert.equal(userErrorMessage(null, "yedek"), "yedek");
  assert.equal(userErrorMessage(undefined, "yedek"), "yedek");

  // Sunucu tarafında ham sızıntı — ApiError olsa da yedek.
  for (const leaked of [
    "HTTP 502",
    "",
    "   ",
    "<html><body>Bad Gateway</body></html>",
    "PrismaClientKnownRequestError: Unique constraint failed",
    "Invalid `prisma.user.findUnique()` invocation",
    "connect ECONNREFUSED 127.0.0.1:6379",
    "MongoServerError: E11000",
    "TypeError: Cannot read properties of undefined (reading 'id')",
    "Error: boom\n    at handler (/app/.next/server/app/api/route.js:1:2)",
    "Missing EXPO_PUBLIC_API_URL",
    "process.env.DATABASE_URL tanımlı değil",
    "LiveKit sunucusuna ulaşılamadı",
    "Next.js route handler failed",
    "x".repeat(401),
  ]) {
    assert.equal(userErrorMessage(apiError(leaked), "yedek"), "yedek", leaked);
    assert.equal(isTechnicalMessage(leaked), true, leaked);
  }
});
