/**
 * Yüklemenin saf parçaları (RN bağımlılığı yok; scripts/verify-uploads.mjs).
 */

/**
 * UploadThing rota adresi — HER çağrıda o anki global `URL` ile kurulur.
 *
 * Neden modül düzeyinde sabit değil: `@uploadthing/shared`
 * `resolveMaybeUrlArg` adresi `maybeUrl instanceof URL` ile denetliyor;
 * tutmazsa `getFullApiUrl` tabanı `window.location.origin` ile hesaplıyor.
 * RN'de `window` var ama `window.location` yok → "Cannot read property
 * 'origin' of undefined". Uygulama açılırken `_layout` içindeki
 * `setupLiveKit()` → `registerGlobals()` → `setupURLPolyfill()` global
 * `URL`'i react-native-url-polyfill sınıfıyla DEĞİŞTİRİYOR; modül
 * yüklenirken (Expo'nun `URL`'iyle) kurulmuş nesne artık `instanceof URL`
 * değil. Çağrı anında kurulan nesne her zaman güncel sınıftandır.
 */
export function uploadRouteUrl(apiBase: string, UrlCtor: typeof URL = globalThis.URL): URL {
  return new UrlCtor("/api/uploadthing", apiBase);
}

const TOO_LARGE_CODES = new Set(["TOO_LARGE", "FILE_LIMIT_EXCEEDED"]);

/**
 * Yükleme hatasını kullanıcıya gösterilecek Türkçe cümleye çevirir. Ham
 * kütüphane iletileri ("XHR failed 400", "Cannot read property …") asla
 * ekrana çıkmaz; kendi ürettiğimiz Türkçe hatalar (`UserFacingUploadError`)
 * olduğu gibi geçer.
 */
export function uploadErrorMessage(err: unknown): string {
  if (err instanceof UserFacingUploadError) return err.message;
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  if (typeof code === "string" && TOO_LARGE_CODES.has(code)) return "Dosya bu plan için çok büyük.";
  if (code === "FORBIDDEN") return "Bu dosyayı yükleme iznin yok.";
  if (code === "TOO_MANY_FILES") return "Aynı anda bu kadar dosya yüklenemez.";
  return "Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene.";
}

/** Doğrudan kullanıcıya gösterilmek üzere yazılmış (Türkçe) yükleme hatası. */
export class UserFacingUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingUploadError";
  }
}
