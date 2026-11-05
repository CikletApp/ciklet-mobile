import { ed25519 } from "@noble/curves/ed25519.js";

/**
 * Alan adı keşfi — SAF doğrulama (RN bağımlılığı yok; birim testi
 * tests/domain-discovery.test.mjs).
 *
 * Site `GET <köken>/.well-known/ciklet.json` ile imzalı bir yapılandırma
 * yayımlar; eski sürüm uygulamalar alan adı değişince yeni kökü buradan
 * öğrenir (web ucu: ciklet-web `/.well-known/ciklet.json`).
 *
 *   { "v": 1, "kid": "d1",
 *     "payload": base64url(UTF-8 JSON baytları),
 *     "sig": base64url(Ed25519(payload'ın ÇÖZÜLMÜŞ baytları)) | null,
 *     "config": { … bilgi amaçlı, GÜVENİLMEZ } }
 *
 * Ele geçirilmiş bir yanıt kullanıcıyı kötü bir alana götürmesin diye
 * yalnızca bilinen anahtarla imzalanmış `payload` kabul edilir; `config`
 * alanına hiç bakılmaz. Her ret `null` döner (çağıran mevcut kökte kalır).
 */

/** Yanıt gövdesi üst sınırı (bayt; UTF-16 uzunluğu üst sınırı da bu). */
export const DISCOVERY_MAX_BYTES = 16 * 1024;
/** İmzalı belgenin en uzun geçerlilik süresi. */
export const DISCOVERY_MAX_LIFETIME_SEC = 30 * 24 * 60 * 60;
/** Saat kayması payı: `iat` en çok bu kadar gelecekte olabilir. */
export const DISCOVERY_CLOCK_SKEW_SEC = 300;
export const DISCOVERY_PATH = "/.well-known/ciklet.json";

/**
 * Bilinen imza anahtarları (kid → ham 32 bayt Ed25519 açık anahtarı,
 * base64url). Anahtar dönüşünde yenisi eklenir, eskisi bir sürüm kalır.
 */
export const DISCOVERY_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  d1: "TMB9MEQopmPGz-xewCsgeiK7mT4x2RUGLib7sfw-aL4",
};

export interface DiscoveredConfig {
  /** Site/API kökeni, ör. `https://ciklet.xyz` (sonda eğik çizgi yok). */
  site: string;
  /** Ağ geçidi adresi (`wss:`); yoksa siteden türetilir. */
  gateway: string | null;
  cdn: string | null;
  activityProxyDomain: string | null;
  iat: number;
  exp: number;
}

// ── Kodlama ─────────────────────────────────────────────────────────

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64URL_INDEX = new Map([...B64URL].map((ch, i) => [ch, i]));

/** base64url (dolgu `=` isteğe bağlı) → bayt; geçersizse null. */
export function base64UrlDecode(input: string): Uint8Array | null {
  if (typeof input !== "string") return null;
  const text = input.replace(/=+$/, "");
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (const ch of text) {
    const value = B64URL_INDEX.get(ch);
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

/** Katı UTF-8 çözümü (Hermes'te TextDecoder her sürümde yok); geçersizse null. */
function utf8Decode(bytes: Uint8Array): string | null {
  let encoded = "";
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, "0")}`;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

// ── Adres kuralları ─────────────────────────────────────────────────

/** Alan adı: noktalı, IP değil, localhost değil, yalnızca [a-z0-9-] etiketleri. */
export function isPublicDomainName(rawHost: string): boolean {
  const host = rawHost.toLowerCase();
  if (!host || host.length > 253 || !host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  const labels = host.split(".");
  for (const label of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return false;
  }
  // Üst düzey etiket hiçbir zaman tamamen sayısal değildir (IPv4 ve
  // "127.1" gibi kısaltmalar burada düşer).
  if (/^\d+$/.test(labels[labels.length - 1])) return false;
  return true;
}

/**
 * Adresi ayrıştırıp kurallara uyuyorsa normal biçimini döndürür.
 * `originOnly`: yol yalnızca boş ya da `/` olabilir (site kökü).
 * Her durumda: verilen şema, kullanıcı adı/parola yok, port yok, sorgu ve
 * parça yok, ters bölü/boşluk/yüzde kodlaması yok, ana bilgisayar alan adı.
 */
export function normalizeDiscoveredUrl(
  raw: unknown,
  scheme: "https" | "wss",
  originOnly: boolean
): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)$/i.exec(raw);
  if (!match) return null;
  const [, rawScheme, authority, path] = match;
  if (rawScheme.toLowerCase() !== scheme) return null;
  // `@` → kullanıcı bilgisi; `:` → port (IPv6 değişmezi de burada düşer).
  if (!authority || /[@:\\\s%[\]]/.test(authority)) return null;
  const host = authority.toLowerCase();
  if (host.endsWith(".") || !isPublicDomainName(host)) return null;
  if (/[\\\s%]/.test(path)) return null;
  if (originOnly) {
    if (path !== "" && path !== "/") return null;
    return `${scheme}://${host}`;
  }
  if (path !== "" && !/^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/.test(path)) return null;
  if (/(^|\/)\.\.?(\/|$)/.test(path)) return null;
  return `${scheme}://${host}${path}`;
}

