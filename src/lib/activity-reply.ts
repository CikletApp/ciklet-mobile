/**
 * Etkinliğe yanıt / tepki (ACTIVITY_REPLY) — saf yardımcılar.
 *
 * ciklet-web `src/lib/activity-reply.ts`'in mobil eşi: KURAL AYNI, iki
 * tarafta birlikte değişmeli. Birinin etkinliğine (Şimdi Aktif kartı,
 * profildeki "ŞU AN" kartı, web'de sunucu ETKİNLİK kartı) tepki/yanıt
 * verilince o kişiye bir DM gider: içerik emoji ya da yazılan metin,
 * `metadata.activity` etkinliğin özeti. Sohbette bu özet normal balonun
 * altında bir kart olarak çizilir (chat/components/message-activity-reply).
 *
 * Özet depodan / telden geldiği için her okumada `normalizeActivityRef`'ten
 * geçer — bozuk veri kartı çökertmez, düz balon kalır.
 *
 * Görsel yalnızca https: alıcının cihazı gönderenin seçtiği http/data
 * adresine gitmemeli.
 *
 * Bu modül React Native'e bağımlı DEĞİL (scripts/verify-activity-reply.mjs
 * Node'da doğrular); API kökü çağırandan gelir.
 */

/** Tek dokunuşla gönderilen tepkiler. */
export const ACTIVITY_REPLY_QUICK_EMOJIS = ["👍", "🔥", "😂", "❤️"] as const;

export const ACTIVITY_REPLY_TEXT_MAX = 256;
export const ACTIVITY_REPLY_URL_MAX = 2_048;
/** Yanıt metni (mesaj içeriği) için sınır. */
export const ACTIVITY_REPLY_CONTENT_MAX = 500;

export interface ActivityRef {
  /** RichPresence türü (PLAYING, LISTENING…); eski satırlarda sayı olabilir. */
  type: string | number;
  name: string;
  details?: string;
  state?: string;
  largeImageUrl?: string;
  /** Yanıt anında etkinlik sürüyor muydu — fiilin zamanı buna göre. */
  isLive?: boolean;
  /** Ciklet aktivite uygulaması — fiil "Katıldı". */
  isActivityApp?: boolean;
}

function shortText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, ACTIVITY_REPLY_TEXT_MAX);
  return text || undefined;
}

/** Yalnızca geçerli, mutlak bir https adresi; aksi hâlde undefined. */
export function safeActivityImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > ACTIVITY_REPLY_URL_MAX) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Etkinlik görselini mesaja konacak adrese çevirir: kapak deposu gibi kendi
 * kökenimizdeki yollar (`/api/presence/covers/…`) API köküyle mutlak yapılır
 * ki alıcı (web dahil) çözebilsin; sonuç https değilse düşer.
 */
export function activityImageForMessage(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) {
    try {
      return safeActivityImageUrl(new URL(url, origin).toString());
    } catch {
      return undefined;
    }
  }
  return safeActivityImageUrl(url);
}

/**
 * Ham değeri etkinlik özetine indirger: bilinmeyen alan düşer, metinler
 * kırpılır, görsel https değilse atılır. Adı olmayan özet anlamsız → null.
 */
export function normalizeActivityRef(raw: unknown): ActivityRef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = shortText(r.name);
  if (!name) return null;
  let type: string | number = "PLAYING";
  if (typeof r.type === "string" && r.type.trim()) type = r.type.trim().slice(0, 32);
  else if (typeof r.type === "number" && Number.isFinite(r.type)) type = r.type;
  const out: ActivityRef = { type, name };
  const details = shortText(r.details);
  const state = shortText(r.state);
  const image = safeActivityImageUrl(r.largeImageUrl);
  if (details) out.details = details;
  if (state) out.state = state;
  if (image) out.largeImageUrl = image;
  if (r.isLive === true) out.isLive = true;
  if (r.isActivityApp === true) out.isActivityApp = true;
  return out;
}

/** Sohbet mesajından etkinlik özeti — yalnızca ACTIVITY_REPLY türünde. */
export function readActivityReply(message: { type?: string | null; metadata?: unknown }): ActivityRef | null {
  if (message.type !== "ACTIVITY_REPLY") return null;
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return normalizeActivityRef((metadata as Record<string, unknown>).activity);
}

// Sayısal türler Discord RPC sırası (0 oynuyor, 1 yayın, 2 dinliyor…).
const NUMERIC_TYPES = ["PLAYING", "STREAMING", "LISTENING", "WATCHING", "CUSTOM", "COMPETING"] as const;

