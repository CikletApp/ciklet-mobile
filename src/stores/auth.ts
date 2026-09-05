import { create } from "zustand";

import * as apiClient from "@/api/client";
import { acceptEula as postEulaAcceptance } from "@/api/auth";
import { endpoints } from "@/api/endpoints";
import type { CurrentProfile, SessionProfile } from "@/api/types";
import { clearPersistedCache } from "@/api/query-client";
import { SESSION_REFRESH_LEEWAY_MS } from "@/lib/config";
import { unregisterPushToken } from "@/lib/notifications";

/**
 * Oturum durumu — uygulamanın tek kimlik kaynağı.
 *
 * `status` dört değerden birini alır:
 *  - `loading`   açılışta güvenli depo okunuyor (splash görünür)
 *  - `signedOut` giriş ekranı
 *  - `pendingEula` kimlik doğrulandı ama Son Kullanıcı Sözleşmesi kabul
 *    edilmedi — yalnızca sözleşme ekranı görünür
 *  - `signedIn`  uygulama kabuğu
 *
 * `pendingEula` neden ayrı bir durum: web'de bu kapı SUNUCUDA duruyor
 * (`/redirect` sayfası profili okuyup sözleşmeyi kabul etmemiş kullanıcıyı
 * uygulamaya hiç sokmuyor). Mobilde eşdeğer bir sunucu adımı yok; kapı
 * `signedIn` içinde bir bayrak olsaydı, korumayı uygulamayı unutan ilk ekran
 * sözleşmeyi sessizce atlatırdı. Ayrı bir durum, rota korumasının kendisini
 * kapı yapar.
 *
 * Rota koruması bu değere bakar (`app/_layout.tsx` içindeki `Stack.Protected`).
 */
type AuthStatus = "loading" | "signedOut" | "pendingEula" | "signedIn";

interface AuthState {
  status: AuthStatus;
  profile: SessionProfile | null;

  /** Açılışta bir kez: depodan oturumu yükler, gerekiyorsa tazeler. */
  bootstrap: () => Promise<void>;
  login: (username: string, password: string, totp?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Profil düzenlendikten sonra kabuktaki avatar/ad'ı günceller. */
  setProfile: (profile: SessionProfile) => void;
  /** Sözleşmeyi kabul eder ve uygulamayı açar. */
  acceptEula: () => Promise<void>;
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
      const profile = await apiClient.api<CurrentProfile>(endpoints.currentProfile);
      set({
        status: profile.eulaAccepted === false ? "pendingEula" : "signedIn",
        profile,
      });
    } catch (err) {
      // 401 ise client.ts zaten oturumu düşürdü. Ağ hatasıysa oturumu
      // KORU — çevrimdışı açılışta kullanıcıyı giriş ekranına atmak yanlış
      // olur; ekranlar cache'ten çalışabilir.
      //
      // Sözleşme durumu bu yolda bilinmiyor: çevrimdışı bir kullanıcıyı
      // sözleşme ekranında kilitlemek, kabul isteğini gönderemeyeceği için
      // uygulamayı tamamen kullanılamaz yapardı. Kapı, ağ geri geldiğindeki
      // ilk `bootstrap`/`login` turunda uygulanır.
      if (err instanceof apiClient.ApiError && err.isNetwork) {
        set({ status: "signedIn", profile: null });
      } else {
        set({ status: "signedOut", profile: null });
      }
    }
  },

  login: async (username, password, totp) => {
    const res = await apiClient.login({ username, password, totp });
    set({
      // Eski bir sunucu bu alanı hiç göndermeyebilir; `undefined` "bilinmiyor"
      // demektir ve kullanıcıyı sözleşme ekranında tutmak için gerekçe değil.
      status: res.profile.eulaAccepted === false ? "pendingEula" : "signedIn",
      profile: res.profile,
    });
  },

  logout: async () => {
    // Token'ı ÖNCE düşür: çıkıştan sonra kimlik başlığı kalmaz.
    await unregisterPushToken().catch(() => {});
    await apiClient.logout();
    // Diskteki cache de silinmeli; aksi halde bir sonraki kullanıcı
    // uygulamayı açtığında bir öncekinin sohbet listesini görür.
    await clearPersistedCache().catch(() => {});
    set({ status: "signedOut", profile: null });
  },

  setProfile: (profile) => set({ profile }),

  acceptEula: async () => {
    await postEulaAcceptance();
    set((state) => ({
      status: "signedIn",
      profile: state.profile ? { ...state.profile, eulaAccepted: true } : state.profile,
    }));
  },

  ensureFreshSession: async () => {
    if (get().status === "signedOut" || get().status === "loading") return;
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
  void clearPersistedCache().catch(() => {});
  useAuth.setState({ status: "signedOut", profile: null });
});
