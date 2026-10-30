/**
 * Mesaj önizleme metni — ciklet-web `src/lib/message-preview.ts`'in mobil eşi.
 * KURAL AYNI, iki tarafta birlikte değişmeli.
 *
 * Ek gönderilirken mesajın `content` alanı çoğu zaman dosyanın KENDİ adresi
 * (UploadThing `*.ufs.sh`, GIF seçicinin Klipy adresi). Yanıt alıntısı,
 * yanıt çubuğu, sohbet listesi, uygulama içi bildirim kartı ve yerel
 * bildirimler bunu olduğu gibi basıyordu; kullanıcı bağlantıyı görüyordu.
 *
 *  - Tür metadata'dan (sesli mesaj, çıkartma, klip, ek bilgisi) ya da
 *    adresten (GIF sağlayıcısı, uzantı) çıkarılır → "medya".
 *  - Metinden ek adresleri ve yükleme/GIF bağlantıları AYIKLANIR.
 *  - Metin varsa o, yoksa medya etiketi ("📷 Fotoğraf").
 *
 * Sunucu yanıt anlık görüntüsüne ve bildirim olaylarına dilden bağımsız
 * `{ text, media }` koyuyor; eski kayıtlarda yalnızca ham adres olabilir,
 * o da burada ayıklanır (veri göçü yok).
 */
import { classifyAttachment, fileNameFromUrl, isUploadHostUrl, type AttachmentInfo } from "@/lib/attachments";
import { currentTranslator, type Translator } from "@/lib/i18n";

export const PREVIEW_MEDIA_KINDS = [
  "voice",
  "image",
  "video",
  "gif",
  "sticker",
  "clip",
  "file",
  "attachment",
  "activity",
] as const;

/**
 * Önizlemedeki ek türü. "file" adı bilinen sıradan dosya ("📎 rapor.pdf"),
 * "attachment" türü de adı da bilinmeyen ek ("📎 Ek" — eski kayıtlar).
 */
export type PreviewMediaKind = (typeof PREVIEW_MEDIA_KINDS)[number];

export interface PreviewMedia {
  kind: PreviewMediaKind;
  /** Dosya adı ("file") — yalnızca gerçek bir ad varsa; anahtar-adres asla. */
  name?: string;
  /** Sesli mesaj / klip süresi. */
  durationMs?: number;
  /** Çoklu ekte toplam dosya sayısı (2+). */
  count?: number;
}

/** Önizlemenin dilden bağımsız hâli — tel biçimi de budur. */
export interface MessagePreview {
  /** Kullanıcının yazdığı metin; ek adresleri ayıklanmış. Boş olabilir. */
  text: string;
  media: PreviewMedia | null;
}

/**
 * Önizlemesi üretilebilen her şey: tam mesaj (`ChatMessageData`,
 * `StoredMessage`, zarf), yanıt referansı ya da tel biçimi.
 */
export interface PreviewSource {
  content?: string | null;
  /** Bazı yüzeylerde metin `message` alanında (bildirim çerçevesi). */
  message?: string | null;
  type?: string | null;
  messageType?: string | null;
  fileUrl?: string | null;
  metadata?: unknown;
  /** Önceden hesaplanmış medya (sunucudan gelen tel biçimi). */
  media?: unknown;
}

