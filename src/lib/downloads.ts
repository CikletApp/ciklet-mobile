import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import CikletDownloads from "../../modules/ciklet-downloads";

/**
 * Ek indirme — uygulamadan ÇIKMADAN.
 *
 * Eskiden ek dokununca tarayıcıda açılıyordu; kullanıcı Ciklet'ten çıkıp
 * CDN adresine düşüyordu. Artık dosya önce önbelleğe iniyor, sonra:
 *
 *  • Android 10+: yerel modülle (modules/ciklet-downloads) HİÇBİR ŞEY
 *    SORMADAN "İndirilenler/Ciklet"e yazılıyor (MediaStore, izinsiz).
 *  • Diğerleri: kullanıcının seçtiği klasöre (sistem klasör seçicisi).
 *
 * Seçici yolunda klasör YALNIZCA İLK indirmede soruluyor: seçici kalıcı erişim izni alıyor
 * (`takePersistableUriPermission`), adresi saklıyoruz ve sonraki indirmeler
 * doğrudan oraya gidiyor. Klasör silinmiş ya da izin kaldırılmışsa yazma
 * başarısız olur ve bir kez yeniden sorulur.
 *
 * Galeri kütüphanesi (expo-media-library) bilinçli olarak kullanılmıyor: Android
 * manifestine medya okuma izinleri ekliyor ve Play Store bunlar için ayrıca
 * gerekçe istiyor. İndirilenler'e yazılan görseller galeride de görünür.
 */

const DIRECTORY_KEY = "ciklet.downloads.directory";

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

export interface DownloadRequest {
  url: string;
  /** `metadata.attachment.name`; yoksa zaman damgalı ad üretilir. */
  name?: string;
  mimeType?: string;
}

/** `downloads`: İndirilenler/Ciklet; `folder`: kullanıcının seçtiği klasör. */
export type DownloadResult = "downloads" | "folder" | "cancelled";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Dosya sisteminde geçersiz karakterler ayıklanır; ad yoksa üretilir. */
function fileNameFor(name: string | undefined, mimeType: string | null): string {
  const clean = (name ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  // "Dosya" UploadThing anahtarlı eski eklerin yer tutucu adı; gerçek ad değil.
  if (clean && clean !== "Dosya" && clean !== "GIF") return clean.slice(0, 120);
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const extension = mimeType ? EXTENSION_BY_MIME[mimeType.toLowerCase().split(";")[0].trim()] : undefined;
  return `ciklet-${stamp}${extension ? `.${extension}` : ""}`;
}

async function pickDirectory(): Promise<Directory | null> {
  const last = await AsyncStorage.getItem(DIRECTORY_KEY).catch(() => null);
  try {
    const directory = await Directory.pickDirectoryAsync(last ?? undefined);
    await AsyncStorage.setItem(DIRECTORY_KEY, directory.uri).catch(() => {});
    return directory;
  } catch {
    // Kullanıcı seçiciyi kapattı.
    return null;
  }
}

async function savedDirectory(): Promise<Directory | null> {
  const uri = await AsyncStorage.getItem(DIRECTORY_KEY).catch(() => null);
  if (!uri) return null;
  try {
    const directory = new Directory(uri);
    return directory.exists ? directory : null;
  } catch {
    return null;
  }
}

async function downloadToCache(url: string): Promise<File> {
  const staging = new Directory(Paths.cache, "downloads");
  if (!staging.exists) staging.create({ intermediates: true, idempotent: true });
  return File.downloadFileAsync(url, new File(staging, `${Date.now()}`));
}

export async function downloadAttachment({ url, name, mimeType }: DownloadRequest): Promise<DownloadResult> {
  if (CikletDownloads?.isSupported()) {
    const downloaded = await downloadToCache(url);
    try {
      const type = mimeType || downloaded.type || null;
      await CikletDownloads.saveToDownloads(downloaded.uri, fileNameFor(name, type), type);
      return "downloads";
    } finally {
      try {
        downloaded.delete();
      } catch {
        /* Önbellek sistem tarafından da temizlenir. */
      }
    }
  }

  let directory = (await savedDirectory()) ?? (await pickDirectory());
  if (!directory) return "cancelled";

  const downloaded = await downloadToCache(url);

  try {
    const type = mimeType || downloaded.type || null;
    const fileName = fileNameFor(name, type);
    const bytes = await downloaded.bytes();
    try {
      directory.createFile(fileName, type).write(bytes);
    } catch {
      // Saklanan klasöre artık yazılamıyor (silindi, izin kaldırıldı):
      // bir kez yeniden sor.
      directory = await pickDirectory();
      if (!directory) return "cancelled";
      directory.createFile(fileName, type).write(bytes);
    }
  } finally {
    try {
      downloaded.delete();
    } catch {
      /* Önbellek sistem tarafından da temizlenir. */
    }
  }
  return "folder";
}
