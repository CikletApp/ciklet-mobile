import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { create } from "zustand";

import {
  DEFAULT_THEME,
  THEMES,
  getActivePalette,
  setActiveTheme,
  themes,
  type CustomColors,
  type ThemeId,
  type ThemePalette,
  type ThemePreference,
} from "@/theme/tokens";
import { isThemeId, normalizeCustomColors } from "@/theme/palette";

const THEME_KEY = "ciklet.theme";
const CUSTOM_COLORS_KEY = "ciklet.theme.custom-v1";

export const THEME_LABELS = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme.label])
) as Record<ThemeId, string>;

/** Web'deki `resolveTheme` ile aynı: sistem açıksa Porselen, değilse varsayılan. */
export function resolveTheme(preference: ThemePreference): ThemeId {
  if (preference === "system") {
    return Appearance.getColorScheme() === "light" ? "light" : DEFAULT_THEME;
  }
  return isThemeId(preference) ? preference : DEFAULT_THEME;
}

interface ThemeState {
  /** Kullanıcının seçimi — "system" olabilir. */
  preference: ThemePreference;
  /** Etkin tema kimliği (sistem çözülmüş hâli). */
  themeId: ThemeId;
  /** Mentol paleti: hazır temanın üstüne yazılan renkler. */
  customColors: CustomColors;
  /** Etkin paletin açık/koyu ayrımı — durum çubuğu, blur tonu. */
  scheme: "light" | "dark";
  /**
   * Etkin paletin anlık görüntüsü. Düz nesne bekleyen yerler (navigator
   * seçenekleri) bunu okumalı, `colors` Proxy'sini DEĞİL: React Compiler
   * modül sabiti olan Proxy'ye bağlı hesabı bir kez yapıp önbelleğe alıyor
   * ve tema değişince başlık çubuğu eski renkte kalıyordu.
   */
  palette: ThemePalette;
  /**
   * Palet her değiştiğinde artar. Navigator ağacı bununla anahtarlanır:
   * yalnızca `themeId` yetmez, çünkü özel renk değişimi kimliği değiştirmez.
   */
  revision: number;
  hydrated: boolean;
  /**
   * Auth adası açık: oturum yokken (giriş, kayıt, doğrulama) kullanıcının
   * teması yerine varsayılan koyu palet çizilir — web'deki `.ciklet-auth`
   * gibi. Tercih saklanmaya devam eder; ada kapanınca geri uygulanır.
   * Açık temada lime vurgu okunmuyordu ve ekranlar web'le başka bir
   * uygulamaya aitmiş gibi görünüyordu.
   */
  authIsland: boolean;
  setAuthIsland: (active: boolean) => void;
  hydrate: () => Promise<void>;
  setTheme: (preference: ThemePreference) => Promise<void>;
  setCustomColors: (colors: CustomColors) => Promise<void>;
  /** Sistem açık/koyu değiştiğinde "system" tercihini yeniden çözer. */
  syncSystem: () => void;
}

function parsePreference(value: string | null): ThemePreference {
  if (value === "system") return "system";
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export const useTheme = create<ThemeState>((set, get) => {
  /** Paleti uygular ve türetilmiş alanları tek seferde döner. */
  const apply = (preference: ThemePreference, customColors: CustomColors, island = get().authIsland) => {
    const themeId = resolveTheme(preference);
    if (island) setActiveTheme(DEFAULT_THEME);
    else setActiveTheme(themeId, customColors);
    return {
      preference,
      themeId,
      customColors,
      scheme: getActivePalette().scheme,
      palette: getActivePalette(),
      revision: get().revision + 1,
    };
  };

  return {
    preference: DEFAULT_THEME,
    themeId: DEFAULT_THEME,
    customColors: {},
    scheme: "dark",
    palette: themes[DEFAULT_THEME],
    revision: 0,
    hydrated: false,
    // Açılışta oturum bilinmiyor; splash ve giriş ekranı adayla başlar.
    authIsland: true,

    setAuthIsland: (active) => {
      if (get().authIsland === active) return;
      const { preference, customColors } = get();
      set({ ...apply(preference, customColors, active), authIsland: active });
    },

    hydrate: async () => {
      const [stored, storedColors] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY).catch(() => null),
        AsyncStorage.getItem(CUSTOM_COLORS_KEY).catch(() => null),
      ]);
      let custom: CustomColors = {};
      try {
        custom = normalizeCustomColors(JSON.parse(storedColors ?? "{}"));
      } catch {
        custom = {};
      }
      set({ ...apply(parsePreference(stored), custom), hydrated: true });
    },

    setTheme: async (preference) => {
      // Hazır bir atmosfer seçmek özel paleti sıfırlar (web'de de öyle):
      // aksi hâlde Ametist'e dokunan kullanıcı eski özel renklerini görürdü.
      set(apply(preference, {}));
      await Promise.all([
        AsyncStorage.setItem(THEME_KEY, preference),
        AsyncStorage.removeItem(CUSTOM_COLORS_KEY),
      ]);
    },

    setCustomColors: async (colors) => {
      const clean = normalizeCustomColors(colors);
      set(apply(get().preference, clean));
      await AsyncStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(clean));
    },

    syncSystem: () => {
      const { preference, customColors, themeId } = get();
      if (preference !== "system") return;
      if (resolveTheme(preference) === themeId) return;
      set(apply(preference, customColors));
    },
  };
});
