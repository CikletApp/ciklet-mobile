import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, AppState, type ColorSchemeName } from "react-native";
import { create } from "zustand";

import { useCall } from "@/stores/call";
import { useVoice } from "@/stores/voice";
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

type Scheme = "light" | "dark";
const toScheme = (value: ColorSchemeName | null | undefined): Scheme => (value === "light" ? "light" : "dark");

/**
 * Açılıştaki SİSTEM görünümü. Yerel açılış ekranı (app.json
 * `userInterfaceStyle: automatic`) ve JS açılış ekranı (BrandSplash) bunu
 * kullanır. Modül yüklenirken, hiçbir `Appearance.setColorScheme` çağrısından
 * önce okunur.
 */
export const launchSystemScheme: Scheme = toScheme(Appearance.getColorScheme());

/**
 * Uygulama telefonun açık/koyu moduna uyar: açık modda Porselen, koyu modda
 * kullanıcının seçtiği koyu atmosfer (Porselen hariç; seçim yoksa Ametist).
 * Saklanan tercih yalnızca koyu modun temasını belirler; eski "system" ve
 * "light" tercihleri koyu modda Ametist'e düşer.
 */
export function darkThemeOf(preference: ThemePreference): ThemeId {
  return isThemeId(preference) && preference !== "light" ? preference : DEFAULT_THEME;
}

export function resolveTheme(preference: ThemePreference, system: Scheme): ThemeId {
  return system === "light" ? "light" : darkThemeOf(preference);
}

/** Mentol özel renkleri koyu mod temasının üstüne kurulu; açık modda Porselen saf kalır. */
function activeCustomColors(system: Scheme, customColors: CustomColors): CustomColors {
  return system === "dark" ? customColors : {};
}

/**
 * Yerel arayüz (iOS klavyesi, kaydırma çubukları, Android gezinme çubuğu,
 * WebView, sistem seçicileri) sistemi izler — tema de sistemi izlediği için
 * ikisi aynı. Tek istisna her zaman koyu olan giriş ekranları ("ada"): telefon
 * açık moddayken yerel arayüz orada koyuya kilitlenir. Kilitliyken Appearance
 * kilitli değeri bildirir; o olaylar sistem değişimi sayılmaz.
 *
 * Kilit kalkınca Appearance'ın önbelleği bir an eski (kilitli) değeri tutabilir;
 * gerçek mod farklıysa yerel taraf hemen bir değişim olayı gönderir. Bu yüzden
 * kilit kalkarken son bilinen sistem modu korunur ve olay beklenir.
 */
let nativeLock: Scheme | null = null;
function setNativeLock(next: Scheme | null) {
  if (next === nativeLock) return;
  nativeLock = next;
  try {
    Appearance.setColorScheme(next ?? "unspecified");
  } catch {
    /* Desteklenmeyen ortam (web/test) — yok sayılır. */
  }
}

/**
 * Sesli kanal ya da arama sürerken tema değişimi ertelenir: palet değişimi
 * gezinme ağacını yeniden kurar ve LiveKit odası kopup yeniden bağlanırdı.
 */
const inLiveAudio = () =>
  Boolean(useVoice.getState().active) || useCall.getState().session?.status === "connected";

/** Ertelenmiş sistem modu (canlı ses bitince uygulanır). */
let pendingSystem: Scheme | null = null;

interface ThemeState {
  /** Kullanıcının koyu mod teması (eski kayıtlarda "system"/"light" olabilir). */
  preference: ThemePreference;
  /** Etkin tema kimliği: açık modda "light", koyu modda tercih. */
  themeId: ThemeId;
  /** Telefonun açık/koyu modu (son bilinen). */
  systemScheme: Scheme;
  /** Mentol paleti: koyu mod temasının üstüne yazılan renkler. */
  customColors: CustomColors;
  /** Etkin paletin açık/koyu ayrımı — durum çubuğu, blur tonu. */
  scheme: Scheme;
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
   * Palet aynı kalıyorsa artmaz (ekranlar boşuna yeniden kurulmasın).
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
  /** Telefonun modu değişti (bkz. useSystemSchemeSync). */
  setSystemScheme: (scheme: Scheme) => void;
}

function parsePreference(value: string | null): ThemePreference {
  if (value === "system") return "system";
  return isThemeId(value) ? value : DEFAULT_THEME;
}

/**
 * Açılışta oturum henüz bilinmiyor (`setAuthIsland` hiç çağrılmadı): ada
 * varsayılıyor ama yerel arayüz kilitlenmez. Aksi hâlde oturum hızla
 * çözülünce kilit hemen kalkar ve geç gelen kilit olayı gerçek sistem
 * değişimi sanılıp tema iki kez dönerdi.
 */
