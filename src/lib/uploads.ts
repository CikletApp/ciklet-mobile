import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { genUploader } from "uploadthing/client";

import { cookieHeaderFor, getSession } from "@/api/client";
import { API_BASE_URL } from "@/lib/config";

const FREE_UPLOAD_LIMIT = 8 * 1024 * 1024;

interface UploadedFile {
  url: string;
}

interface UploadOptions {
  files: File[];
  headers: () => Promise<HeadersInit>;
  onUploadProgress?: (event: { progress: number }) => void;
  skipPolling?: boolean;
}

type UploadFiles = (endpoint: string, options: UploadOptions) => Promise<UploadedFile[]>;

const uploadFiles = (
  genUploader as unknown as (options: { url: URL; package: string }) => UploadFiles
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
  endpoint: "messageFile" | "profileImage" | "serverImage" | "serverBanner",
  asset: DocumentPicker.DocumentPickerAsset,
  onProgress?: (progress: number) => void
): Promise<{ url: string; source: ExpoFile }> {
  if ((asset.size ?? 0) > FREE_UPLOAD_LIMIT) {
    throw new Error("Bu cihazda tek dosya için üst sınır 8 MB.");
  }

  const source = new ExpoFile(asset.uri);
  Object.defineProperty(source, "name", {
    configurable: true,
    enumerable: true,
    value: asset.name,
  });

  const uploaded = await uploadFiles(endpoint, {
    files: [source as unknown as File],
    headers: async () => {
      const session = await getSession();
      const headers = new Headers();
      if (session) headers.set("Cookie", cookieHeaderFor(session));
      return headers;
    },
    onUploadProgress: ({ progress }) => onProgress?.(progress),
    skipPolling: true,
  });

  const file = uploaded[0];
  if (!file?.url) throw new Error("Dosya yüklendi ancak adres alınamadı.");
  return { url: file.url, source };
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

  const { url, source } = await uploadPickedFile("messageFile", asset, onProgress);

  return {
    url,
    name: asset.name,
    mimeType: asset.mimeType ?? (source.type || "application/octet-stream"),
  };
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
  endpoint: "profileImage" | "serverImage" | "serverBanner",
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

export const pickAndUploadServerBanner = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("serverBanner", onProgress);
