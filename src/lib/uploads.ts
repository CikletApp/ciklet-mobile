import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { genUploader } from "uploadthing/client";

import { cookieHeaderFor, getSession } from "@/api/client";
import { API_BASE_URL } from "@/lib/config";

const FREE_UPLOAD_LIMIT = 8 * 1024 * 1024;

/** v7 yükleme sonucu; yalnızca kullandığımız alan. */
interface UploadedFile {
  /** Uygulamaya özel CDN adresi (`<appId>.ufs.sh`); web de bunu kullanıyor. */
  ufsUrl: string;
}

/**
 * React Native'de dosya DÜZ nesne olarak verilir. v7 istemcisi `uri`
 * alanını görünce FormData'ya `{ uri, type, name }` koyuyor; iOS'ta File ya
 * da Blob eklemek "attempt to insert nil object" ile çöküyor. `size` ve
 * `lastModified` sunucuya giden meta veri için.
 */
interface NativeUploadFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

interface UploadOptions {
  files: NativeUploadFile[];
  headers: () => Promise<HeadersInit>;
  onUploadProgress?: (event: { progress: number }) => void;
}

type UploadFiles = (endpoint: string, options: UploadOptions) => Promise<UploadedFile[]>;

/**
 * Sunucu uploadthing v7 çalıştırıyor. v6 istemcisi (önceki sürüm) sunucunun
 * yanıtını çözemiyordu: v6 S3 çok parçalı alanları ve `pollingUrl`
 * bekliyor, v7 ise doğrudan UploadThing'in ingest adreslerini veriyor.
 * Mobilden yükleme bu yüzden hiç çalışmıyordu. v7'de `genUploader` bir
 * fonksiyon değil, `{ uploadFiles }` nesnesi döndürüyor; `skipPolling`
 * de sunucu rotasına (`awaitServerData`) taşındı.
 *
 * Sunucunun dosya yönlendirici tipi bu repoda yok; istemci yalnızca uç adı
 * ve dönüş adresiyle çalıştığı için yerel tiplerle daraltılıyor.
 */
const { uploadFiles } = (
  genUploader as unknown as (options: { url: URL; package: string }) => {
    uploadFiles: UploadFiles;
  }
)({
  url: new URL("/api/uploadthing", API_BASE_URL),
  package: "ciklet-mobile",
});

export interface MessageAttachment {
  url: string;
  name: string;
  mimeType: string;
}

async function uploadPickedFile(
  endpoint: "messageFile" | "profileImage" | "profileBanner" | "serverImage" | "serverBanner",
  asset: DocumentPicker.DocumentPickerAsset,
  onProgress?: (progress: number) => void
): Promise<{ url: string; mimeType: string }> {
  // Seçici boyutu ve türü çoğu zaman veriyor; vermezse dosyanın kendisinden.
  const local = new ExpoFile(asset.uri);
  const size = asset.size ?? local.size ?? 0;
  if (size > FREE_UPLOAD_LIMIT) {
    throw new Error("Bu cihazda tek dosya için üst sınır 8 MB.");
  }
  const mimeType = asset.mimeType ?? (local.type || "application/octet-stream");

  const uploaded = await uploadFiles(endpoint, {
    files: [
      {
        uri: asset.uri,
        name: asset.name,
        type: mimeType,
        size,
        lastModified: asset.lastModified ?? Date.now(),
      },
    ],
    headers: async () => {
      const session = await getSession();
      const headers = new Headers();
      if (session) headers.set("Cookie", cookieHeaderFor(session));
      return headers;
    },
    onUploadProgress: ({ progress }) => onProgress?.(progress),
  }).catch((err: unknown) => {
    // UploadThing hataları ham gelir ("XHR failed 400 undefined"); ayrıntı
    // geliştirici günlüğüne, kullanıcıya anlaşılır bir cümle.
    const detail = err as { code?: string; message?: string; data?: unknown };
    if (__DEV__) console.warn("[yükleme]", detail.code, detail.message, detail.data);
    throw new Error(
      detail.code === "TOO_LARGE" || detail.code === "FILE_LIMIT_EXCEEDED"
        ? "Dosya bu plan için çok büyük."
        : "Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene."
    );
  });

  const file = uploaded[0];
  if (!file?.ufsUrl) throw new Error("Dosya yüklendi ancak adres alınamadı.");
  return { url: file.ufsUrl, mimeType };
}

/**
 * Sistem dosya seçicisini açar ve webdeki `messageFile` rotasına yükler.
 * Picker dosyayı önbelleğe kopyalar; Expo File bu URI'yi Blob olarak
 * sunabildiği için büyük dosyalarda base64 kopyası oluşturulmaz.
 */
export async function pickAndUploadMessageFile(
  onProgress?: (progress: number) => void
): Promise<MessageAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "video/*", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  const { url, mimeType } = await uploadPickedFile("messageFile", asset, onProgress);

  return { url, name: asset.name, mimeType };
}

/** Galeriden/dosyalardan bir görsel seçer ve webdeki profil rotasına yükler. */
export async function pickAndUploadProfileImage(
  onProgress?: (progress: number) => void
): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return (await uploadPickedFile("profileImage", result.assets[0], onProgress)).url;
}

async function pickAndUploadImage(
  endpoint: "profileImage" | "profileBanner" | "serverImage" | "serverBanner",
  onProgress?: (progress: number) => void
): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return (await uploadPickedFile(endpoint, result.assets[0], onProgress)).url;
}

export const pickAndUploadServerImage = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("serverImage", onProgress);

/** Profil afişi (görsel, 8 MB) — webdeki `profileBanner` rotası (2026-09-26). */
export const pickAndUploadProfileBanner = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("profileBanner", onProgress);

export const pickAndUploadServerBanner = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("serverBanner", onProgress);
