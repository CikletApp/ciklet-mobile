import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { persistOptions, queryClient } from "@/api/query-client";
import { ConnectionBanner } from "@/components/connection-banner";
import { setupLiveKit } from "@/lib/livekit";
import { RealtimeProvider } from "@/realtime/provider";
import { useAuth } from "@/stores/auth";
import { colors } from "@/theme/tokens";
import { modalScreenOptions, stackScreenOptions } from "@/theme/navigation";

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
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // Splash yalnızca oturum durumu netleştiğinde kalkar — aksi halde
    // kullanıcı bir an giriş ekranını görüp sonra uygulamaya atlar.
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <RealtimeProvider>
            <StatusBar style="light" />
            <ConnectionBanner />
            <Stack screenOptions={stackScreenOptions}>
              <Stack.Protected guard={status === "signedIn"}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="servers/[serverId]" options={{ title: "" }} />
                <Stack.Screen
                  name="servers/new"
                  options={{ ...modalScreenOptions, title: "Sunucu" }}
                />
                <Stack.Screen name="chat/channel/[channelId]" options={{ title: "" }} />
                <Stack.Screen name="chat/direct/[directId]" options={{ title: "" }} />
                <Stack.Screen name="voice/[channelId]" options={{ title: "" }} />
                <Stack.Screen
                  name="activities/index"
                  options={{ ...modalScreenOptions, title: "Aktiviteler" }}
                />
                <Stack.Screen name="activities/[clientId]" options={{ title: "" }} />
                <Stack.Screen name="friends/index" options={{ title: "Arkadaşlar" }} />
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
              </Stack.Protected>

              <Stack.Protected guard={status !== "signedIn"}>
                <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
              </Stack.Protected>
            </Stack>
          </RealtimeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
