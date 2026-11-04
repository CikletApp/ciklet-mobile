/**
 * Canlı altyazı — veri mesajı biçimi, oran sınırı ve gösterim panosu.
 *
 * BU DOSYA web (`ciklet-web/src/lib/live-captions/protocol.ts`) ve mobil
 * (`ciklet-mobile/src/lib/live-captions/protocol.ts`) depolarında BİREBİR
 * AYNIDIR; web birim testi (tests/unit/live-captions.test.ts) yan yana duran
 * kopyayı karşılaştırır. Bağımlılık yok.
 *
 * Model (gizlilik): herkes YALNIZCA KENDİ konuşmasını, KENDİ cihazında yazıya
 * çevirir (web: Web Speech API, mobil: expo-speech-recognition) ve metni
 * LiveKit veri kanalıyla o odadakilere yayınlar. Kimse başkasının sesini bir
 * sunucuya göndermez; Ciklet API'si bu akışta hiç yok. Yayın varsayılan
 * KAPALI ("Konuşmamı altyazıla"); açıkken herkes konuşanın yanında
 * "Altyazı açık" görür. Uçtan uca şifreli odada mesajlar `crypto.ts` ile
 * gönderenin ses anahtarından türetilen anahtarla şifrelenir.
 */

export const CAPTIONS_PROTOCOL_VERSION = 1;
/** LiveKit veri kanalı konusu (soundboard, e2ee ve klip mesajlarından ayrı). */
export const CAPTIONS_TOPIC = "ciklet.captions.v1";
/** Düz mesajın üst sınırı (bayt). */
export const CAPTION_MAX_BYTES = 1024;
/** Altyazı metninin üst sınırı (karakter); uzun ara sonuçtan son kısım kalır. */
export const CAPTION_MAX_TEXT_CHARS = 300;
/** Ara (kesinleşmemiş) sonuçlar en sık bu aralıkla gönderilir. */
export const CAPTION_INTERIM_INTERVAL_MS = 300;
/** "Altyazı açık" duyurusu bu aralıkla yinelenir; alıcı 3 katında düşürür. */
export const CAPTION_HEARTBEAT_MS = 10_000;
export const CAPTION_PRESENCE_TTL_MS = CAPTION_HEARTBEAT_MS * 3;
/** Kesinleşen satır ekranda bu kadar kalır. */
export const CAPTION_FINAL_VISIBLE_MS = 6_000;
/** Güncellenmeyen ara satır bu süre sonra düşer. */
export const CAPTION_INTERIM_VISIBLE_MS = 4_000;
/** Konuşmacı başına ekranda tutulan satır. */
export const CAPTION_LINES_PER_SPEAKER = 2;
/** Gönderici oran sınırı: saniyede 5, anlık 10. */
export const CAPTION_SEND_RATE = { capacity: 10, perSecond: 5 } as const;
/** Alıcı oran sınırı (katılımcı başına; fazlası düşer): saniyede 8, anlık 16. */
export const CAPTION_RECEIVE_RATE = { capacity: 16, perSecond: 8 } as const;

/** Konuşma dili etiketi (BCP 47, ör. "tr-TR"). */
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;

export type CaptionTextMessage = {
  v: 1;
  t: "cap";
  /** Konuşma bölümü (kesinleşince yenisi başlar). */
  s: number;
  /** Bölüm içindeki sıra; eskisi yenisini ezmesin. */
  q: number;
  /** Metin. */
  x: string;
  /** 1: kesinleşti. */
  f: 0 | 1;
  /** Konuşma dili. */
  l: string;
};
export type CaptionPresenceMessage = { v: 1; t: "on"; on: boolean };
export type CaptionMessage = CaptionTextMessage | CaptionPresenceMessage;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isUint(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** Uzun metnin SON kısmını tutar (konuşmanın en yeni hâli önemli). */
export function clampCaptionText(text: string, maxChars = CAPTION_MAX_TEXT_CHARS): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const tail = clean.slice(clean.length - (maxChars - 1));
  const space = tail.indexOf(" ");
  return "…" + (space > 0 && space < 24 ? tail.slice(space + 1) : tail);
}

/**
 * Mesajı baytlara çevirir. Metin önce kırpılır; JSON yine de sınırı aşarsa
 * (çok baytlı karakterler) metin kısaltılarak sığdırılır.
 */
export function encodeCaption(message: CaptionMessage): Uint8Array {
  if (message.t === "on") return encoder.encode(JSON.stringify({ v: 1, t: "on", on: message.on }));
  let text = clampCaptionText(message.x);
  for (;;) {
    const bytes = encoder.encode(JSON.stringify({ v: 1, t: "cap", s: message.s, q: message.q, x: text, f: message.f, l: message.l }));
    if (bytes.length <= CAPTION_MAX_BYTES || text.length === 0) return bytes;
    text = clampCaptionText(text, Math.max(0, Math.floor(text.length * 0.8)));
  }
}

