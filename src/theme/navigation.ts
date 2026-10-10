import { DefaultTheme, type Theme } from "expo-router";

import { fw } from "./fonts";
import { typography, type ThemePalette } from "./tokens";

/**
 * Navigator seçenekleri — `className` çalışmayan tek yer burasıdır
 * (react-navigation stilleri düz nesne bekler). Tüm ekranlar aynı kabuk
 * görünümünü buradan alır; ekran dosyalarında renk yazılmaz.
 */

export const createStackScreenOptions = (colors: ThemePalette) => ({
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: {
    color: colors.bright,
    fontSize: typography.title.fontSize,
    // Yüz + normal kalınlık: `fontWeight` tek başına Android'de Roboto'ya düşürüyordu.
    fontFamily: typography.title.fontFamily,
    fontWeight: typography.title.fontWeight,
  },
  headerTintColor: colors.bright,
  headerShadowVisible: false,
  // iOS geri düğmesi yalnızca ok: önceki ekranın adı ("(tabs)") yazılmaz.
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: colors.bg },
} as const);

/**
 * react-navigation teması. Sağlanmazsa varsayılan AÇIK tema kullanılıyor ve
 * iOS başlığı açık arayüz stiline zorlanıyordu: geri ve sağdaki düğmelerin
 * cam kapsülleri koyu temada beyaz kalıyordu. Yazı yüzleri bilerek
 * varsayılan: özel geri-başlık fontu iOS'un yerel gösterim modunu kapatır.
 */
export const createNavigationTheme = (colors: ThemePalette): Theme => ({
  dark: colors.scheme === "dark",
  colors: {
    primary: colors.bright,
    background: colors.bg,
    card: colors.bg,
    text: colors.bright,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: DefaultTheme.fonts,
});

export const createTabScreenOptions = (colors: ThemePalette) => ({
  ...createStackScreenOptions(colors),
  tabBarStyle: {
    backgroundColor: colors.deep,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabBarActiveTintColor: colors.bright,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 11, ...fw(600) },
  sceneStyle: { backgroundColor: colors.bg },
} as const);

/** Modal olarak açılan ekranlar (profil düzenleme, arkadaş ekle...). */
export const createModalScreenOptions = (colors: ThemePalette) => ({
  ...createStackScreenOptions(colors),
  presentation: "modal" as const,
  headerStyle: { backgroundColor: colors.panel },
  contentStyle: { backgroundColor: colors.panel },
} as const);
