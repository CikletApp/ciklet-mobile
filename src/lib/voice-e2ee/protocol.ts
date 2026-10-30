/**
 * Ciklet sesli/görüntülü arama uçtan uca şifreleme protokolü (CSE v1) —
 * kriptografik çekirdek.
 *
 * BU DOSYA web (`ciklet-web/src/lib/voice-e2ee/protocol.ts`) ve mobil
 * (`ciklet-mobile/src/lib/voice-e2ee/protocol.ts`) depolarında BİREBİR
 * AYNIDIR. Biri değişirse diğeri de aynı şekilde değişmeli; web birim testi
 * (tests/unit/voice-e2ee-protocol.test.ts) yan yana duran kopyayı karşılaştırır.
 * Yalnızca saf JS bağımlılıkları (@noble/*) kullanır: Hermes'te WebCrypto yok,
 * tarayıcılarda da X25519 her yerde yok — iki tarafın aynı kodu çalıştırması
 * birlikte çalışmanın tek güvencesi.
 *
 * Model (Discord DAVE'nin gönderen anahtarı yaklaşımının MLS'siz hâli):
 *  - Her katılımcı aramaya her bağlanışında yeni bir X25519 anahtar çifti üretir
 *    (kalıcı kimlik anahtarı yok — DAVE'nin "geçici anahtar" kipi gibi).
 *  - Her katılımcının kendi 32 baytlık rastgele GÖNDEREN anahtarı vardır; kendi
 *    ses/görüntü karelerini onunla şifreler (LiveKit çerçeve şifrelemesi,
 *    AES-GCM). Gönderen anahtarı diğer katılımcılara tek tek, alıcının açık
 *    anahtarıyla kurulan ECDH + HKDF-SHA256 anahtarıyla AES-256-GCM'de
 *    sarılarak iletilir. Sunucu (Ciklet ya da LiveKit) yalnızca açık anahtarları
 *    ve sarılmış anahtarları taşır — düz anahtar hiçbir zaman sunucudan geçmez.
 *  - Katılımcı girip çıktıkça herkes gönderen anahtarını yeniler (DAVE "epoch"u):
 *    sonradan gelen eski konuşmayı, ayrılan da sonrakini çözemez.
 *  - "Ses gizlilik kodu": katılımcı kimliği ↔ açık anahtar eşleşmelerinin
 *    özeti. Herkeste aynıysa arada anahtar değiştiren biri (sunucu dahil) yok.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const E2EE_PROTOCOL_VERSION = 1;
/** LiveKit veri kanalı konusu; diğer veri mesajlarından (soundboard, klip) ayrı. */
export const E2EE_TOPIC = "ciklet.e2ee.v1";
/**
 * Anahtar halkası boyu (LiveKit `keyringSize`): kare sonundaki anahtar sırası
 * 0–15 arasında döner; alıcı son 16 anahtarı tutar, yenileme anında yoldaki
 * eski kareler de çözülür.
 */
export const E2EE_KEYRING_SIZE = 16;
/**
 * LiveKit'in parola → çerçeve anahtarı türetmesindeki (PBKDF2-SHA256) tuz.
 * Web işçisi ve yerel (iOS/Android) çerçeve şifreleyicisi aynı tuzla aynı
 * anahtarı türetir — iki tarafta da aynı değer verilmeli.
 */
export const E2EE_RATCHET_SALT = "ciklet-ses-e2ee-v1";
/** Tek bir protokol mesajının en büyük boyu; üstü okunmadan atılır. */
export const E2EE_MAX_MESSAGE_BYTES = 1024;
/** LiveKit kimliği (kullanıcı adı) için üst sınır. */
export const E2EE_MAX_IDENTITY_LENGTH = 128;

const LABEL = "ciklet-ses-e2ee-v1";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const PUBLIC_KEY_BYTES = 32;

/**
 * `r`: yanıt mı? Duyuru (`r: false`) alan katılımcı kendi açık anahtarıyla
 * yanıt verir; yanıta (`r: true`) yanıt verilmez — döngü olmasın.
 */
export type HelloMessage = { v: 1; t: "hello"; pk: string; r: boolean };
export type KeyMessage = { v: 1; t: "key"; to: string; i: number; n: string; c: string };
export type AckMessage = { v: 1; t: "ack"; to: string; i: number };
export type E2EEMessage = HelloMessage | KeyMessage | AckMessage;

export interface E2EEKeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

// ── Kodlama yardımcıları ────────────────────────────────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Standart base64 (dolgu dahil). Hermes'te `btoa`/`Buffer`a güvenmemek için elle. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

