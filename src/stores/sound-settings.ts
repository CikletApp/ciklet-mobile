import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { SoundCategory } from "@/lib/sound-catalog";

/**
 * Uygulama sesi tercihleri — web `hooks/use-sound-settings` ile aynı alanlar.
 *
 * Ses motoru (lib/sounds) bu store'u React dışından `getState()` ile okur;
 * ses çalmak için hiçbir bileşenin açık olması gerekmez. Bildirim izni ve
 * push sesi ayrı (`preferences.notificationSounds`); burası uygulama içinde
 * çalan seslerin anahtarı, seviyesi ve kategorileri.
 */
const STORAGE_KEY = "ciklet.sound-settings";

interface SoundSettingsValues {
  /** Ana anahtar — kapalıysa hiçbir uygulama sesi çalmaz. */
  enabled: boolean;
  /** Ana seviye (0..1). Kataloğdaki taban seviyeyle çarpılır. */
  masterVolume: number;
  /** Kategori bazlı kapatma (ör. yalnızca aktivite seslerini sustur). */
  mutedCategories: SoundCategory[];
}

interface SoundSettingsState extends SoundSettingsValues {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setCategoryMuted: (category: SoundCategory, muted: boolean) => void;
}

const defaults: SoundSettingsValues = {
  enabled: true,
  masterVolume: 1,
  mutedCategories: [],
};

function persist(state: SoundSettingsValues) {
  const values: SoundSettingsValues = {
    enabled: state.enabled,
    masterVolume: state.masterVolume,
    mutedCategories: state.mutedCategories,
  };
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(values)).catch(() => undefined);
}

export const useSoundSettings = create<SoundSettingsState>((set, get) => ({
  ...defaults,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<SoundSettingsValues>) : {};
      set({
        enabled: typeof saved.enabled === "boolean" ? saved.enabled : defaults.enabled,
        masterVolume:
          typeof saved.masterVolume === "number" && Number.isFinite(saved.masterVolume)
            ? Math.min(1, Math.max(0, saved.masterVolume))
            : defaults.masterVolume,
        mutedCategories: Array.isArray(saved.mutedCategories) ? saved.mutedCategories : [],
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setEnabled: (enabled) => {
    set({ enabled });
    persist(get());
  },
  setMasterVolume: (volume) => {
    set({ masterVolume: Math.min(1, Math.max(0, volume)) });
    persist(get());
  },
  setCategoryMuted: (category, muted) => {
    const current = get().mutedCategories;
    set({
      mutedCategories: muted
        ? current.includes(category)
          ? current
          : [...current, category]
        : current.filter((item) => item !== category),
    });
    persist(get());
  },
}));
