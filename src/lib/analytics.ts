import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useSegments } from "expo-router";

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
 * Firebase modülleri STATİK İÇE AKTARILMAZ. iOS'ta Firebase yapılandırması
 * (GoogleService-Info.plist) yoksa yerel modül hiç bağlanmıyor (package.json
 * expo.autolinking.ios.exclude) ve @react-native-firebase/app daha içe
 * aktarılırken yerel modülü arıyor: "Native module NativeRNFBTurboApp is not
 * registered" fırlatıp uygulamayı açılışta düşürüyordu. Modüller yalnızca
 * Firebase bağlıysa, ilk ekran kaydında yüklenir.
 */
type AnalyticsModule = typeof import("@react-native-firebase/analytics");
type AppModule = typeof import("@react-native-firebase/app");

/** `undefined`: henüz denenmedi; `null`: Firebase yok, analitik kapalı. */
let analytics: AnalyticsModule | null | undefined;

function loadAnalytics(): AnalyticsModule | null {
  if (analytics !== undefined) return analytics;
  analytics = null;
  if (Platform.OS === "ios" && Constants.expoConfig?.extra?.iosFirebase !== true) {
    return analytics;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const app = require("@react-native-firebase/app") as AppModule;
    if (app.getApps().length === 0) return analytics;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analytics = require("@react-native-firebase/analytics") as AnalyticsModule;
  } catch {
    analytics = null;
  }
  return analytics;
}

export function useScreenTracking() {
  const segments = useSegments();
  // `(tabs)` gibi grup adları rotayı değiştirmiyor; raporda gürültü.
  const screen = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`;

  useEffect(() => {
    const firebase = loadAnalytics();
    if (!firebase) return;
    try {
      firebase
        .logScreenView(firebase.getAnalytics(), { screen_name: screen, screen_class: screen })
        .catch(() => {
          // Analitik hiçbir akışı bozmamalı (Play Services yok, ağ yok…).
        });
    } catch {
      // Eşzamanlı hata da akışı bozmamalı.
    }
  }, [screen]);
}