export type ActivityVerbKey =
  | "PLAYING"
  | "LISTENING"
  | "WATCHING"
  | "STREAMING"
  | "COMPETING"
  | "USING"
  | "JOINED"
  | "OTHER";

export function activityRefType(ref: Pick<ActivityRef, "type">): string {
  return typeof ref.type === "number" ? NUMERIC_TYPES[ref.type] ?? "PLAYING" : ref.type;
}

export function activityVerbKey(ref: Pick<ActivityRef, "type" | "isActivityApp">): ActivityVerbKey {
  if (ref.isActivityApp) return "JOINED";
  const type = activityRefType(ref);
  switch (type) {
    case "PLAYING":
    case "LISTENING":
    case "WATCHING":
    case "STREAMING":
    case "COMPETING":
      return type;
    case "WORKING":
    case "CREATING":
      return "USING";
    default:
      return "OTHER";
  }
}

/** Web sözlüğü `activityReply.verbLive` / `verbPast` (Türkçe kaynak). */
const VERB_LIVE: Record<ActivityVerbKey, string> = {
  PLAYING: "Oynuyor",
  LISTENING: "Dinliyor",
  WATCHING: "İzliyor",
  STREAMING: "Yayında",
  COMPETING: "Yarışıyor",
  USING: "Kullanıyor",
  JOINED: "Katıldı",
  OTHER: "Aktif",
};

const VERB_PAST: Record<ActivityVerbKey, string> = {
  PLAYING: "Oynadı",
  LISTENING: "Dinledi",
  WATCHING: "İzledi",
  STREAMING: "Yayın yaptı",
  COMPETING: "Yarıştı",
  USING: "Kullandı",
  JOINED: "Katıldı",
  OTHER: "Aktifti",
};

/** Kartın fiili: sürüyorsa geniş zaman ("Oynuyor"), bittiyse geçmiş ("Oynadı"). */
export function activityVerbLabel(ref: Pick<ActivityRef, "type" | "isActivityApp" | "isLive">): string {
  const key = activityVerbKey(ref);
  return ref.isLive ? VERB_LIVE[key] : VERB_PAST[key];
}

/** Kart başlığı: müzik/videoda parça/video adı, diğerlerinde uygulama adı. */
export function activityRefHeadline(ref: ActivityRef): { title: string; subtitle: string | null } {
  const type = activityRefType(ref);
  const isMedia = type === "LISTENING" || type === "WATCHING";
  if (isMedia) {
    return { title: ref.details || ref.name, subtitle: ref.state || (ref.details ? ref.name : null) };
  }
  return { title: ref.name, subtitle: ref.details || ref.state || null };
}

/** Mesaj hızlı tepkilerden biri mi (kartta "tepki verdi" etiketi). */
export function isActivityReaction(content: string | null | undefined): boolean {
  const text = content?.trim() ?? "";
  return (ACTIVITY_REPLY_QUICK_EMOJIS as readonly string[]).includes(text);
}

/** Kartın üstündeki etiket. */
export function activityReplyLabel(content: string | null | undefined): string {
  return isActivityReaction(content) ? "Etkinliğe tepki verdi" : "Etkinliğe yanıt verdi";
}

/**
 * Sohbet listesi / bildirim önizlemesi: tepkide emoji tek başına anlamsız
 * ("👍"), neye verildiği eklenir; yanıtta yazılan metin yeterli.
 */
export function activityReplyPreview(content: string | null | undefined): string {
  const text = content?.trim() ?? "";
  if (!text) return "Etkinliğe yanıt verdi";
  return isActivityReaction(text) ? `${text} Etkinliğe tepki verdi` : text;
}

/** Gönderilecek gövde (POST /api/socket/direct-messages). */
export function buildActivityReplyPayload(
  item: {
    type: string;
    name: string;
    details: string | null;
    state: string | null;
    isLive: boolean;
    isActivityApp?: boolean;
  },
  content: string,
  artwork: string | null,
  origin: string,
): { content: string; messageType: "ACTIVITY_REPLY"; metadata: { activity: ActivityRef } } | null {
  const text = content.trim().slice(0, ACTIVITY_REPLY_CONTENT_MAX);
  const activity = normalizeActivityRef({
    type: item.type,
    name: item.name,
    details: item.details,
    state: item.state,
    largeImageUrl: activityImageForMessage(artwork, origin),
    isLive: item.isLive,
    isActivityApp: item.isActivityApp === true,
  });
  if (!text || !activity) return null;
  return { content: text, messageType: "ACTIVITY_REPLY", metadata: { activity } };
}
