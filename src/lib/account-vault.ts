import * as SecureStore from "expo-secure-store";

import type { StoredSession } from "@/lib/storage";

/**
 * Hesap değiştirici kasası — bu cihazda kayıtlı hesaplar (Discord "Hesap
 * Değiştir", en çok 5).
 *
 * İki tür kayıt, ikisi de cihazın güvenli deposunda (iOS Keychain /
 * Android Keystore):
 *   - `ciklet.accounts`: liste — yalnızca kimlik, kullanıcı adı, görünen ad,
 *     avatar (belirteç YOK);
 *   - `ciklet.account.<id>`: etkin OLMAYAN hesabın oturumu (NextAuth JWE).
 *     Etkin hesabın oturumu her zamanki yerinde (lib/storage) durur; geçişte
 *     yer değiştirirler.
 * Oturum kaydı ayrı anahtarda: Android'de tek SecureStore değeri ~2 KB'ı
 * aşmamalı.
 */

export const MAX_ACCOUNTS = 5;

const INDEX_KEY = "ciklet.accounts";

export interface SavedAccount {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

function tokenKey(id: string): string {
  // SecureStore anahtarı yalnızca [A-Za-z0-9._-] kabul eder.
  return `ciklet.account.${id.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

function isAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== "object") return false;
  const a = value as Partial<SavedAccount>;
  return typeof a.id === "string" && typeof a.username === "string";
}

export async function listAccounts(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAccount).slice(0, MAX_ACCOUNTS) : [];
  } catch {
    return [];
  }
}

async function writeIndex(accounts: SavedAccount[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
}

/** Hesabı listeye ekler ya da bilgisini tazeler (sıra korunur). */
export async function upsertAccount(account: SavedAccount): Promise<void> {
  const accounts = await listAccounts();
  const entry: SavedAccount = {
    id: account.id,
    username: account.username,
    name: account.name ?? null,
    imageUrl: account.imageUrl ?? null,
  };
  const index = accounts.findIndex((a) => a.id === account.id);
  if (index >= 0) {
    const prev = accounts[index];
    if (prev.username === entry.username && prev.name === entry.name && prev.imageUrl === entry.imageUrl) return;
    accounts[index] = entry;
  } else {
    accounts.push(entry);
  }
  await writeIndex(accounts);
}

/** Listeden çıkarır ve (varsa) kayıtlı oturumunu siler. */
export async function removeAccount(id: string): Promise<void> {
  const accounts = await listAccounts();
  await writeIndex(accounts.filter((a) => a.id !== id));
  await SecureStore.deleteItemAsync(tokenKey(id)).catch(() => {});
}

export async function saveAccountSession(id: string, session: StoredSession): Promise<void> {
  // Kısıtlı (telefon doğrulaması bekleyen) oturum saklanmaz.
  const { phonePending: _p, ...rest } = session;
  await SecureStore.setItemAsync(tokenKey(id), JSON.stringify(rest));
}

export async function loadAccountSession(id: string): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(tokenKey(id)).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== "string" || typeof parsed.cookieName !== "string") return null;
    return { token: parsed.token, cookieName: parsed.cookieName, expiresAt: parsed.expiresAt ?? new Date(0).toISOString() };
  } catch {
    return null;
  }
}

export async function deleteAccountSession(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(id)).catch(() => {});
}

/** Oturumu kayıtlı mı (değilse "yeniden giriş gerekli" gösterilir). */
export async function hasAccountSession(id: string): Promise<boolean> {
  return (await loadAccountSession(id)) !== null;
}
