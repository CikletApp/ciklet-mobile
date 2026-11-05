// node --import ./tests/helpers/register-ts.mjs --test tests/domain-discovery.test.mjs
// Alan adı keşfi: imzalı `/.well-known/ciklet.json` doğrulaması. Testler
// kendi Ed25519 anahtar çiftini üretir; derlemedeki gerçek anahtar sabit kalır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { ed25519 } from "@noble/curves/ed25519.js";

import {
  DISCOVERY_MAX_BYTES,
  DISCOVERY_PUBLIC_KEYS,
  base64UrlDecode,
  builtinDiscoveryKeys,
  normalizeDiscoveredUrl,
  parseDiscoveryResponse,
  sanitizeStoredConfig,
  swapHost,
  verifyDiscoveryDocument,
} from "../src/lib/domain-discovery-verify.ts";

const NOW = 1_800_000_000;
const secret = ed25519.utils.randomSecretKey();
const publicKey = ed25519.getPublicKey(secret);
const other = ed25519.utils.randomSecretKey();
const KEYS = { t1: publicKey };
const opts = { keys: KEYS, nowSec: NOW };

const b64u = (bytes) => Buffer.from(bytes).toString("base64url");
const goodPayload = (over = {}) => ({
  v: 1,
  site: "https://yeni-ciklet.example",
  gateway: "wss://yeni-ciklet.example/gateway/ws",
  cdn: "https://cdn.yeni-ciklet.example",
  activityProxyDomain: "cikletimsi.site",
  iat: NOW - 60,
  exp: NOW + 7 * 24 * 3600,
  ...over,
});
function signed(payload, { key = secret, kid = "t1", sig, config } = {}) {
  const bytes = new TextEncoder().encode(typeof payload === "string" ? payload : JSON.stringify(payload));
  return {
    v: 1,
    kid,
    payload: b64u(bytes),
    sig: sig === undefined ? b64u(ed25519.sign(bytes, key)) : sig,
    ...(config ? { config } : {}),
  };
}

test("geçerli imza kabul edilir", () => {
  const out = verifyDiscoveryDocument(signed(goodPayload()), opts);
  assert.deepEqual(out, {
    site: "https://yeni-ciklet.example",
    gateway: "wss://yeni-ciklet.example/gateway/ws",
    cdn: "https://cdn.yeni-ciklet.example",
    activityProxyDomain: "cikletimsi.site",
    iat: NOW - 60,
    exp: NOW + 7 * 24 * 3600,
  });
  // İsteğe bağlı alanlar null; sondaki "/" ve büyük harf normalleşir.
  const minimal = verifyDiscoveryDocument(
    signed(goodPayload({ site: "https://Ciklet.XYZ/", gateway: null, cdn: null, activityProxyDomain: null })),
    opts,
  );
  assert.equal(minimal.site, "https://ciklet.xyz");
  assert.equal(minimal.gateway, null);
  // Ham yanıt yolu da aynı sonucu verir.
  assert.equal(parseDiscoveryResponse(JSON.stringify(signed(goodPayload())), opts).site, "https://yeni-ciklet.example");
});

test("imza / anahtar reddi", () => {
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { sig: null }), opts), null, "imzasız");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { key: other }), opts), null, "yanlış anahtar");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { kid: "d1" }), opts), null, "bilinmeyen kid");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { kid: "__proto__" }), opts), null, "prototip kid");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { sig: "AAAA" }), opts), null, "kısa imza");
  // Payload değiştirilmiş (imza eskisinin).
  const doc = signed(goodPayload());
  doc.payload = b64u(new TextEncoder().encode(JSON.stringify(goodPayload({ site: "https://evil.example" }))));
  assert.equal(verifyDiscoveryDocument(doc, opts), null, "değiştirilmiş payload");
  // Üst düzey sürüm yanlış.
  assert.equal(verifyDiscoveryDocument({ ...signed(goodPayload()), v: 2 }, opts), null);
  assert.equal(verifyDiscoveryDocument(null, opts), null);
  assert.equal(verifyDiscoveryDocument("x", opts), null);
});

test("config alanı ile kandırma reddedilir; yalnızca imzalı payload okunur", () => {
  const evilConfig = { site: "https://evil.example", gateway: "wss://evil.example/ws" };
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { sig: null, config: evilConfig }), opts), null);
  const out = verifyDiscoveryDocument(signed(goodPayload(), { config: evilConfig }), opts);
  assert.equal(out.site, "https://yeni-ciklet.example");
  assert.equal(out.gateway, "wss://yeni-ciklet.example/gateway/ws");
});