/** Katı base64 çözücü: biçim dışı ya da beklenen boyda olmayan girdi `null`. */
export function fromBase64(text: string, expectedLength?: number): Uint8Array | null {
  if (typeof text !== "string" || text.length % 4 !== 0 || !B64_RE.test(text)) return null;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const length = (text.length / 4) * 3 - padding;
  if (expectedLength !== undefined && length !== expectedLength) return null;
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n =
      (B64.indexOf(text[i]) << 18) |
      (B64.indexOf(text[i + 1]) << 12) |
      ((text[i + 2] === "=" ? 0 : B64.indexOf(text[i + 2])) << 6) |
      (text[i + 3] === "=" ? 0 : B64.indexOf(text[i + 3]));
    if (o < length) out[o++] = (n >> 16) & 255;
    if (o < length) out[o++] = (n >> 8) & 255;
    if (o < length) out[o++] = n & 255;
  }
  // Kanonik olmayan (dolgu bitleri sıfır olmayan) kodlamayı reddet: aynı
  // baytların iki farklı yazımı olmasın.
  return toBase64(out) === text ? out : null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Uzunluk önekli alan (4 bayt büyük uçlu): alan sınırları karışmasın. */
function field(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + bytes.length);
  new DataView(out.buffer).setUint32(0, bytes.length);
  out.set(bytes, 4);
  return out;
}

function textField(text: string): Uint8Array {
  return field(utf8(text));
}

export function isValidIdentity(identity: unknown): identity is string {
  return typeof identity === "string" && identity.length > 0 && identity.length <= E2EE_MAX_IDENTITY_LENGTH;
}

function isKeyIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < E2EE_KEYRING_SIZE;
}

// ── Mesajlar ────────────────────────────────────────────────────────────

