import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { genUploader } from "uploadthing/client";

import { cookieHeaderFor, getSession } from "@/api/client";
import type { MentolPlan } from "@/api/hooks";
import { queryClient } from "@/api/query-client";
import { API_BASE_URL } from "@/lib/config";
import { UserFacingUploadError, uploadErrorMessage, uploadRouteUrl } from "@/lib/upload-logic";

export { UserFacingUploadError } from "@/lib/upload-logic";

/** Plan bilgisi gelmeden önce EN DAR sınır uygulanır (web `FREE_FALLBACK` ile aynı). */
const FREE_UPLOAD_LIMIT_MB = 8;

/**
 * Etkin Mentol planının yükleme sınırı — web `useUploadLimitBytes`.
 * Yalnızca arayüz için: sunucu (uploadthing/core.ts) yeniden doğrular. Plan
 * sorgusu `useMentolPlan` ile cache'te duruyor; burada hook kullanılamaz.
 */
function uploadLimitBytes(): number {
  const plan = queryClient.getQueryData<MentolPlan>(["mentol-plan"]);
  const mb = plan?.features?.maxUploadMb ?? FREE_UPLOAD_LIMIT_MB;
  return mb * 1024 * 1024;
}

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

type GenUploader = (options: { url: URL; package: string }) => { uploadFiles: UploadFiles };

/**
 * Sunucu uploadthing v7 çalıştırıyor. v6 istemcisi (önceki sürüm) sunucunun
 * yanıtını çözemiyordu: v6 S3 çok parçalı alanları ve `pollingUrl`
 * bekliyor, v7 ise doğrudan UploadThing'in ingest adreslerini veriyor.
 * v7'de `genUploader` bir fonksiyon değil, `{ uploadFiles }` nesnesi
 * döndürüyor; `skipPolling` de sunucu rotasına (`awaitServerData`) taşındı.
 *
 * Yükleyici ÇAĞRI ANINDA kurulur (ucuz: yalnızca kapanış nesnesi). Modül
 * düzeyinde kurulan `URL`, LiveKit'in `setupURLPolyfill()`'i global `URL`'i
 * değiştirdikten sonra `instanceof URL` denetimini geçemiyor ve UploadThing
 * `window.location.origin`'e düşüp çöküyordu — bkz. `upload-logic.ts`
 * `uploadRouteUrl`.
 *
 * Sunucunun dosya yönlendirici tipi bu repoda yok; istemci yalnızca uç adı
 * ve dönüş adresiyle çalıştığı için yerel tiplerle daraltılıyor.
 */
function createUploadFiles(): UploadFiles {
  return (genUploader as unknown as GenUploader)({
    url: uploadRouteUrl(API_BASE_URL),
    package: "ciklet-mobile",
  }).uploadFiles;
}

export interface MessageAttachment {
  url: string;
  name: string;
  mimeType: string;
  /** Bayt — mesajın `metadata.attachment.size` alanına yazılır. */
  size: number;
}

/**
 * Seçilen yerel dosya — galeri, kamera ya da dosya seçicisinden; üçü de
 * aynı yükleme yolundan geçer.
 */
export interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  lastModified?: number | null;
}

type UploadEndpoint = "messageFile" | "profileImage" | "profileBanner" | "serverImage" | "serverBanner" | "groupImage" | "roleIcon";

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** Galeri/kamera seçimi çoğu zaman ad vermiyor; türe göre okunur bir ad üretilir. */
function nameForAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.fileName?.trim()) return asset.fileName.trim();
  const mime = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const extension = EXTENSION_BY_MIME[mime] ?? (asset.type === "video" ? "mp4" : "jpg");
  const prefix = asset.type === "video" ? "video" : "foto";
  return `${prefix}-${Date.now()}.${extension}`;
}

function fromImagePicker(asset: ImagePicker.ImagePickerAsset): PickedAsset {
  return {
    uri: asset.uri,
    name: nameForAsset(asset),
    mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
    size: typeof asset.fileSize === "number" ? asset.fileSize : null,
  };
}

function fromDocumentPicker(asset: DocumentPicker.DocumentPickerAsset): PickedAsset {
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
    lastModified: asset.lastModified ?? null,
  };
}

/**
 * Galeriden görsel (isteğe bağlı video) seçer. Android 13+ sistem fotoğraf
 * seçicisi izin istemez; eski sürümlerde seçici kendi izin akışını yürütür.
 */
export async function pickFromGallery(options: {
  videos?: boolean;
  /** Kırpma ekranı (Android) — avatar ve afiş için oran. */
  aspect?: [number, number];
} = {}): Promise<PickedAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: options.videos ? ["images", "videos"] : ["images"],
    allowsMultipleSelection: false,
    allowsEditing: Boolean(options.aspect),
    aspect: options.aspect,
    quality: 0.9,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImagePicker(result.assets[0]);
}

/** Kamerayla fotoğraf çeker; izin reddedilirse anlaşılır bir hata fırlatır. */
export async function captureFromCamera(): Promise<PickedAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new UserFacingUploadError("Kamera izni verilmedi. Sistem ayarlarından Ciklet için kamerayı açabilirsin.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromImagePicker(result.assets[0]);
}

/** Sistem dosya seçicisi — her tür dosya; sunucu türü ve boyutu denetler. */
export async function pickDocument(): Promise<PickedAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return fromDocumentPicker(result.assets[0]);
}

