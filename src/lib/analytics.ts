import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useSegments } from "expo-router";
import { getApps } from "@react-native-firebase/app";
import { getAnalytics, logScreenView } from "@react-native-firebase/analytics";

/**
 * Firebase Analytics (Google Analytics 4).
 *
 * Oturum, ilk açılış, uygulama güncellemesi gibi olayları SDK kendisi
 * topluyor. Ekran görüntülemesini ise expo-router'ın rotalarını bilmediği
 * için elle gönderiyoruz.
 *
 * Ekran adı gerçek adres DEĞİL, rota şablonu: `/chat/direct/[directId]`.
 * Gerçek adres sohbet ve profil kimliklerini taşırdı; hem raporlar binlerce
 * tekil satıra bölünür hem de kullanıcıya ait kimlikler Analytics'e giderdi.
 *
 * iOS'ta Firebase yapılandırması (GoogleService-Info.plist) yoksa yerel
 * modül hiç bağlanmıyor (package.json expo.autolinking.ios.exclude); çağrı
 * "Native module ... is not registered" fırlatır ve efekt içinde fırlayan
 * hata uygulamayı düşürürdü. O durumda analitik kapalı kalır.
 */
let enabled: boolean | null = null;

function analyticsEnabled(): boolean {
  if (enabled !== null) return enabled;
  if (Platform.OS === "ios" && Constants.expoConfig?.extra?.iosFirebase !== true) {
    enabled = false;
    return enabled;
  }
  try {
    enabled = getApps().length > 0;
  } catch {
    enabled = false;
  }
  return enabled;
}

export function useScreenTracking() {
  const segments = useSegments();
  // `(tabs)` gibi grup adları rotayı değiştirmiyor; raporda gürültü.
  const screen = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`;

  useEffect(() => {
    if (!analyticsEnabled()) return;
    try {
      logScreenView(getAnalytics(), { screen_name: screen, screen_class: screen }).catch(() => {
        // Analitik hiçbir akışı bozmamalı (Play Services yok, ağ yok…).
      });
    } catch {
      // Eşzamanlı hata da (yerel modül yok) akışı bozmamalı.
    }
  }, [screen]);
}
