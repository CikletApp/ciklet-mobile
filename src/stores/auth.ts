import { create } from "zustand";
import type { OwnProfile } from "@ciklet/embedded-activities-sdk/types";

import * as apiClient from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { clearPersistedCache } from "@/api/query-client";
import { SESSION_REFRESH_LEEWAY_MS } from "@/lib/config";
import { clearNativeCookies } from "@/lib/cookies";
import { unregisterPushToken } from "@/lib/notifications";

/**
 * Oturum durumu — uygulamanın tek kimlik kaynağı.
 *
 * `status` şu değerlerden birini alır:
 *  - `loading`      açılışta güvenli depo okunuyor (splash görünür)
 *  - `signedOut`    giriş ekranı
 *  - `eulaPending`  giriş yapıldı ama Son Kullanıcı Sözleşmesi kabul
 *                   edilmedi: yalnızca sözleşme ekranı
 *  - `phonePending` giriş yapıldı ama telefon doğrulanmadı: yalnızca
 *                   doğrulama ekranı (sunucu da kısıtlı token veriyor)
 *  - `banned`       hesap ya da cihaz banlı: oturum yok, yalnızca ban
 *                   ekranı (web: /banned)
 *  - `signedIn`     uygulama kabuğu
 *
 * Rota koruması bu değere bakar (`app/_layout.tsx` içindeki `Stack.Protected`).
 */
type AuthStatus = "loading" | "signedOut" | "eulaPending" | "phonePending" | "banned" | "signedIn";

/** `/api/current-profile` sözleşme bayrağını da taşıyor; SDK tipinde yok. */
type SessionProfile = OwnProfile & { eulaAccepted?: boolean };

/**
 * Girişten sonraki kapılar — web `/redirect` ile AYNI sıra: önce sözleşme,
 * sonra telefon, sonra uygulama. Bayrağı hiç göndermeyen (eski) sunucu
 * sözleşme kapısına takılmaz; yalnızca açıkça `false` bekletir.
 */
function gateStatus(profile: SessionProfile | null, phonePending: boolean): AuthStatus {
  if (profile?.eulaAccepted === false) return "eulaPending";
  if (phonePending) return "phonePending";
  return "signedIn";
}

interface AuthState {
  status: AuthStatus;
  profile: OwnProfile | null;
  /** `banned` durumunda ekranda gösterilecek gerekçe ve süre. */
  ban: apiClient.BanNotice | null;

  /** Açılışta bir kez: depodan oturumu yükler, gerekiyorsa tazeler. */
  bootstrap: () => Promise<void>;
  login: (username: string, password: string, totp?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Sözleşmeyi kabul eder ve sıradaki kapıya (telefon ya da uygulama) geçer. */
  acceptEula: () => Promise<void>;
  /** Ban ekranını açar (giriş ya da yenileme `account_banned` döndü). */
  showBan: (notice: apiClient.BanNotice) => void;
  /** Ban ekranından giriş ekranına döner. */
  dismissBan: () => void;
  /**
   * Telefon doğrulandıktan sonra kısıtlı token'ı tam oturumla değiştirir.
   * Sunucu hâlâ "bekliyor" diyorsa false döner, durum değişmez.
   */
  completePhoneVerification: () => Promise<boolean>;
  /** Profil düzenlendikten sonra kabuktaki avatar/ad'ı günceller. */
  setProfile: (profile: OwnProfile) => void;
  /** Token süresi dolmaya yaklaştıysa yeniler. Ön plana dönüşte çağrılır. */
  ensureFreshSession: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "loading",
  profile: null,
  ban: null,

  bootstrap: async () => {
    // Önceki sürümün WebView'ının kavanoza bıraktığı çerezler kimlik
    // başlığını eziyordu; açılışta temizlenir (bkz. lib/cookies.ts).
    await clearNativeCookies();
    const session = await apiClient.getSession();
    if (!session) {
      set({ status: "signedOut", profile: null });
      return;
    }

    // Doğrulama yarıda kaldı (kullanıcı Telegram'a geçerken sistem uygulamayı
    // kapatmış olabilir): kaldığı ekrana dön. Süre yenilemesi burada
    // denenmez — sunucu bekleyen oturumu yenilemiyor, bu da kullanıcıyı
    // çıkışa düşürürdü. Profil kısıtlı oturumla da okunabiliyor; sözleşme
    // kapısı için gerekli. 401'de client.ts çıkış yaptırır.
    if (session.phonePending) {
      try {
        const profile = await apiClient.api<SessionProfile>(endpoints.currentProfile);
        set({ status: gateStatus(profile, true), profile });
      } catch (err) {
        const offline = err instanceof apiClient.ApiError && err.isNetwork;
        set({ status: offline ? "phonePending" : "signedOut", profile: null });
      }
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
      const profile = await apiClient.api<SessionProfile>(endpoints.currentProfile);
      set({ status: gateStatus(profile, false), profile });
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

  login: async (username, password, totp) => {
    const res = await apiClient.login({ username, password, ...(totp ? { totp } : {}) });
    // Giriş yanıtındaki profil sözleşme bayrağını taşımıyor; kapı kararı için
    // tam profil okunur. Okunamazsa (ağ) kapı atlanır, açılışta yeniden bakılır.
    const current = await apiClient.api<SessionProfile>(endpoints.currentProfile).catch(() => null);
    // Profil okunamadıysa sunucunun giriş yanıtındaki bayrak yedek.
    const gateProfile = current ?? (res.eulaRequired ? { ...res.profile, eulaAccepted: false } : null);
    set({ status: gateStatus(gateProfile, res.phoneVerificationRequired === true), profile: current ?? res.profile });
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

  acceptEula: async () => {
    await apiClient.api(endpoints.eula, { method: "POST" });
    const session = await apiClient.getSession();
    // Token hâlâ `eulaPending` claim'i taşıyor; sunucu onu yenilemede
    // düşürüyor. Telefon da bekliyorsa yenileme 403 döner — o zaman iki
    // claim'li token doğrulama ekranında yeterli, doğrulanınca zaten
    // yenileniyor. Eski sunucuda claim yok; yenileme yalnızca süre uzatır.
    if (!session?.phonePending) await apiClient.refreshSession();
    const current = get().profile;
    const profile: SessionProfile | null = current ? { ...current, eulaAccepted: true } : null;
    set({ status: gateStatus(null, session?.phonePending === true), profile });
  },

  completePhoneVerification: async () => {
    // /refresh bekleyen hesaba 403 döner; doğrulandıysa işaretsiz token verir
    // ve client.ts onu `phonePending` olmadan kaydeder.
    if (!(await apiClient.refreshSession())) return false;
    const profile = await apiClient.api<SessionProfile>(endpoints.currentProfile).catch(() => null);
    set({ status: gateStatus(profile, false), profile });
    return true;
  },

  showBan: (notice) => set({ status: "banned", profile: null, ban: notice }),

  dismissBan: () => set({ status: "signedOut", ban: null }),

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
apiClient.onAccountBanned((notice) => {
  void clearPersistedCache().catch(() => {});
  useAuth.getState().showBan(notice);
});

apiClient.onSessionExpired(() => {
  void clearPersistedCache().catch(() => {});
  useAuth.setState({ status: "signedOut", profile: null });
});
