import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { ReducedMotionPreference } from "@/lib/accessibility";
import type { LocalePreference } from "@/lib/i18n";

const STORAGE_KEY = "ciklet.preferences";

export type InputMode = "vad" | "ptt";
export type ChatDensity = "comfortable" | "compact";

interface PreferenceValues {
  linkPreviews: boolean;
  bigEmoji: boolean;
  chatDensity: ChatDensity;
  inputMode: InputMode;
  inputVolume: number;
  outputVolume: number;
  notificationsEnabled: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  friendNotifications: boolean;
  notificationSounds: boolean;
  /** Yalnız bu cihazdaki DM sırası; sunucu tarafı kişisel pin alanı sunmuyor. */
  pinnedDirectIds: string[];
  /**
   * Sohbet arka planı — Mentol özelliği. Görsel uygulamanın belge dizinine
   * kopyalanır (galeri adresi kalıcı değil); yalnızca bu cihazda geçerli.
   */
  chatBackgroundUri: string | null;
  /** Arka planın üstüne binen zemin rengi katmanının saydamlığı (0–0.8). */
  chatBackgroundDim: number;
  /** Hareket azaltma: sistem / açık / kapalı (bkz. lib/accessibility). */
  reduceMotion: ReducedMotionPreference;
  /** Arayüz dili; "system" cihaz dilini izler (bkz. lib/i18n). */
  locale: LocalePreference;
  /**
   * Sesli mesajlar her ağda arka planda cihaza iner (WhatsApp: Depolama ve
   * veriler; bkz. lib/media-cache). Dokununca beklemeden, ağsız da çalar.
   */
  autoDownloadVoice: boolean;
  /** Video ve dosyalar Wi-Fi'da otomatik iner. */
  autoDownloadMediaWifi: boolean;
  /** Video ve dosyalar mobil veride otomatik iner. */
  autoDownloadMediaCellular: boolean;
  /**
   * "Dinlediğimi paylaş" — telefonda çalan müzik/video rich presence olarak
   * arkadaşlara gider (Android, Bildirim erişimi gerekir; bkz.
   * features/presence/media-presence). Varsayılan kapalı: izin akışı
   * kullanıcı açınca başlar.
   */
  shareMediaActivity: boolean;
  /** Müzik uygulamaları (Spotify, YouTube Music…) — web "Müzik" kategorisi. */
  shareMusicActivity: boolean;
  /** Video (YouTube) — web "Video" kategorisi. */
  shareVideoActivity: boolean;
}

interface PreferenceState extends PreferenceValues {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: <K extends keyof PreferenceValues>(key: K, value: PreferenceValues[K]) => void;
}

const defaults: PreferenceValues = {
  linkPreviews: true,
  bigEmoji: true,
  chatDensity: "comfortable",
  inputMode: "vad",
  inputVolume: 100,
  outputVolume: 100,
  notificationsEnabled: true,
  messageNotifications: true,
  callNotifications: true,
  friendNotifications: true,
  notificationSounds: true,
  pinnedDirectIds: [],
  chatBackgroundUri: null,
  chatBackgroundDim: 0.35,
  reduceMotion: "system",
  locale: "system",
  autoDownloadVoice: true,
  autoDownloadMediaWifi: true,
  autoDownloadMediaCellular: false,
  shareMediaActivity: false,
  shareMusicActivity: true,
  shareVideoActivity: true,
};

function persistedValues(state: PreferenceState): PreferenceValues {
  return {
    linkPreviews: state.linkPreviews,
    bigEmoji: state.bigEmoji,
    chatDensity: state.chatDensity,
    inputMode: state.inputMode,
    inputVolume: state.inputVolume,
    outputVolume: state.outputVolume,
    notificationsEnabled: state.notificationsEnabled,
    messageNotifications: state.messageNotifications,
    callNotifications: state.callNotifications,
    friendNotifications: state.friendNotifications,
    notificationSounds: state.notificationSounds,
    pinnedDirectIds: state.pinnedDirectIds,
    chatBackgroundUri: state.chatBackgroundUri,
    chatBackgroundDim: state.chatBackgroundDim,
    reduceMotion: state.reduceMotion,
    locale: state.locale,
    autoDownloadVoice: state.autoDownloadVoice,
    autoDownloadMediaWifi: state.autoDownloadMediaWifi,
    autoDownloadMediaCellular: state.autoDownloadMediaCellular,
    shareMediaActivity: state.shareMediaActivity,
    shareMusicActivity: state.shareMusicActivity,
    shareVideoActivity: state.shareVideoActivity,
  };
}

export const usePreferences = create<PreferenceState>((set, get) => ({
  ...defaults,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<PreferenceValues>) : {};
      set({ ...defaults, ...saved, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setPreference: (key, value) => {
    set({ [key]: value } as Pick<PreferenceState, typeof key>);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistedValues(get())));
  },
}));
