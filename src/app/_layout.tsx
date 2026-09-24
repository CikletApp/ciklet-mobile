import { useEffect, useState } from "react";
import { Appearance } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { persistOptions, queryClient } from "@/api/query-client";
import { ConnectionBanner } from "@/components/connection-banner";
import { CallOverlay } from "@/features/call/call-overlay";
import { BrandSplash } from "@/features/auth/auth-shell";
import { setupLiveKit } from "@/lib/livekit";
import { RealtimeProvider } from "@/realtime/provider";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { useTheme } from "@/stores/theme";
import { useAppFonts } from "@/theme/use-app-fonts";
import {
  createModalScreenOptions,
  createStackScreenOptions,
} from "@/theme/navigation";

/**
 * Kök düzen — sağlayıcı sırası ve rota koruması.
 *
 * Sıralama önemli: GestureHandler → SafeArea → Query → Realtime.
 * `RealtimeProvider` soket olaylarını react-query cache'ine yazdığı için
 * `PersistQueryClientProvider`'ın İÇİNDE olmak zorunda.
 */

void SplashScreen.preventAutoHideAsync();

// WebRTC global'leri modül yüklenirken bir kez kaydedilir; React ağacına
// bağlı değildir ve render sırasında çağrılmamalıdır.
setupLiveKit();

export default function RootLayout() {
  const [splashElapsed, setSplashElapsed] = useState(false);
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const themeRevision = useTheme((s) => s.revision);
  const scheme = useTheme((s) => s.scheme);
  const palette = useTheme((s) => s.palette);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const syncSystemTheme = useTheme((s) => s.syncSystem);
  const hydratePreferences = usePreferences((s) => s.hydrate);
  const appFonts = useAppFonts();
  const stackScreenOptions = createStackScreenOptions(palette);
  const modalScreenOptions = createModalScreenOptions(palette);

  useEffect(() => {
    void hydrateTheme();
    void hydratePreferences();
    void bootstrap();
  }, [bootstrap, hydratePreferences, hydrateTheme]);

  // "Sistem" tercihi cihazın açık/koyu değişimini canlı izler.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(syncSystemTheme);
    return () => subscription.remove();
  }, [syncSystemTheme]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Splash yalnızca oturum durumu netleştiğinde kalkar — aksi halde
    // kullanıcı bir an giriş ekranını görüp sonra uygulamaya atlar.
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading" || !splashElapsed || !appFonts.ready) return <BrandSplash />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <RealtimeProvider>
            <StatusBar style={scheme === "light" ? "dark" : "light"} />
            <ConnectionBanner key={`connection-${themeRevision}`} />
            {/*
              React Compiler, prop'u değişmeyen alt bileşenleri otomatik
              memoize edebilir. Renk Proxy'sindeki değişimi bağımlılık olarak
              göremediği için bazı saydam yüzeyler eski temada kalıyordu.
              Tema anahtarı navigator ağacını yeniden kurar; tüm ekranlar ve
              yüzen kabuklar yeni paleti aynı karede yeniden okur.
            */}
            <Stack key={`${themeRevision}-${appFonts.revision}`} screenOptions={stackScreenOptions}>
              <Stack.Protected guard={status === "signedIn"}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="servers/[serverId]" options={{ title: "" }} />
                <Stack.Screen
                  name="servers/new"
                  options={{ ...modalScreenOptions, title: "Sunucu" }}
                />
                <Stack.Screen name="chat/channel/[channelId]" options={{ title: "" }} />
                <Stack.Screen name="chat/direct/[directId]" options={{ title: "" }} />
                <Stack.Screen
                  name="directs/new-group"
                  options={{ ...modalScreenOptions, title: "Yeni Grup" }}
                />
                <Stack.Screen name="directs/[directId]/info" options={{ title: "Grup Bilgisi" }} />
                <Stack.Screen name="voice/[channelId]" options={{ title: "" }} />
                <Stack.Screen
                  name="activities/index"
                  options={{ ...modalScreenOptions, title: "Aktiviteler" }}
                />
                <Stack.Screen
                  name="activities/[clientId]"
                  options={{ ...modalScreenOptions, title: "" }}
                />
                <Stack.Screen name="friends/index" options={{ title: "Arkadaşlar" }} />
                <Stack.Screen
                  name="friends/quick-message"
                  options={{ ...modalScreenOptions, title: "Yeni mesaj" }}
                />
                <Stack.Screen
                  name="friends/add"
                  options={{ ...modalScreenOptions, title: "Arkadaş Ekle" }}
                />
                <Stack.Screen name="search" options={{ title: "Ara" }} />
                <Stack.Screen
                  name="profile/edit"
                  options={{ ...modalScreenOptions, title: "Profil" }}
                />
                <Stack.Screen name="profile/[profileId]" options={{ title: "" }} />
                <Stack.Screen name="settings/index" options={{ title: "Ayarlar" }} />
                <Stack.Screen
                  name="settings/appearance"
                  options={{ title: "Görünüm" }}
                />
              </Stack.Protected>

              <Stack.Protected guard={status !== "signedIn"}>
                <Stack.Screen name="(auth)/index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/verify-email" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
              </Stack.Protected>
            </Stack>
            {/* Çağrı katmanı yığının DIŞINDA: gelen arama hangi ekranda
                olursan ol görünmeli. */}
            <CallOverlay key={`call-${themeRevision}`} />
          </RealtimeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
