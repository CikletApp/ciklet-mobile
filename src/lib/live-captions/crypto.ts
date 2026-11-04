/**
 * Canlı altyazı — uçtan uca şifreli odalarda veri mesajı şifrelemesi.
 *
 * BU DOSYA web ve mobil depolarında BİREBİR AYNIDIR (bkz. protocol.ts).
 *
 * LiveKit'in kendi veri kanalı şifrelemesi Ciklet'in katılımcı başına anahtar
 * modelinde (lib/voice-e2ee, `sharedKey: false`) ve mobil SDK'da yok; ayrıca
 * açılırsa anahtar dağıtım mesajları da şifrelenir ve kimse anahtar alamaz.
 * Bu yüzden altyazı mesajı uygulama katmanında şifrelenir:
 *  - Anahtar: gönderenin O ANKİ ses gönderen anahtarı (voice-e2ee
 *    passphrase'i) → HKDF-SHA256 (tuz "ciklet-captions-v1", bilgi
 *    oda + kimlik + sıra) → AES-256-GCM.
 *  - Ek doğrulanan veri: oda + gönderen kimliği; sunucu mesajı başka bir
 *    katılımcıya ya da odaya taşıyamaz.
 *  - Alıcı gönderenin anahtarını zaten ses için tutuyor (anahtar halkası);
 *    anahtarı olmayan (yeni gelen, ayrılan, eski sürüm) metni çözemez.
 *  - Gönderen anahtarı hiç yoksa (desteksiz cihaz) şifreli odada yayın
 *    yapılmaz; arayüz bunu söyler.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { E2EE_KEYRING_SIZE, fromBase64, toBase64 } from "../voice-e2ee/protocol";
import { CAPTION_MAX_BYTES } from "./protocol";

const SALT = "ciklet-captions-v1";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
/** Şifreli zarfın üst sınırı (base64 şişmesi + alanlar). */
export const CAPTION_SEALED_MAX_BYTES = 2048;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SealedCaption = { v: 1; t: "enc"; i: number; n: string; c: string };

function isKeyIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < E2EE_KEYRING_SIZE;
}

function deriveKey(passphrase: string, room: string, identity: string, index: number): Uint8Array {
  return hkdf(sha256, encoder.encode(passphrase), encoder.encode(SALT), encoder.encode(`${room}\n${identity}\n${index}`), 32);
}

function aad(room: string, identity: string): Uint8Array {
  return encoder.encode(`${SALT}\n${room}\n${identity}`);
}

/**
 * Katılımcı başına ses anahtarlarının kopyası (voice-e2ee anahtar sağlayıcısına
 * giden passphrase'ler). Sıra 0–15 arasında döndüğü için katılımcı başına en
 * çok 16 kayıt tutulur.
 */
export class CaptionKeyring {
  private local: { passphrase: string; index: number } | null = null;
  private readonly remote = new Map<string, Map<number, string>>();

  setLocal(passphrase: string, index: number): void {
    if (isKeyIndex(index)) this.local = { passphrase, index };
  }

  setRemote(identity: string, passphrase: string, index: number): void {
    if (!isKeyIndex(index)) return;
    let ring = this.remote.get(identity);
    if (!ring) {
      ring = new Map();
      this.remote.set(identity, ring);
    }
    ring.set(index, passphrase);
  }

  localKey(): { passphrase: string; index: number } | null {
    return this.local;
  }

  remoteKey(identity: string, index: number): string | null {
    return this.remote.get(identity)?.get(index) ?? null;
  }

  forget(identity: string): void {
    this.remote.delete(identity);
  }

  clear(): void {
    this.local = null;
    this.remote.clear();
  }
}

/** Düz mesaj → şifreli zarf (JSON baytları). */
export function sealCaption(params: {
  plaintext: Uint8Array;
  passphrase: string;
  index: number;
  room: string;
  identity: string;
  random: (length: number) => Uint8Array;
}): Uint8Array {
  const { plaintext, passphrase, index, room, identity, random } = params;
  if (plaintext.length > CAPTION_MAX_BYTES || !isKeyIndex(index)) throw new Error("caption too large");
  const nonce = random(NONCE_BYTES);
  const sealed = gcm(deriveKey(passphrase, room, identity, index), nonce, aad(room, identity)).encrypt(plaintext);
  const envelope: SealedCaption = { v: 1, t: "enc", i: index, n: toBase64(nonce), c: toBase64(sealed) };
  return encoder.encode(JSON.stringify(envelope));
}

/** Zarf mı (şifreli altyazı)? Düz mesajla karıştırmamak için hafif kontrol. */
export function parseSealed(bytes: Uint8Array): SealedCaption | null {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > CAPTION_SEALED_MAX_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const msg = value as Record<string, unknown>;
  const keys = Object.keys(msg);
  if (keys.length !== 5 || msg.v !== 1 || msg.t !== "enc" || !isKeyIndex(msg.i)) return null;
  if (typeof msg.n !== "string" || !fromBase64(msg.n, NONCE_BYTES)) return null;
  if (typeof msg.c !== "string") return null;
  const cipher = fromBase64(msg.c);
  if (!cipher || cipher.length < TAG_BYTES + 1 || cipher.length > CAPTION_MAX_BYTES + TAG_BYTES) return null;
  return { v: 1, t: "enc", i: msg.i, n: msg.n, c: msg.c };
}

/** Şifreli zarfı çözer; anahtar yoksa ya da doğrulama tutmazsa `null`. */
export function openCaption(params: {
  envelope: SealedCaption;
  keyring: CaptionKeyring;
  room: string;
  identity: string;
}): Uint8Array | null {
  const { envelope, keyring, room, identity } = params;
  const passphrase = keyring.remoteKey(identity, envelope.i);
  if (!passphrase) return null;
  const nonce = fromBase64(envelope.n, NONCE_BYTES);
  const cipher = fromBase64(envelope.c);
  if (!nonce || !cipher) return null;
  try {
    return gcm(deriveKey(passphrase, room, identity, envelope.i), nonce, aad(room, identity)).decrypt(cipher);
  } catch {
    return null;
  }
}
