import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  DEFAULT_THEME,
  setActiveTheme,
  themes,
  type ThemeId,
} from "@/theme/tokens";

const THEME_KEY = "ciklet.theme";

export const THEME_LABELS: Record<ThemeId, string> = {
  light: "Aydınlık",
  mist: "Sis",
  night: "Gece",
  oled: "Zifir",
};

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (themeId: ThemeId) => Promise<void>;
}

function isThemeId(value: string | null): value is ThemeId {
  return Boolean(value && value in themes);
}

export const useTheme = create<ThemeState>((set) => ({
  themeId: DEFAULT_THEME,
  hydrated: false,

  hydrate: async () => {
    const stored = await AsyncStorage.getItem(THEME_KEY).catch(() => null);
    const themeId = isThemeId(stored) ? stored : DEFAULT_THEME;
    setActiveTheme(themeId);
    set({ themeId, hydrated: true });
  },

  setTheme: async (themeId) => {
    // Önce bellekte uygula; dokunuşun görsel karşılığı disk turunu beklemez.
    setActiveTheme(themeId);
    set({ themeId });
    await AsyncStorage.setItem(THEME_KEY, themeId);
  },
}));