export function encodeMessage(message: E2EEMessage): Uint8Array {
  return utf8(JSON.stringify(message));
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/**
 * Veri kanalından gelen baytları doğrular. Biçimi, sürümü, alan kümesi,
 * boyları tam tutmayan her şey `null` — bilinmeyen alanlı mesaj da
 * (ileride sürüm değişirse eski istemci yeni mesajı yanlış yorumlamasın).
 */
export function parseMessage(bytes: Uint8Array): E2EEMessage | null {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > E2EE_MAX_MESSAGE_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const msg = value as Record<string, unknown>;
  if (msg.v !== E2EE_PROTOCOL_VERSION) return null;
  switch (msg.t) {
    case "hello":
      if (!hasExactKeys(msg, ["v", "t", "pk", "r"])) return null;
      if (typeof msg.pk !== "string" || !fromBase64(msg.pk, PUBLIC_KEY_BYTES)) return null;
      if (typeof msg.r !== "boolean") return null;
      return { v: 1, t: "hello", pk: msg.pk, r: msg.r };
    case "key":
      if (!hasExactKeys(msg, ["v", "t", "to", "i", "n", "c"])) return null;
      if (!isValidIdentity(msg.to) || !isKeyIndex(msg.i)) return null;
      if (typeof msg.n !== "string" || !fromBase64(msg.n, NONCE_BYTES)) return null;
      if (typeof msg.c !== "string" || !fromBase64(msg.c, KEY_BYTES + TAG_BYTES)) return null;
      return { v: 1, t: "key", to: msg.to, i: msg.i, n: msg.n, c: msg.c };
    case "ack":
      if (!hasExactKeys(msg, ["v", "t", "to", "i"])) return null;
      if (!isValidIdentity(msg.to) || !isKeyIndex(msg.i)) return null;
      return { v: 1, t: "ack", to: msg.to, i: msg.i };
    default:
      return null;
  }
}

// ── Anahtarlar ──────────────────────────────────────────────────────────

/** 32 baytlık rastgele tohumdan X25519 çifti (rastgelelik platformdan gelir). */
export function keyPairFromSeed(seed: Uint8Array): E2EEKeyPair {
  if (seed.length !== 32) throw new Error("X25519 tohumu 32 bayt olmalı");
  const secretKey = seed.slice();
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

interface WrapContext {
  room: string;
  sender: string;
  recipient: string;
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
}

/**
 * Gönderen → alıcı yönüne özgü sarma anahtarı:
 * HKDF-SHA256(X25519 ortak sırrı, tuz = SHA256(etiket ‖ oda),
 *             bilgi = "key-wrap" ‖ gönderen ‖ alıcı ‖ pk_gönderen ‖ pk_alıcı).
 * Yön ve oda bilgiye girdiği için A→B anahtarı B→A'da ya da başka odada işe
 * yaramaz. Düşük mertebeli (sıfır) ortak sır reddedilir.
 */
function wrapKey(ownSecretKey: Uint8Array, peerPublicKey: Uint8Array, ctx: WrapContext): Uint8Array {
  const shared = x25519.getSharedSecret(ownSecretKey, peerPublicKey);
  if (shared.every((byte) => byte === 0)) throw new Error("geçersiz açık anahtar");
  const salt = sha256(concat(utf8(`${LABEL}/salt`), textField(ctx.room)));
  const info = concat(
    utf8("key-wrap"),
    textField(ctx.sender),
    textField(ctx.recipient),
    field(ctx.senderPublicKey),
    field(ctx.recipientPublicKey),
  );
  return hkdf(sha256, shared, salt, info, 32);
}

function wrapAad(room: string, sender: string, recipient: string, index: number): Uint8Array {
  return concat(utf8(`${LABEL}/key`), textField(room), textField(sender), textField(recipient), new Uint8Array([index]));
}

/** Gönderen anahtarını tek bir alıcı için sarar. `nonce` 12 rastgele bayt. */
export function wrapSenderKey(params: {
  room: string;
  sender: string;
  recipient: string;
  senderKeyPair: E2EEKeyPair;
  recipientPublicKey: Uint8Array;
  index: number;
  senderKey: Uint8Array;
  nonce: Uint8Array;
}): KeyMessage {
  if (params.senderKey.length !== KEY_BYTES) throw new Error("gönderen anahtarı 32 bayt olmalı");
  if (params.nonce.length !== NONCE_BYTES) throw new Error("nonce 12 bayt olmalı");
  if (!isKeyIndex(params.index)) throw new Error("geçersiz anahtar sırası");
  const key = wrapKey(params.senderKeyPair.secretKey, params.recipientPublicKey, {
    room: params.room,
    sender: params.sender,
    recipient: params.recipient,
    senderPublicKey: params.senderKeyPair.publicKey,
    recipientPublicKey: params.recipientPublicKey,
  });
  const sealed = gcm(key, params.nonce, wrapAad(params.room, params.sender, params.recipient, params.index)).encrypt(
    params.senderKey,
  );
  return { v: 1, t: "key", to: params.recipient, i: params.index, n: toBase64(params.nonce), c: toBase64(sealed) };
}

/** Bize gelen sarılmış anahtarı açar; doğrulanamazsa `null` (sessizce atılır). */
export function unwrapSenderKey(params: {
  room: string;
  sender: string;
  recipient: string;
  recipientKeyPair: E2EEKeyPair;
  senderPublicKey: Uint8Array;
  message: KeyMessage;
}): Uint8Array | null {
  if (params.message.to !== params.recipient) return null;
  const nonce = fromBase64(params.message.n, NONCE_BYTES);
  const sealed = fromBase64(params.message.c, KEY_BYTES + TAG_BYTES);
  if (!nonce || !sealed) return null;
  try {
    const key = wrapKey(params.recipientKeyPair.secretKey, params.senderPublicKey, {
      room: params.room,
      sender: params.sender,
      recipient: params.recipient,
      senderPublicKey: params.senderPublicKey,
      recipientPublicKey: params.recipientKeyPair.publicKey,
    });
    const plain = gcm(key, nonce, wrapAad(params.room, params.sender, params.recipient, params.message.i)).decrypt(sealed);
    return plain.length === KEY_BYTES ? plain : null;
  } catch {
    return null;
  }
}

/**
 * LiveKit anahtar sağlayıcısına verilecek "parola". Web işçisi ve yerel
 * çerçeve şifreleyicisi dizgeyi UTF-8 olarak PBKDF2'ye sokar; 32 rastgele
 * baytın base64'ü 256 bit entropi taşır. (Ham bayt verilseydi web HKDF,
 * yerel PBKDF2 kullanırdı ve iki taraf farklı anahtar türetirdi.)
 */
export function senderKeyPassphrase(senderKey: Uint8Array): string {
  if (senderKey.length !== KEY_BYTES) throw new Error("gönderen anahtarı 32 bayt olmalı");
  return toBase64(senderKey);
}

// ── Ses gizlilik kodu ───────────────────────────────────────────────────

export interface PrivacyCodeEntry {
  identity: string;
  publicKey: Uint8Array;
}

/**
 * Ses gizlilik kodu: 30 rakam, 5'erli 6 grup (DAVE'nin "epoch authenticator"
 * gösterimiyle aynı biçim). Odadaki şifreli katılımcıların (kimlik, açık
 * anahtar) çiftlerinin sıralı özeti — sıralama kimliğe göre olduğu için herkes
 * aynı kümeden aynı kodu hesaplar. Biri katılınca/ayrılınca kod değişir.
 */
export function privacyCode(room: string, entries: PrivacyCodeEntry[]): string[] {
  const unique = new Map<string, Uint8Array>();
  for (const entry of entries) unique.set(entry.identity, entry.publicKey);
  const sorted = [...unique.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const digest = sha256(
    concat(
      utf8(`${LABEL}/code`),
      textField(room),
      ...sorted.flatMap(([identity, publicKey]) => [textField(identity), field(publicKey)]),
    ),
  );
  const groups: string[] = [];
  for (let g = 0; g < 6; g++) {
    let value = 0;
    for (let b = 0; b < 5; b++) value = value * 256 + digest[g * 5 + b];
    groups.push(String(value % 100000).padStart(5, "0"));
  }
  return groups;
}
