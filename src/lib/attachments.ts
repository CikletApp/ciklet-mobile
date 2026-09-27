/**
 * Mesaj ekleri — ciklet-web `src/lib/attachments.ts`'in mobil karşılığı.
 *
 * UploadThing adresleri (`<app>.ufs.sh/f/<anahtar>`) ne uzantı ne dosya adı
 * taşır. Eskiden mobil türü YALNIZCA adres uzantısından çıkarıyordu; bu
 * yüzden yüklenen her görsel ve video "Dosyayı aç" kutusu olarak görünüyordu.
 * Sınıflama artık web'le aynı sırada: önce gönderim anında mesaja yazılan
 * `metadata.attachment` (ad, MIME, boyut), sonra adres uzantısı, ikisi de
 * yoksa "görsel olarak dene" (probe).
 */

/** Gönderim anında mesaja yazılan ek bilgisi (`metadata.attachment`). */
export interface AttachmentInfo {
  name?: string;
  /** MIME türü — bilinmiyorsa boş olabilir. */
  type?: string;
  /** Bayt. */
  size?: number;
}

/**
 * Web'deki türlerle aynı. "text" mobilde kod kutusu yerine dosya kartı
 * olarak çiziliyor; ayrım yine de korunuyor ki simge doğru olsun.
 */
export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "text" | "file" | "probe";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|heic)$/i;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|3gp)$/i;
const AUDIO_RE = /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/i;
const PDF_RE = /\.pdf$/i;
const TEXT_RE = /\.(txt|log|csv|md|json|xml|html?|css|js|ts|tsx|jsx|py|java|kt|c|cpp|h|cs|go|rs|sh|ya?ml|toml|ini|sql)$/i;
const UPLOAD_HOST_RE = /(^|\.)(ufs\.sh|utfs\.io|uploadthing\.com)$/i;

/** Adresin son parçasından dosya adı; adres bozuksa boş. */
export function fileNameFromUrl(url: string): string {
  try {
    const last = url.split("/").pop()?.split("?")[0]?.split("#")[0] ?? "";
    return decodeURIComponent(last);
  } catch {
    return "";
  }
}

/**
 * Ek adresi UploadThing'de mi? `URL.hostname` React Native'in URL
 * uygulamasında her sürümde yok; ana bilgisayar adı elle ayrıştırılıyor.
 */
export function isUploadHostUrl(url: string): boolean {
  const host = /^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i.exec(url)?.[1];
  return host ? UPLOAD_HOST_RE.test(host) : false;
}

/** `metadata.attachment`'ı güvenle okur; biçim bozuksa null. */
export function readAttachmentInfo(metadata: unknown): AttachmentInfo | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as { attachment?: unknown }).attachment;
  if (!raw || typeof raw !== "object") return null;
  const { name, type, size } = raw as Record<string, unknown>;
  const info: AttachmentInfo = {
    ...(typeof name === "string" && name ? { name } : {}),
    ...(typeof type === "string" && type ? { type } : {}),
    ...(typeof size === "number" && Number.isFinite(size) ? { size } : {}),
  };
  return Object.keys(info).length > 0 ? info : null;
}

/**
 * Ekin nasıl çizileceği. "probe": tür bilinmiyor, önce görsel olarak
 * denenir; yüklenemezse dosya kartına düşülür (eski UploadThing mesajları).
 */
export function classifyAttachment(url: string, info?: AttachmentInfo | null): AttachmentKind {
  const type = (info?.type ?? "").toLowerCase();
  const name = info?.name || fileNameFromUrl(url);

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("text/")) return "text";

  if (IMAGE_RE.test(name)) return "image";
  if (VIDEO_RE.test(name)) return "video";
  if (AUDIO_RE.test(name)) return "audio";
  if (PDF_RE.test(name)) return "pdf";
  if (TEXT_RE.test(name)) return "text";

  // Ne tür ne anlamlı bir ad var: UploadThing anahtarı — görsel olabilir.
  if (!type && !info?.name && isUploadHostUrl(url)) return "probe";
  return "file";
}

/** Kartta gösterilecek ad; anahtar-adreslerde anlamsız olduğu için "Dosya". */
export function attachmentDisplayName(url: string, info?: AttachmentInfo | null): string {
  if (info?.name) return info.name;
  if (isUploadHostUrl(url)) return "Dosya";
  return fileNameFromUrl(url) || "Dosya";
}

/** "4 KB", "1,2 MB" — Türkçe ondalık ayracıyla (web'le aynı). */
export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes < 0) return "";
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const trim = (value: number) => value.toFixed(value < 10 ? 2 : 1).replace(/\.?0+$/, "").replace(".", ",");
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  if (bytes < GB) return `${trim(bytes / MB)} MB`;
  return `${trim(bytes / GB)} GB`;
}

/** Sohbet listesi önizlemesi için kısa etiket. */
export function attachmentPreviewLabel(url: string, info?: AttachmentInfo | null): string {
  const kind = classifyAttachment(url, info);
  // "probe" burada Fotoğraf sayılmıyor: listede görseli deneyip düşme şansı
  // yok, yanlış etiket "Dosya"dan daha yanıltıcı.
  if (kind === "image") return "📷 Fotoğraf";
  if (kind === "video") return "🎬 Video";
  if (kind === "audio") return "🎵 Ses";
  return "📎 Dosya";
}
