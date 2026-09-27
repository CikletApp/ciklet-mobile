import { useEffect } from "react";
import { useSegments } from "expo-router";
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
 */
export function useScreenTracking() {
  const segments = useSegments();
  // `(tabs)` gibi grup adları rotayı değiştirmiyor; raporda gürültü.
  const screen = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`;

  useEffect(() => {
    logScreenView(getAnalytics(), { screen_name: screen, screen_class: screen }).catch(() => {
      // Analitik hiçbir akışı bozmamalı (Play Services yok, ağ yok…).
    });
  }, [screen]);
}