/** Gelen baytları doğrular; biçim dışı her şey `null`. */
export function parseCaption(bytes: Uint8Array): CaptionMessage | null {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > CAPTION_MAX_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const msg = value as Record<string, unknown>;
  if (msg.v !== CAPTIONS_PROTOCOL_VERSION) return null;
  if (msg.t === "on") {
    if (!hasExactKeys(msg, ["v", "t", "on"]) || typeof msg.on !== "boolean") return null;
    return { v: 1, t: "on", on: msg.on };
  }
  if (msg.t !== "cap" || !hasExactKeys(msg, ["v", "t", "s", "q", "x", "f", "l"])) return null;
  if (!isUint(msg.s, 2 ** 31) || !isUint(msg.q, 2 ** 31)) return null;
  if (typeof msg.x !== "string" || msg.x.length > CAPTION_MAX_TEXT_CHARS) return null;
  if (msg.f !== 0 && msg.f !== 1) return null;
  if (typeof msg.l !== "string" || !LANG_RE.test(msg.l)) return null;
  return { v: 1, t: "cap", s: msg.s, q: msg.q, x: clampCaptionText(msg.x), f: msg.f, l: msg.l };
}

// ── Oran sınırı ─────────────────────────────────────────────────────────

/** Jeton kovası: `capacity` anlık, `perSecond` sürekli. */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  tryTake(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// ── Gönderici ───────────────────────────────────────────────────────────

export type Cancel = () => void;

export interface CaptionSenderOptions {
  send: (bytes: Uint8Array) => void;
  lang: () => string;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => Cancel;
}

/**
 * Tanıyıcı sonuçlarını mesajlara çevirir: ara sonuçlar birleştirilip en
 * sık `CAPTION_INTERIM_INTERVAL_MS`'de bir, kesin sonuç hemen gönderilir.
 * Kova boşsa ara sonuç bekletilir, kesin sonuç bir sonraki fırsata kalır.
 */
export class CaptionSender {
  /**
   * Bölüm numarası zamandan başlar (desisaniye): yayın kapatılıp açılınca
   * alıcı yeni bölümleri "eski" sanıp atmasın. Kesin sonuç saniyede 5'i
   * geçemediği (oran sınırı) için sayaç saatin önüne geçmez.
   */
  private segment: number;
  private seq = 0;
  private lastSent = -Infinity;
  private pending: { text: string; final: boolean } | null = null;
  private timer: Cancel | null = null;
  private readonly limiter: RateLimiter;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => Cancel;

  constructor(private readonly options: CaptionSenderOptions) {
    this.now = options.now ?? Date.now;
    this.schedule =
      options.schedule ??
      ((fn, ms) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      });
    this.limiter = new RateLimiter(CAPTION_SEND_RATE.capacity, CAPTION_SEND_RATE.perSecond, this.now);
    this.segment = Math.floor(this.now() / 100) % 2 ** 31;
  }

  /** Tanıyıcıdan gelen metin (ara ya da kesin). */
  push(text: string, final: boolean): void {
    const clean = clampCaptionText(text);
    if (!clean && !final) return;
    this.pending = { text: clean, final };
    const wait = final ? 0 : Math.max(0, this.lastSent + CAPTION_INTERIM_INTERVAL_MS - this.now());
    if (wait === 0) this.flush();
    else if (!this.timer) this.timer = this.schedule(() => this.flush(), wait);
  }

  private flush(): void {
    this.timer?.();
    this.timer = null;
    const pending = this.pending;
    if (!pending) return;
    if (!this.limiter.tryTake()) {
      this.timer = this.schedule(() => this.flush(), 250);
      return;
    }
    this.pending = null;
    this.lastSent = this.now();
    if (pending.text) {
      this.options.send(
        encodeCaption({ v: 1, t: "cap", s: this.segment, q: this.seq++, x: pending.text, f: pending.final ? 1 : 0, l: this.options.lang() }),
      );
    }
    if (pending.final) {
      this.segment = (this.segment + 1) % 2 ** 31;
      this.seq = 0;
    }
  }

  /** Durdurulunca bekleyen ara sonuç atılır. */
  dispose(): void {
    this.timer?.();
    this.timer = null;
    this.pending = null;
  }
}

// ── Alıcı panosu ────────────────────────────────────────────────────────

export interface CaptionLine {
  identity: string;
  segment: number;
  text: string;
  final: boolean;
  lang: string;
  updatedAt: number;
  /** Bölüm içindeki son sıra. */
  seq: number;
}

