import { create } from "zustand";
import type { OwnProfile } from "@ciklet/embedded-activities-sdk/types";

import * as apiClient from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { SESSION_REFRESH_LEEWAY_MS } from "@/lib/config";

/**
 * Oturum durumu — uygulamanın tek kimlik kaynağı.
 *
 * `status` üç değerden birini alır:
 *  - `loading`   açılışta güvenli depo okunuyor (splash görünür)
 *  - `signedOut` giriş ekranı
 *  - `signedIn`  uygulama kabuğu
 *
 * Rota koruması bu değere bakar (`app/_layout.tsx` içindeki `Stack.Protected`).
 */
type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  profile: OwnProfile | null;

  /** Açılışta bir kez: depodan oturumu yükler, gerekiyorsa tazeler. */
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Profil düzenlendikten sonra kabuktaki avatar/ad'ı günceller. */
  setProfile: (profile: OwnProfile) => void;
  /** Token süresi dolmaya yaklaştıysa yeniler. Ön plana dönüşte çağrılır. */
  ensureFreshSession: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  profile: null,

  bootstrap: async () => {
    const session = await apiClient.getSession();
    if (!session) {
      set({ status: "signedOut", profile: null });
      return;
    }

    // Süresi dolmuş/dolmak üzere olan token'ı önce yenile; taze token varken
    // gereksiz ağ turu atma.
    if (isExpiringSoon(session.expiresAt)) {
      const ok = await apiClient.refreshSession();
      if (!ok) {
        set({ status: "signedOut", profile: null });
        return;
      }
    }

    try {
      const profile = await apiClient.api<OwnProfile>(endpoints.currentProfile);
      set({ status: "signedIn", profile });
    } catch (err) {
      // 401 ise client.ts zaten oturumu düşürdü. Ağ hatasıysa oturumu
      // KORU — çevrimdışı açılışta kullanıcıyı giriş ekranına atmak yanlış
      // olur; ekranlar cache'ten çalışabilir.
      if (err instanceof apiClient.ApiError && err.isNetwork) {
        set({ status: "signedIn", profile: null });
      } else {
        set({ status: "signedOut", profile: null });
      }
    }
  },

  login: async (username, password) => {
    const res = await apiClient.login({ username, password });
    set({ status: "signedIn", profile: res.profile });
  },

  logout: async () => {
    await apiClient.logout();
    set({ status: "signedOut", profile: null });
  },

  setProfile: (profile) => set({ profile }),

  ensureFreshSession: async () => {
    if (get().status !== "signedIn") return;
    const session = await apiClient.getSession();
    if (session && isExpiringSoon(session.expiresAt)) {
      await apiClient.refreshSession();
    }
  },
}));

/**
 * Süre dolmadan önce yenile. Geçersiz/eksik tarih "hemen yenile" sayılır —
 * eski sürümden taşınan oturumlarda `expiresAt` bilinmiyor olabilir.
 */
function isExpiringSoon(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true;
  return expiry - Date.now() < SESSION_REFRESH_LEEWAY_MS;
}

/**
 * `client.ts` bir 401'i kurtaramadığında (yenileme de reddedildi) burayı
 * bilgilendirir. Modül yüklenirken bir kez kaydedilir; kaydı kaldırmak
 * gerekmez çünkü store uygulama ömrü boyunca yaşar.
 */
apiClient.onSessionExpired(() => {
  useAuth.setState({ status: "signedOut", profile: null });
});
