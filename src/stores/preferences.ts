import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

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
