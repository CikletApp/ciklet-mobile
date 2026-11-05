/**
 * Hata → kullanıcıya gösterilecek metin (saf; RN bağımlılığı yok —
 * tests/user-error.test.mjs).
 *
 * Kural: ekrana YALNIZCA bizim ya da sunucunun kullanıcı için yazdığı
 * metin çıkar. Ham kütüphane/JS iletileri ("Network request failed",
 * "TypeError: …", "Call to function 'ExponentImagePicker…' has been
 * rejected", "HTTP 502", yığın izi, iç yollar, altyapı adları) asla
 * gösterilmez; onların yerine çağıranın verdiği yedek metin çıkar.
 */

/**
 * Mesajı doğrudan gösterilmek üzere yazılmış hata sınıfları. `instanceof`
 * yerine ad bakılır: bu dosya `api/client` (SecureStore) ya da
 * `lib/uploads` (yerel modüller) içe aktarmadan testte çalışabilsin.
 */
const USER_FACING_ERROR_NAMES = new Set([
  "ApiError",
  "UserFacingUploadError",
  "AutomodRegexError",
  "MicrophoneDeniedError",
  "CameraDeniedError",
]);

/**
 * Kullanıcıya gösterilmemesi gereken (teknik) metin mi? Sunucudan gelen
 * metin de buradan geçer: vekil/çerçeve hatası ham olarak sızabilir.
 */
const TECHNICAL_PATTERNS: readonly RegExp[] = [
  // Altyapı ve çerçeve adları.
  /(next\.?js|vercel|prisma|drizzle|mongo|redis|postgres|livekit|uploadthing|react[ -]?native|nginx|docker|turbopack|webpack)/i,
  /\b(expo|hermes)\b/i,
  /\bprocess\.env\b|\bEXPO_PUBLIC_\w*|\bNEXT_PUBLIC_\w*/,
  // JS çalışma zamanı hataları.
  /\b[A-Z]\w*(Error|Exception)\b/,
  /network request failed|failed to fetch|load failed|cannot read propert|undefined is not|is not a function|is not an object|unexpected token|json parse|unexpected end of|has been rejected|caused by|maximum call stack|out of memory|econn\w*|enotfound|etimedout|socket hang up/i,
  /\bnull\b|\bundefined\b|\bNaN\b|\[object \w+\]/,
  // Durum satırı ve HTML gövde.
  /^HTTP \d{3}$/,
  /^\s*</,
  // Yığın izi, iç yol, adres.
  /\n\s+at\s|\bat .+:\d+:\d+|\w+\.(tsx?|jsx?|mjs|kt|swift|java):\d+/,
  /(^|\s)\/(app|src|node_modules|opt|home|var|usr)\//,
  /[A-Z]:\\/,
  /\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b/,
];

export function isTechnicalMessage(message: string | null | undefined): boolean {
  const text = message?.trim();
  if (!text) return true;
  if (text.length > 400) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Hatanın kullanıcı metni ya da `fallback`. Yalnızca bilinen kullanıcıya
 * dönük sınıfların metni geçer (sunucu hatası `ApiError`, kendi Türkçe
 * yükleme/izin hatalarımız); o metin de teknik görünüyorsa yine yedek.
 */
export function userErrorMessage(reason: unknown, fallback: string): string {
  if (!reason || typeof reason !== "object") return fallback;
  const { name, message } = reason as { name?: unknown; message?: unknown };
  if (typeof name !== "string" || !USER_FACING_ERROR_NAMES.has(name)) return fallback;
  if (typeof message !== "string" || isTechnicalMessage(message)) return fallback;
  return message.trim();
}