async function uploadPickedFile(
  endpoint: UploadEndpoint,
  asset: PickedAsset,
  onProgress?: (progress: number) => void
): Promise<{ url: string; mimeType: string; size: number }> {
  // Seçici boyutu ve türü çoğu zaman veriyor; vermezse dosyanın kendisinden.
  const local = new ExpoFile(asset.uri);
  const size = asset.size ?? local.size ?? 0;
  const limit = uploadLimitBytes();
  if (size > limit) {
    throw new UserFacingUploadError(`Bu plan için tek dosya üst sınırı ${Math.round(limit / (1024 * 1024))} MB.`);
  }
  const mimeType = asset.mimeType ?? (local.type || "application/octet-stream");

  let uploaded: UploadedFile[];
  try {
    // `await` içinde: istemci bazı hataları (adres çözümü gibi) Promise
    // yerine EŞZAMANLI fırlatıyor; `.catch` onları yakalamıyordu ve ham
    // İngilizce ileti ekrana çıkıyordu.
    uploaded = await createUploadFiles()(endpoint, {
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
    });
  } catch (err: unknown) {
    // UploadThing hataları ham gelir ("XHR failed 400 undefined"); ayrıntı
    // geliştirici günlüğüne, kullanıcıya anlaşılır bir cümle.
    const detail = err as { code?: string; message?: string; data?: unknown };
    if (__DEV__) console.warn("[yükleme]", detail?.code, detail?.message, detail?.data);
    throw new UserFacingUploadError(uploadErrorMessage(err));
  }

  const file = uploaded[0];
  if (!file?.ufsUrl) throw new UserFacingUploadError("Dosya yüklendi ancak adres alınamadı. Tekrar dene.");
  return { url: file.ufsUrl, mimeType, size };
}

/** Seçilmiş bir dosyayı webdeki `messageFile` rotasına yükler. */
export async function uploadMessageAttachment(
  asset: PickedAsset,
  onProgress?: (progress: number) => void
): Promise<MessageAttachment> {
  const { url, mimeType, size } = await uploadPickedFile("messageFile", asset, onProgress);
  return { url, name: asset.name, mimeType, size };
}

/**
 * Sistem dosya seçicisini açar ve webdeki `messageFile` rotasına yükler.
 * Picker dosyayı önbelleğe kopyalar; Expo File bu URI'yi Blob olarak
 * sunabildiği için büyük dosyalarda base64 kopyası oluşturulmaz.
 */
export async function pickAndUploadMessageFile(
  onProgress?: (progress: number) => void
): Promise<MessageAttachment | null> {
  const asset = await pickDocument();
  if (!asset) return null;
  return uploadMessageAttachment(asset, onProgress);
}

async function pickAndUploadImage(
  endpoint: Exclude<UploadEndpoint, "messageFile">,
  aspect: [number, number],
  onProgress?: (progress: number) => void
): Promise<string | null> {
  const asset = await pickFromGallery({ aspect });
  if (!asset) return null;
  return (await uploadPickedFile(endpoint, asset, onProgress)).url;
}

/** Galeriden bir görsel seçer (kare kırpma) ve webdeki profil rotasına yükler. */
export const pickAndUploadProfileImage = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("profileImage", [1, 1], onProgress);

export const pickAndUploadServerImage = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("serverImage", [1, 1], onProgress);

/** Profil afişi (görsel, 8 MB) — webdeki `profileBanner` rotası (2026-09-26). */
export const pickAndUploadProfileBanner = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("profileBanner", [3, 1], onProgress);

export const pickAndUploadServerBanner = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("serverBanner", [3, 1], onProgress);

/** Rol simgesinin tavanı — web UploadThing `roleIcon` rotası (256 KB). */
const ROLE_ICON_MAX_BYTES = 256 * 1024;
/** Simge adın yanında 16-20 px çizilir; 128 px fazlasıyla yeter. */
const ROLE_ICON_SIZE = 128;

/**
 * Rol simgesi (web Roller sekmesi "Görsel yükle"): kare kırpılır, 128 px'e
 * küçültülüp PNG'ye çevrilir — galeriden gelen fotoğraf 256 KB'ı rahat aşar.
 */
export async function pickAndUploadRoleIcon(onProgress?: (progress: number) => void): Promise<string | null> {
  const asset = await pickFromGallery({ aspect: [1, 1] });
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri).resize({ width: ROLE_ICON_SIZE, height: ROLE_ICON_SIZE });
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
    const size = new ExpoFile(saved.uri).size ?? 0;
    if (size > ROLE_ICON_MAX_BYTES) throw new UserFacingUploadError("Rol simgesi en fazla 256 KB olabilir.");
    const picked: PickedAsset = { uri: saved.uri, name: `rol-simgesi-${Date.now()}.png`, mimeType: "image/png", size };
    return (await uploadPickedFile("roleIcon", picked, onProgress)).url;
  } finally {
    rendered.release();
    context.release();
  }
}

/**
 * Sohbetin çoklu ek seçimi (mesaj başına en çok 10 dosya; web
 * `MAX_ATTACHMENTS`). Galeri sırası korunur; `limit` kalan yer kadar.
 */
export async function pickManyFromGallery(limit: number): Promise<PickedAsset[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.9,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map(fromImagePicker);
}

/** Sistem dosya seçicisinden birden çok dosya; `limit` kalan yer kadar. */
export async function pickDocuments(limit: number): Promise<PickedAsset[]> {
  if (limit <= 0) return [];
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: limit > 1,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, limit).map(fromDocumentPicker);
}

/** Grup DM simgesi (görsel, 4 MB, kare) — webdeki `groupImage` rotası. */
export const pickAndUploadGroupImage = (onProgress?: (progress: number) => void) =>
  pickAndUploadImage("groupImage", [1, 1], onProgress);