let islandConfirmed = false;

export const useTheme = create<ThemeState>((set, get) => {
  /** Paleti uygular; palet değişmediyse revizyon artmaz. */
  const apply = (
    preference: ThemePreference,
    customColors: CustomColors,
    island = get().authIsland,
    systemScheme = get().systemScheme
  ) => {
    const themeId = resolveTheme(preference, systemScheme);
    const before = getActivePalette();
    if (island) setActiveTheme(DEFAULT_THEME);
    else setActiveTheme(themeId, activeCustomColors(systemScheme, customColors));
    const palette = getActivePalette();
    const changed = JSON.stringify(palette) !== JSON.stringify(before);
    setNativeLock(island && islandConfirmed && palette.scheme !== systemScheme ? palette.scheme : null);
    return {
      preference,
      themeId,
      systemScheme,
      customColors,
      scheme: palette.scheme,
      palette: changed ? palette : get().palette,
      revision: changed ? get().revision + 1 : get().revision,
    };
  };

  return {
    preference: DEFAULT_THEME,
    themeId: resolveTheme(DEFAULT_THEME, launchSystemScheme),
    systemScheme: launchSystemScheme,
    customColors: {},
    scheme: "dark",
    palette: themes[DEFAULT_THEME],
    revision: 0,
    hydrated: false,
    // Açılışta oturum bilinmiyor; splash ve giriş ekranı adayla başlar.
    authIsland: true,

    setAuthIsland: (active) => {
      const confirmedNow = !islandConfirmed;
      islandConfirmed = true;
      if (get().authIsland === active && !confirmedNow) return;
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
      let preference = parsePreference(stored);
      // Eski kayıtlar: "Sistem" tercihiyle kurulmuş özel renkler Ametist'in
      // üstüne kuruluydu → tercih Ametist'e sabitlenir. Porselen'e kurulmuş
      // özel renkler artık uygulanamaz (açık mod hep saf Porselen) → silinir.
      if (Object.keys(custom).length > 0 && !(isThemeId(preference) && preference !== "light")) {
        if (preference === "system") {
          preference = DEFAULT_THEME;
          void AsyncStorage.setItem(THEME_KEY, preference).catch(() => {});
        } else {
          custom = {};
          void AsyncStorage.removeItem(CUSTOM_COLORS_KEY).catch(() => {});
        }
      }
      set({ ...apply(preference, custom), hydrated: true });
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
      // Özel renkler koyu mod temasının üstüne kurulur; tercih eski
      // "system"/"light" ise o an görünen koyu temaya sabitlenir.
      const { preference } = get();
      const base = darkThemeOf(preference);
      set(apply(base, clean));
      await Promise.all([
        base === preference ? Promise.resolve() : AsyncStorage.setItem(THEME_KEY, base),
        AsyncStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(clean)),
      ]);
    },

    setSystemScheme: (scheme) => {
      if (inLiveAudio()) {
        pendingSystem = scheme;
        return;
      }
      pendingSystem = null;
      const state = get();
      if (state.systemScheme === scheme) return;
      set(apply(state.preference, state.customColors, state.authIsland, scheme));
    },
  };
});

function syncFromSystem() {
  if (nativeLock || AppState.currentState !== "active") return;
  useTheme.getState().setSystemScheme(toScheme(Appearance.getColorScheme()));
}

/** Canlı ses bitince ertelenmiş mod uygulanır. */
function flushPendingSystem() {
  if (pendingSystem && !inLiveAudio()) useTheme.getState().setSystemScheme(pendingSystem);
}

/**
 * Telefonun açık/koyu modunu canlı izler. Yalnızca uygulama öndeyken:
 * iOS arka plana alırken anlık görüntü için modu bir an çevirip geri alıyor;
 * o olaylar teması değiştirip ekranları yeniden kurardı. Öne dönünce mod bir
 * kez yeniden okunur.
 */
export function useSystemSchemeSync() {
  useEffect(() => {
    // Etkinlik yeniden kurulduysa (Android) yerel taraf kilidi unutmuş
    // olabilir; JS'teki kayıt yerel durumla yeniden eşitlenir.
    const lock = nativeLock;
    nativeLock = null;
    if (lock) setNativeLock(lock);

    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      if (nativeLock || AppState.currentState !== "active") return;
      useTheme.getState().setSystemScheme(toScheme(colorScheme));
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") syncFromSystem();
    });
    const voice = useVoice.subscribe(flushPendingSystem);
    const call = useCall.subscribe(flushPendingSystem);
    return () => {
      appearance.remove();
      appState.remove();
      voice();
      call();
    };
  }, []);
}
