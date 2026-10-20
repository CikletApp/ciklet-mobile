import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { ReducedMotionPreference } from "@/lib/accessibility";
import type { LocalePreference } from "@/lib/i18n";

const STORAGE_KEY = "ciklet.preferences";

export type InputMode = "vad" | "ptt";
export type ChatDensity = "comfortable" | "compact";
/** Medya otomatik indirme: her şey / yalnızca sesli mesaj / hiçbiri (bkz. lib/media-cache). */
export type AutoDownload = "all" | "voice" | "none";

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
  /** Wi-Fi'da cihaza otomatik indirilen medya (WhatsApp: Depolama ve veriler). */
  autoDownloadWifi: AutoDownload;
  /** Mobil veride otomatik indirilen medya. */
  autoDownloadCellular: AutoDownload;
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
  autoDownloadWifi: "all",
  autoDownloadCellular: "voice",
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
    autoDownloadWifi: state.autoDownloadWifi,
    autoDownloadCellular: state.autoDownloadCellular,
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
