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
