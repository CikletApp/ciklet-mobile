import * as SecureStore from "expo-secure-store";

/** Oturum token'ı cihazın güvenli deposunda (Keychain / Keystore) yaşar. */
const KEYS = {
  sessionToken: "ciklet.sessionToken",
  cookieName: "ciklet.cookieName",
} as const;

export async function saveSession(token: string, cookieName: string) {
  await SecureStore.setItemAsync(KEYS.sessionToken, token);
  await SecureStore.setItemAsync(KEYS.cookieName, cookieName);
}

export async function loadSession(): Promise<{
  token: string;
  cookieName: string;
} | null> {
  const token = await SecureStore.getItemAsync(KEYS.sessionToken);
  const cookieName = await SecureStore.getItemAsync(KEYS.cookieName);
  if (!token || !cookieName) return null;
  return { token, cookieName };
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(KEYS.sessionToken);
  await SecureStore.deleteItemAsync(KEYS.cookieName);
}
