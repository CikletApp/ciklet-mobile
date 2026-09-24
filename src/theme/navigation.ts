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
  contentStyle: { backgroundColor: colors.bg },
} as const);

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
