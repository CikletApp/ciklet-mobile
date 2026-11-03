import * as apiClient from "@/api/client";
import { clearPersistedCache } from "@/api/query-client";
import { stopListenAlong } from "@/features/spotify/listen-along";
import {
  MAX_ACCOUNTS,
  deleteAccountSession,
  listAccounts,
  loadAccountSession,
  removeAccount,
  saveAccountSession,
  type SavedAccount,
} from "@/lib/account-vault";
import { unregisterPushToken } from "@/lib/notifications";
import { stopGateway } from "@/realtime/gateway";
import { hangUpCall } from "@/realtime/use-call-events";
import { useActiveChat } from "@/stores/active-chat";
import { useActivitySession } from "@/stores/activity";
import { resetAccountScopedStores, useAuth } from "@/stores/auth";
import { usePresenceStore } from "@/stores/presence";
import { useTypingStore } from "@/stores/typing";
import { useVoice } from "@/stores/voice";

/**
 * Hesap değiştirici (Discord "Hesap Değiştir") — web
 * lib/account-switcher ile aynı davranış.
 *
 * ── Hesaplar arası sızıntı neden olamaz
 * Geçişte durum önce `loading` yapılır: kök düzen bütün uygulama ağacını
 * söker (sohbet ekranları, sesli bağlantı, aktivite, çağrı katmanı,
 * gerçek zamanlı sağlayıcı). Ardından eski hesabın izleri silinir —
 * ağ geçidi kapanır, push belirteci eski hesaptan kaldırılır, sorgu
 * önbelleği + yerel SQLite + medya önbelleği silinir, bellek içi depolar
 * sıfırlanır. Yeni hesabın oturumu ancak bundan SONRA etkin olur ve
 * uygulama sıfırdan açılır (bootstrap). Mobil uygulama telefonun cihaz
 * tercihlerini (tema, ses) korur — web'deki gibi.
 *
 * Kayıtlı oturum geçişten önce sunucuda doğrulanır (web ile aynı kurallar);
 * düşmüşse "yeniden giriş gerekli".
 */

export { MAX_ACCOUNTS };

export interface SwitcherAccount extends SavedAccount {
  current: boolean;
  needsLogin: boolean;
}

export async function listSwitcherAccounts(): Promise<SwitcherAccount[]> {
  const currentId = useAuth.getState().profile?.id ?? null;
  const accounts = await listAccounts();
  const rows = await Promise.all(
    accounts.map(async (account) => ({
      ...account,
      current: account.id === currentId,
      needsLogin: account.id === currentId ? false : (await loadAccountSession(account.id)) === null,
    })),
  );
  // Etkin hesap en üstte (web ile aynı).
  return rows.sort((a, b) => Number(b.current) - Number(a.current));
}

/** Eski hesabın bu cihazdaki bütün izlerini siler (oturumu SİLMEZ). */
async function teardownCurrentAccount(): Promise<void> {
  await stopListenAlong().catch(() => {});
  hangUpCall();
  useVoice.getState().leave();
  useActivitySession.getState().leave();
  stopGateway();
  await unregisterPushToken().catch(() => {});
  await clearPersistedCache().catch(() => {});
  usePresenceStore.getState().reset();
  useTypingStore.getState().clear();
  useActiveChat.getState().setActive(null);
  resetAccountScopedStores();
}

/** Etkin hesabın oturumunu kasaya koyar (geçişten / eklemeden önce). */
async function stashCurrent(): Promise<string | null> {
  const profile = useAuth.getState().profile;
  const session = await apiClient.getSession();
  if (!profile?.id || !session || session.phonePending) return null;
  await saveAccountSession(profile.id, session);
  return profile.id;
}

export type SwitchResult = "ok" | "needsLogin" | "failed";

export async function switchToAccount(id: string): Promise<SwitchResult> {
  const auth = useAuth.getState();
  if (auth.profile?.id === id && auth.status === "signedIn") return "ok";

  const stored = await loadAccountSession(id);
  if (!stored) return "needsLogin";
  const fresh = await apiClient.validateStoredSession(stored);
  if (fresh === "invalid") {
    await deleteAccountSession(id);
    return "needsLogin";
  }
  if (fresh === "network") return "failed";

  await stashCurrent();
  useAuth.setState({ status: "loading", profile: null, addingFrom: null });
  await teardownCurrentAccount();
  await apiClient.adoptSession(fresh);
  // Etkin hesabın oturumu artık her zamanki yerinde; kasadaki kopya silinir.
  await deleteAccountSession(id);
  await useAuth.getState().bootstrap();
  return "ok";
}

export type AddResult = "ok" | "limit";

/**
 * "Hesap ekle": etkin hesap kasaya, uygulama giriş ekranına (oturumsuz).
 * Giriş normal kapılardan geçer (iki adımlı doğrulama dahil). Vazgeçilirse
 * {@link cancelAddAccount} önceki hesaba döner.
 */
export async function beginAddAccount(options: { reauth?: boolean } = {}): Promise<AddResult> {
  const accounts = await listAccounts();
  // Oturumu düşmüş kayıtlı hesaba yeniden giriş listeyi büyütmez.
  if (!options.reauth && accounts.length >= MAX_ACCOUNTS) return "limit";
  const previous = await stashCurrent();
  useAuth.setState({ status: "loading", profile: null });
  await teardownCurrentAccount();
  // Yalnızca bu cihazdaki etkin oturum kalkar; sunucuda iptal edilmez —
  // kasadaki kopya geçerli kalmalı.
  await apiClient.logout();
  useAuth.setState({ status: "signedOut", profile: null, addingFrom: previous });
  return "ok";
}

export async function cancelAddAccount(): Promise<SwitchResult> {
  const from = useAuth.getState().addingFrom;
  if (!from) return "failed";
  const result = await switchToAccount(from);
  if (result !== "ok") useAuth.setState({ addingFrom: null });
  return result;
}

/** Kayıtlı hesabı listeden çıkarır (etkin hesap çıkarılamaz — "Çıkış Yap"). */
export async function removeSavedAccount(id: string): Promise<boolean> {
  if (useAuth.getState().profile?.id === id && useAuth.getState().status === "signedIn") return false;
  await removeAccount(id);
  return true;
}