const NAME_MAX = 120;
const UPLOAD_HOST_RE = /(^|\.)(ufs\.sh|utfs\.io|uploadthing\.com)$/i;
/** GIF sağlayıcıları: seçici (Klipy) ve eski/yapıştırılmış Tenor/Giphy adresleri. */
const GIF_HOST_RE = /(^|\.)(klipy\.com|tenor\.com|tenor\.co|giphy\.com)$/i;
const GIF_EXT_RE = /\.gif(?:[?#]|$)/i;
const URL_TOKEN_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`]+/gi;
/** Durumsuz sınama için (`g` bayraklı ifade `lastIndex` taşır). */
const HAS_URL_RE = /[a-z][a-z0-9+.-]*:\/\//i;
/** Markdown bağlantısı / açılı ayraç içindeki adres sonrası artıklar. */
const EMPTY_WRAPPERS_RE = /<\s*>|\[\s*\]\(\s*\)|\(\s*\)/g;

/**
 * Adresin ana bilgisayar adı. `URL` sınıfı yerine elle: geçersiz adreste
 * istisna atmaz ve aynı ifade mobilde de çalışır.
 */
function hostOf(url: string): string | null {
  return /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i.exec(url.trim())?.[1]?.toLowerCase() ?? null;
}

/** GIF sağlayıcısının (Klipy/Tenor/Giphy) adresi ya da `.gif` uzantılı adres mi? */
export function isGifUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const host = hostOf(url);
  if (host && GIF_HOST_RE.test(host)) return true;
  return GIF_EXT_RE.test(url);
}

/**
 * Önizlemede ASLA görünmemesi gereken adres mi: yükleme sunucusu (UploadThing)
 * ya da GIF sağlayıcısı. Kullanıcının yazdığı sıradan bağlantılar (YouTube,
 * haber sitesi) metnin parçasıdır ve kalır.
 */
export function isHiddenPreviewUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return UPLOAD_HOST_RE.test(host) || GIF_HOST_RE.test(host);
}

function attachmentUrls(fileUrl: string | null | undefined, metadata: unknown): string[] {
  const urls: string[] = [];
  if (fileUrl?.trim()) urls.push(fileUrl.trim());
  const list = isRecord(metadata) ? metadata.attachments : null;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (isRecord(entry) && typeof entry.url === "string" && entry.url.trim()) urls.push(entry.url.trim());
    }
  }
  // Liste ilk eki (`fileUrl`) de içeriyor.
  return [...new Set(urls)];
}

/**
 * Metinden ek adreslerini ve gizli (yükleme/GIF) bağlantıları ayıklar,
 * boşlukları tekler. `knownUrls`: mesajın kendi ek adresleri — sunucusu ne
 * olursa olsun düşer (iletilen, eski barındırıcıdaki ekler).
 */
export function stripAttachmentUrls(text: string | null | undefined, knownUrls: readonly string[] = []): string {
  if (!text) return "";
  let out = text;
  for (const url of knownUrls) {
    if (url) out = out.split(url).join(" ");
  }
  out = out.replace(URL_TOKEN_RE, (token) => {
    // Cümle sonundaki noktalama adrese dahil değil.
    const trimmed = token.replace(/[),.;:!?\]]+$/, "");
    if (!isHiddenPreviewUrl(trimmed)) return token;
    return " " + token.slice(trimmed.length);
  });
  return out.replace(EMPTY_WRAPPERS_RE, " ").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return undefined;
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name;
}

/**
 * Güvenilmeyen kaynaktan (tel, MongoDB) gelen medya alanını doğrular;
 * biçim bozuksa null. Ad, adres gibi görünüyorsa düşer — bağlantı bu
 * kapıdan da sızmasın.
 */
export function readPreviewMedia(value: unknown): PreviewMedia | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  if (typeof kind !== "string" || !(PREVIEW_MEDIA_KINDS as readonly string[]).includes(kind)) return null;
  const media: PreviewMedia = { kind: kind as PreviewMediaKind };
  const name = cleanName(value.name);
  if (name && !HAS_URL_RE.test(name)) media.name = name;
  const durationMs = positiveMs(value.durationMs);
  if (durationMs) media.durationMs = durationMs;
  if (typeof value.count === "number" && Number.isInteger(value.count) && value.count > 1 && value.count <= 100) {
    media.count = value.count;
  }
  if (media.kind === "file" && !media.name) media.kind = "attachment";
  return media;
}

function readAttachmentInfo(metadata: unknown): AttachmentInfo | null {
  const raw = isRecord(metadata) ? metadata.attachment : null;
  if (!isRecord(raw)) return null;
  return {
    ...(typeof raw.name === "string" && raw.name ? { name: raw.name } : {}),
    ...(typeof raw.type === "string" && raw.type ? { type: raw.type } : {}),
    ...(typeof raw.size === "number" ? { size: raw.size } : {}),
  };
}

/** Adresin anlamlı dosya adı; UploadThing anahtarı ad sayılmaz. */
function meaningfulFileName(url: string): string | undefined {
  if (isUploadHostUrl(url) || isHiddenPreviewUrl(url)) return undefined;
  const name = cleanName(fileNameFromUrl(url));
  return name && /\.[a-z0-9]{1,8}$/i.test(name) ? name : undefined;
}

/** Ek adresi + ek bilgisinden medya türü. */
function mediaFromFile(url: string, info: AttachmentInfo | null): PreviewMedia {
  const mime = (info?.type ?? "").toLowerCase();
  const infoName = cleanName(info?.name);
  if (mime === "image/gif" || isGifUrl(url) || (infoName && /\.gif$/i.test(infoName))) return { kind: "gif" };

  switch (classifyAttachment(url, info)) {
    case "image":
      return { kind: "image" };
    case "video":
      return { kind: "video" };
    case "probe":
      // Tür bilinmeyen eski UploadThing eki: çoğunlukla görsel ama emin
      // olunamıyor; genel etiket yanıltmaz.
      return infoName ? { kind: "file", name: infoName } : { kind: "attachment" };
    default: {
      const name = infoName ?? meaningfulFileName(url);
      return name ? { kind: "file", name } : { kind: "attachment" };
    }
  }
}

/** Metin yalnızca TEK bir adresten mi ibaret (eski ek/GIF mesajı)? */
function loneUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/**
 * Aktivite davet kartı mı? Kartın içeriği `ad|durum` biçiminde saklanıyor
 * (`Birlikte İzle|TS:1793…`, `…|Katılmak için tıkla`, `…|Aktivite sona
 * erdi…`); önizleme bunu olduğu gibi basıyordu. Metadata varsa adı oradan,
 * yoksa (tel biçimi / eski kayıt) içerik kalıbından alır.
 */
const ACTIVITY_CARD_RE = /^([^|\n]{1,100})\|(?:TS:\d+|Katılmak için tıkla|Aktivite sona erdi\..*)$/;

function activityCardName(raw: string, meta: Record<string, unknown> | null): string | null {
  const fromMeta = meta && typeof meta.activityName === "string" ? meta.activityName.trim() : "";
  if (fromMeta && (typeof meta?.activityId === "string" || ACTIVITY_CARD_RE.test(raw.trim()))) return fromMeta;
  const match = ACTIVITY_CARD_RE.exec(raw.trim());
  return match ? match[1].trim() : null;
}

/**
 * Mesajın dilden bağımsız önizlemesi.
 *
 * Öncelik: tel biçimindeki hazır `media` > metadata (çıkartma, sesli mesaj,
 * klip) > ek adresi > içeriğin kendisi yalnızca gizli bir adresse o adres.
 */
export function describeMessagePreview(source: PreviewSource | null | undefined): MessagePreview {
  if (!source) return { text: "", media: null };
  const raw = (source.content ?? source.message ?? "").toString();
  const metadata = source.metadata;
  const fileUrl = typeof source.fileUrl === "string" ? source.fileUrl.trim() : "";
  const urls = attachmentUrls(fileUrl, metadata);
  const text = stripAttachmentUrls(raw, urls);

  const given = readPreviewMedia(source.media);
  if (given) return { text, media: given };

  const meta = isRecord(metadata) ? metadata : null;

  // Aktivite davet kartı: ham `ad|TS:…` yerine "🎮 Etkinlik: ad".
  const activity = activityCardName(raw, meta);
  if (activity) return { text: "", media: { kind: "activity", name: activity } };

  // Çıkartma: içerik çıkartmanın adı (arama/bildirim metni), kullanıcı metni değil.
  if (meta && isRecord(meta.sticker)) {
    return { text: "", media: { kind: "sticker" } };
  }

  const voice = meta && isRecord(meta.voice) ? positiveMs(meta.voice.durationMs) : undefined;
  if (voice) return { text, media: { kind: "voice", durationMs: voice } };

  if (meta && isRecord(meta.clip)) {
    const durationMs = positiveMs(meta.clip.durationMs);
    return { text, media: { kind: "clip", ...(durationMs ? { durationMs } : {}) } };
  }

  // `watch-together://` gibi uygulama içi bağlantılar ek değil.
  if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
    const media = mediaFromFile(fileUrl, readAttachmentInfo(metadata));
    if (urls.length > 1) media.count = urls.length;
    return { text, media };
  }

  // Eski kayıt: ek alanı yok (yanıt anlık görüntüsü, bazı GIF mesajları)
  // ama metnin kendisi bir yükleme/GIF adresi.
  const lone = loneUrl(raw);
  if (lone && !text) return { text: "", media: mediaFromFile(lone, null) };

  return { text, media: null };
}