interface SpeakerState {
  lines: CaptionLine[];
  /** Görülen en yeni bölüm; daha eskisi (geç gelen) yeni satır açmaz. */
  segment: number;
  limiter: RateLimiter;
  presenceUntil: number;
}

/**
 * Gelen altyazıları konuşmacı başına tutar: son `CAPTION_LINES_PER_SPEAKER`
 * satır, süresi dolan düşer. Kimin yayın yaptığını ("Altyazı açık") da
 * bilir. Katılımcı başına oran sınırı: taşkın yapan istemci diğerlerini
 * boğamaz.
 */
export class CaptionBoard {
  private readonly speakers = new Map<string, SpeakerState>();

  constructor(private readonly now: () => number = Date.now) {}

  private speaker(identity: string): SpeakerState {
    let state = this.speakers.get(identity);
    if (!state) {
      state = {
        lines: [],
        segment: -1,
        limiter: new RateLimiter(CAPTION_RECEIVE_RATE.capacity, CAPTION_RECEIVE_RATE.perSecond, this.now),
        presenceUntil: 0,
      };
      this.speakers.set(identity, state);
    }
    return state;
  }

  /** Mesajı işler; pano değiştiyse `true`. */
  ingest(identity: string, message: CaptionMessage): boolean {
    if (!identity) return false;
    const state = this.speaker(identity);
    if (!state.limiter.tryTake()) return false;
    const t = this.now();
    if (message.t === "on") {
      state.presenceUntil = message.on ? t + CAPTION_PRESENCE_TTL_MS : 0;
      if (!message.on) state.lines = [];
      return true;
    }
    state.presenceUntil = t + CAPTION_PRESENCE_TTL_MS;
    const current = state.lines.find((line) => line.segment === message.s);
    if (current) {
      // Aynı bölümün eski sırası (yoldan geç gelen) yenisini ezmez.
      if (current.final || message.q <= current.seq) return false;
      current.text = message.x;
      current.final = message.f === 1;
      current.lang = message.l;
      current.updatedAt = t;
      current.seq = message.q;
    } else {
      if (message.s < state.segment) return false;
      state.segment = message.s;
      state.lines.push({ identity, segment: message.s, text: message.x, final: message.f === 1, lang: message.l, updatedAt: t, seq: message.q });
      while (state.lines.length > CAPTION_LINES_PER_SPEAKER) state.lines.shift();
    }
    return true;
  }

  /** Katılımcı ayrıldı. */
  remove(identity: string): void {
    this.speakers.delete(identity);
  }

  clear(): void {
    this.speakers.clear();
  }

  /** Süresi dolan satırları ve duyuruları düşürür; değiştiyse `true`. */
  prune(): boolean {
    const t = this.now();
    let changed = false;
    for (const [identity, state] of this.speakers) {
      const before = state.lines.length;
      state.lines = state.lines.filter(
        (line) => t - line.updatedAt < (line.final ? CAPTION_FINAL_VISIBLE_MS : CAPTION_INTERIM_VISIBLE_MS),
      );
      if (state.lines.length !== before) changed = true;
      if (state.presenceUntil && state.presenceUntil <= t) {
        state.presenceUntil = 0;
        changed = true;
      }
      if (!state.lines.length && !state.presenceUntil) this.speakers.delete(identity);
    }
    return changed;
  }

  /** Ekrandaki satırlar, en eski güncellenen önce. */
  lines(): CaptionLine[] {
    const out: CaptionLine[] = [];
    for (const state of this.speakers.values()) out.push(...state.lines.filter((line) => line.text));
    return out.sort((a, b) => a.updatedAt - b.updatedAt).map((line) => ({ ...line }));
  }

  /** Altyazı yayını açık olan katılımcılar. */
  captioning(): string[] {
    const t = this.now();
    const out: string[] = [];
    for (const [identity, state] of this.speakers) if (state.presenceUntil > t) out.push(identity);
    return out.sort();
  }
}

/**
 * Konuşma tanıma dili: ayar ("auto" → arayüz dili) tam bölge etiketine
 * çevrilir; tanıyıcılar "tr" yerine "tr-TR" ister.
 */
export const SPEECH_LANGUAGES = [
  "tr-TR", "en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "pt-BR", "nl-NL",
  "pl-PL", "ru-RU", "uk-UA", "ar-SA", "ja-JP", "ko-KR", "zh-CN", "az-AZ",
] as const;

export function resolveSpeechLanguage(preference: string | null | undefined, uiLocale: string): string {
  if (preference && preference !== "auto" && (SPEECH_LANGUAGES as readonly string[]).includes(preference)) return preference;
  const base = uiLocale.toLowerCase().split("-")[0];
  return SPEECH_LANGUAGES.find((tag) => tag.toLowerCase().startsWith(base + "-")) ?? "tr-TR";
}
