import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Cihaz kimliği ve istemci telemetrisi.
 *
 * `POST /api/mobile/auth` üç alanı okur:
 *  - `clientType` / `clientVersion` → Profile.lastClientType/Version (telemetri)
 *  - `hwid` → donanım banı kontrolü (bkz. ciklet-web lib/hwid.ts)
 *
 * hwid, cihaza özgü bir sır DEĞİLDİR; kurulum başına kalıcı bir tanımlayıcıdır.
 * Güvenli depoda tutulur ki uygulama verisi temizlenmeden hayatta kalsın ve
 * yedeklerden başka cihaza taşınmasın.
 */

const HWID_KEY = "ciklet.deviceId";

export const CLIENT_TYPE = Platform.select({
  ios: "ios",
  android: "android",
  default: "web",
});

export const CLIENT_VERSION =
  Application.nativeApplicationVersion ?? "0.0.0-dev";

let cachedDeviceId: string | null = null;

/**
 * Kurulum başına kalıcı kimlik. Platformun kendi tanımlayıcısını tercih eder
 * (uygulama silinip yeniden kurulsa da aynı kalır), yoksa rastgele UUID üretir.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await SecureStore.getItemAsync(HWID_KEY).catch(() => null);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  let id: string | null = null;
  try {
    id =
      Platform.OS === "android"
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
  } catch {
    /* Bazı ortamlarda (Expo Go, emülatör) erişilemez — UUID'ye düşülür. */
  }

  cachedDeviceId = id ?? Crypto.randomUUID();
  await SecureStore.setItemAsync(HWID_KEY, cachedDeviceId).catch(() => {});
  return cachedDeviceId;
}