/** Etiketler — i18n sözlüğündeki `messagePreview` ad alanıyla aynı şekil. */
export interface PreviewLabels {
  voice: string;
  voiceWithDuration: string;
  image: string;
  video: string;
  gif: string;
  sticker: string;
  clip: string;
  file: string;
  attachment: string;
  activity: string;
  activityUnnamed: string;
}

/** i18n'den etiketler. `t` yoksa uygulamanın o anki dili. */
export function previewLabels(t: Translator = currentTranslator()): PreviewLabels {
  return {
    voice: t("messagePreview.voice"),
    voiceWithDuration: t("messagePreview.voiceWithDuration"),
    image: t("messagePreview.image"),
    video: t("messagePreview.video"),
    gif: t("messagePreview.gif"),
    sticker: t("messagePreview.sticker"),
    clip: t("messagePreview.clip"),
    file: t("messagePreview.file"),
    attachment: t("messagePreview.attachment"),
    activity: t("messagePreview.activity"),
    activityUnnamed: t("messagePreview.activityUnnamed"),
  };
}

/** "0:04", "12:30" — sesli mesaj oynatıcısıyla aynı biçim. */
export function formatPreviewDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Medyanın tek satırlık etiketi ("🎤 Sesli mesaj (0:04)", "📎 rapor.pdf"). */
export function mediaLabel(media: PreviewMedia, labels: PreviewLabels = previewLabels()): string {
  let label: string;
  switch (media.kind) {
    case "voice":
      label = media.durationMs
        ? labels.voiceWithDuration.replace("{duration}", formatPreviewDuration(media.durationMs))
        : labels.voice;
      break;
    case "image":
      label = labels.image;
      break;
    case "video":
      label = labels.video;
      break;
    case "gif":
      label = labels.gif;
      break;
    case "sticker":
      label = labels.sticker;
      break;
    case "clip":
      label = labels.clip;
      break;
    case "file":
      label = media.name ? labels.file.replace("{name}", media.name) : labels.attachment;
      break;
    case "activity":
      label = media.name ? labels.activity.replace("{name}", media.name) : labels.activityUnnamed;
      break;
    default:
      label = labels.attachment;
  }
  return media.count && media.count > 1 ? `${label} +${media.count - 1}` : label;
}