// ── Doğrulama ───────────────────────────────────────────────────────

export interface VerifyOptions {
  /** kid → ham 32 bayt açık anahtar. Testler kendi anahtarını verir. */
  keys: Readonly<Record<string, Uint8Array>>;
  /** Şimdiki zaman, unix saniye. */
  nowSec: number;
}

/** Derlemedeki anahtar listesi (bayt). */
export function builtinDiscoveryKeys(): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [kid, encoded] of Object.entries(DISCOVERY_PUBLIC_KEYS)) {
    const key = base64UrlDecode(encoded);
    if (key && key.length === 32) out[kid] = key;
  }
  return out;
}

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

/** Çözülmüş belge → doğrulanmış yapılandırma ya da null. */
export function verifyDiscoveryDocument(doc: unknown, options: VerifyOptions): DiscoveredConfig | null {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
  const { v, kid, payload, sig } = doc as Record<string, unknown>;
  if (v !== 1 || typeof kid !== "string" || typeof payload !== "string" || typeof sig !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(options.keys, kid)) return null;
  const publicKey = options.keys[kid];
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) return null;

  const message = base64UrlDecode(payload);
  const signature = base64UrlDecode(sig);
  if (!message || !signature || signature.length !== 64) return null;
  let valid = false;
  try {
    valid = ed25519.verify(signature, message, publicKey);
  } catch {
    valid = false;
  }
  if (!valid) return null;

  const text = utf8Decode(message);
  if (text === null) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const p = body as Record<string, unknown>;
  if (p.v !== 1 || !isInt(p.iat) || !isInt(p.exp)) return null;
  const now = Math.floor(options.nowSec);
  if (!(p.exp > now)) return null;
  if (p.iat > now + DISCOVERY_CLOCK_SKEW_SEC) return null;
  if (p.exp - p.iat > DISCOVERY_MAX_LIFETIME_SEC || p.exp <= p.iat) return null;

  const site = normalizeDiscoveredUrl(p.site, "https", true);
  if (!site) return null;
  const optional = (value: unknown, scheme: "https" | "wss") => {
    if (value === undefined || value === null) return { ok: true as const, value: null };
    const normalized = normalizeDiscoveredUrl(value, scheme, false);
    return normalized ? { ok: true as const, value: normalized } : { ok: false as const, value: null };
  };
  const gateway = optional(p.gateway, "wss");
  const cdn = optional(p.cdn, "https");
  if (!gateway.ok || !cdn.ok) return null;

  let activityProxyDomain: string | null = null;
  if (p.activityProxyDomain !== undefined && p.activityProxyDomain !== null) {
    if (typeof p.activityProxyDomain !== "string" || !isPublicDomainName(p.activityProxyDomain)) return null;
    activityProxyDomain = p.activityProxyDomain.toLowerCase();
  }

  return { site, gateway: gateway.value, cdn: cdn.value, activityProxyDomain, iat: p.iat, exp: p.exp };
}

/** Ham yanıt gövdesi → doğrulanmış yapılandırma (boyut + JSON + imza). */
export function parseDiscoveryResponse(text: string, options: VerifyOptions): DiscoveredConfig | null {
  if (typeof text !== "string" || text.length > DISCOVERY_MAX_BYTES) return null;
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  return verifyDiscoveryDocument(doc, options);
}

/**
 * Depodan okunan kayıt hâlâ kurallara uyuyor mu (depo bozulmuş ya da elle
 * değiştirilmiş olabilir). Süre burada denetlenmez: doğrulanmış kök,
 * yenisi gelene kadar geçerli kalır (eski alan kapanmış olabilir).
 */
export function sanitizeStoredConfig(value: unknown): DiscoveredConfig | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const site = normalizeDiscoveredUrl(c.site, "https", true);
  if (!site || !isInt(c.iat) || !isInt(c.exp)) return null;
  const gateway = c.gateway == null ? null : normalizeDiscoveredUrl(c.gateway, "wss", false);
  const cdn = c.cdn == null ? null : normalizeDiscoveredUrl(c.cdn, "https", false);
  if ((c.gateway != null && !gateway) || (c.cdn != null && !cdn)) return null;
  const proxy =
    typeof c.activityProxyDomain === "string" && isPublicDomainName(c.activityProxyDomain)
      ? c.activityProxyDomain.toLowerCase()
      : null;
  return { site, gateway, cdn, activityProxyDomain: proxy, iat: c.iat, exp: c.exp };
}

/** `https://a.b` → `a.b` (köken doğrulanmış olmalı). */
export function hostOfOrigin(origin: string): string {
  return origin.replace(/^[a-z]+:\/\//i, "").replace(/[/:].*$/, "");
}

/**
 * Adresin ana bilgisayarı `from` ise `to` ile değiştirir (şema/yol korunur);
 * değilse adresi olduğu gibi bırakır. Derlemedeki LiveKit/ağ geçidi adresi
 * site ile aynı alandaysa yeni alana taşımak için.
 */
export function swapHost(url: string, from: string, to: string): string {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)(.*)$/i.exec(url);
  if (!match || match[2].toLowerCase() !== from.toLowerCase()) return url;
  return `${match[1]}${to}${match[3]}`;
}