test("süre kuralları", () => {
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ exp: NOW })), opts), null, "süresi geçmiş");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ exp: NOW - 1 })), opts), null, "süresi geçmiş");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ iat: NOW + 301, exp: NOW + 3600 })), opts), null, "gelecek iat");
  assert.ok(verifyDiscoveryDocument(signed(goodPayload({ iat: NOW + 300, exp: NOW + 3600 })), opts), "kayma payı");
  assert.equal(
    verifyDiscoveryDocument(signed(goodPayload({ iat: NOW - 10, exp: NOW - 10 + 30 * 24 * 3600 + 1 })), opts),
    null,
    "30 günden uzun",
  );
  assert.ok(verifyDiscoveryDocument(signed(goodPayload({ iat: NOW - 10, exp: NOW - 10 + 30 * 24 * 3600 })), opts));
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ v: 2 })), opts), null, "payload v");
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ iat: "1" })), opts), null, "iat sayı değil");
  assert.equal(verifyDiscoveryDocument(signed("{bozuk json"), opts), null, "bozuk JSON");
  assert.equal(verifyDiscoveryDocument(signed("[1]"), opts), null, "dizi payload");
});

test("site adresi kuralları", () => {
  const bad = [
    "http://yeni-ciklet.example",
    "https://192.168.1.10",
    "https://127.0.0.1",
    "https://[::1]",
    "https://127.1",
    "https://localhost",
    "https://app.localhost",
    "https://intranet",
    "https://user@yeni-ciklet.example",
    "https://user:pass@yeni-ciklet.example",
    "https://evil.example\\@ciklet.xyz",
    "https://yeni-ciklet.example:8443",
    "https://yeni-ciklet.example/yol",
    "https://yeni-ciklet.example/?q=1",
    "https://yeni-ciklet.example/#x",
    "https://yeni-ciklet.example.",
    "https://-kotu.example",
    "https://ye%6Ei.example",
    "javascript:alert(1)",
    "//yeni-ciklet.example",
    "",
    null,
    42,
  ];
  for (const site of bad) {
    assert.equal(verifyDiscoveryDocument(signed(goodPayload({ site })), opts), null, String(site));
  }
});

test("gateway ve cdn kuralları", () => {
  for (const gateway of ["ws://yeni-ciklet.example/gateway/ws", "https://yeni-ciklet.example/gateway/ws", "wss://10.0.0.1/ws", "wss://a@yeni-ciklet.example/ws", "wss://yeni-ciklet.example:444/ws", "wss://yeni-ciklet.example/ws?token=1", "wss://yeni-ciklet.example/../ws"]) {
    assert.equal(verifyDiscoveryDocument(signed(goodPayload({ gateway })), opts), null, gateway);
  }
  for (const cdn of ["http://cdn.example", "wss://cdn.example", "https://localhost/x"]) {
    assert.equal(verifyDiscoveryDocument(signed(goodPayload({ cdn })), opts), null, cdn);
  }
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ activityProxyDomain: "127.0.0.1" })), opts), null);
  assert.equal(verifyDiscoveryDocument(signed(goodPayload({ activityProxyDomain: "evil.example/x" })), opts), null);
});

test("boyut sınırı ve ham yanıt", () => {
  const padded = JSON.stringify({ ...signed(goodPayload()), config: { pad: "x".repeat(DISCOVERY_MAX_BYTES) } });
  assert.equal(parseDiscoveryResponse(padded, opts), null);
  assert.equal(parseDiscoveryResponse("<html>", opts), null);
});

test("yardımcılar: base64url, gerçek anahtar, depo kaydı, host değişimi", () => {
  assert.deepEqual([...base64UrlDecode("AQID")], [1, 2, 3]);
  assert.equal(base64UrlDecode("A"), null);
  assert.equal(base64UrlDecode("a+b/"), null, "standart base64 karakteri");
  // Derlemedeki gerçek anahtar 32 bayt çözülür ve d1 kimliğiyle durur.
  assert.equal(DISCOVERY_PUBLIC_KEYS.d1, "TMB9MEQopmPGz-xewCsgeiK7mT4x2RUGLib7sfw-aL4");
  assert.equal(builtinDiscoveryKeys().d1.length, 32);
  // Test anahtarıyla imzalanan belge gerçek anahtar listesiyle reddedilir.
  assert.equal(verifyDiscoveryDocument(signed(goodPayload(), { kid: "d1" }), { keys: builtinDiscoveryKeys(), nowSec: NOW }), null);

  assert.equal(sanitizeStoredConfig({ site: "https://evil.example:1", iat: 1, exp: 2 }), null);
  assert.equal(sanitizeStoredConfig({ site: "https://ok.example", gateway: "ws://ok.example", iat: 1, exp: 2 }), null);
  assert.equal(sanitizeStoredConfig({ site: "https://ok.example", iat: 1, exp: 2 }).site, "https://ok.example");

  assert.equal(swapHost("wss://ciklet.xyz/gateway/ws", "ciklet.xyz", "yeni.example"), "wss://yeni.example/gateway/ws");
  assert.equal(swapHost("wss://lk.other.example", "ciklet.xyz", "yeni.example"), "wss://lk.other.example");
  assert.equal(normalizeDiscoveredUrl("wss://ok.example", "wss", false), "wss://ok.example");
});