export interface FormatPreviewOptions {
  /** Arayüz dili; yoksa uygulamanın o anki dili. */
  t?: Translator;
  /** Hazır etiketler (`t` yerine; sıcak yolda bir kez üretilip paylaşılır). */
  labels?: PreviewLabels;
  /** Karakter tavanı; aşılırsa "…" ile kesilir. */
  maxLength?: number;
  /** Ne metin ne medya varsa. */
  fallback?: string;
}

/**
 * Tek satırlık önizleme metni. Metin varsa metin (adresleri ayıklanmış),
 * yoksa medya etiketi, o da yoksa `fallback`.
 */
export function formatMessagePreview(
  source: PreviewSource | MessagePreview | null | undefined,
  options: FormatPreviewOptions = {},
): string {
  const preview = isMessagePreview(source) ? normalizePreview(source) : describeMessagePreview(source);
  let out = preview.text;
  if (!out && preview.media) out = mediaLabel(preview.media, options.labels ?? previewLabels(options.t));
  if (!out) out = options.fallback ?? "";
  const max = options.maxLength;
  if (max && max > 1 && out.length > max) out = `${out.slice(0, max - 1).trimEnd()}…`;
  return out;
}

function isMessagePreview(value: unknown): value is MessagePreview {
  return isRecord(value) && typeof value.text === "string" && "media" in value && !("content" in value);
}

function normalizePreview(preview: MessagePreview): MessagePreview {
  const media = readPreviewMedia(preview.media);
  if (!media) {
    // Eski sunucu ya da önbellek: hazır önizlemede ham kart metni.
    const activity = activityCardName(preview.text, null);
    if (activity) return { text: "", media: { kind: "activity", name: activity } };
  }
  return { text: stripAttachmentUrls(preview.text), media };
}
