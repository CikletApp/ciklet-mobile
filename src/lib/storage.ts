import * as SecureStore from "expo-secure-store";

/**
 * Oturum, cihazın güvenli deposunda (iOS Keychain / Android Keystore) yaşar.
 *
 * Üç alan da tek bir JSON kaydında tutulur: eskiden ayrı anahtarlardaydılar
 * ve kısmi yazma (token yazıldı, cookieName yazılamadı) tutarsız bir oturum
 * bırakabiliyordu. Tek kayıt, yazmayı atomik yapar.
 */

const SESSION_KEY = "ciklet.session";

/** Eski sürümlerden kalan ayrı anahtarlar — bir kez okunup taşınır. */
const LEGACY_KEYS = {
  token: "ciklet.sessionToken",
  cookieName: "ciklet.cookieName",
} as const;

export interface StoredSession {
  /** NextAuth JWE — `Cookie: <cookieName>=<token>` olarak gönderilir. */
  token: string;
  /** Ortama göre değişir: prod'da `__Secure-` önekli. */
  cookieName: string;
  /** ISO tarih. Yaklaşınca kayan yenileme tetiklenir. */
  expiresAt: string;
}

function isValid(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<StoredSession>;
  return typeof s.token === "string" && typeof s.cookieName === "string";
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    } catch {
      /* Bozuk kayıt — aşağıda temizlenir. */
    }
    await clearSession();
    return null;
  }

  return migrateLegacySession();
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(LEGACY_KEYS.token).catch(() => {}),
    SecureStore.deleteItemAsync(LEGACY_KEYS.cookieName).catch(() => {}),
  ]);
}

/**
 * İlk iskeletin ayrı anahtarlı biçimini yeni kayda taşır — mevcut
 * kurulumlardaki kullanıcılar güncellemeden sonra yeniden giriş yapmasın.
 * Son kullanma tarihi bilinmediği için yenilemeyi hemen tetikleyecek şekilde
 * geçmişe ayarlanır; geçersizse zaten 401'den düşer.
 */
async function migrateLegacySession(): Promise<StoredSession | null> {
  const [token, cookieName] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_KEYS.token).catch(() => null),
    SecureStore.getItemAsync(LEGACY_KEYS.cookieName).catch(() => null),
  ]);
  if (!token || !cookieName) return null;

  const migrated: StoredSession = {
    token,
    cookieName,
    expiresAt: new Date(0).toISOString(),
  };
  await saveSession(migrated);
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_KEYS.token).catch(() => {}),
    SecureStore.deleteItemAsync(LEGACY_KEYS.cookieName).catch(() => {}),
  ]);
  return migrated;
}
