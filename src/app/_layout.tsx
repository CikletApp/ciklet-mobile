import { useCallback, useEffect } from "react";
import { Stack, ThemeProvider } from "expo-router";
import { getFocusedRouteNameFromRoute } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ReducedMotionConfig } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { persistOptions, queryClient } from "@/api/query-client";
import { ConnectionBanner } from "@/components/connection-banner";
import { InAppNoticeHost } from "@/components/in-app-notice";
import { DialogHost, ToastHost } from "@/components/ui";
import { ImageViewerHost } from "@/components/ui/image-viewer";
import { BrandSplash } from "@/features/auth/auth-shell";
import { CallOverlay } from "@/features/call/call-overlay";
import { reanimatedMotionMode, useReducedMotion } from "@/lib/accessibility";
import { useScreenTracking } from "@/lib/analytics";
import { loadDokimorjiManifest } from "@/lib/emoji";
import { useT, type MessageKey } from "@/lib/i18n";
import { setupLiveKit } from "@/lib/livekit";
import { RealtimeProvider } from "@/realtime/provider";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { useSystemSchemeSync, useTheme } from "@/stores/theme";
import { useAppFonts } from "@/theme/use-app-fonts";
import {
  createModalScreenOptions,
  createNavigationTheme,
  createStackScreenOptions,
} from "@/theme/navigation";

/**
 * Kök düzen — sağlayıcı sırası ve rota koruması.
 *
 * Sıralama önemli: GestureHandler → SafeArea → Query → Realtime.
 * `RealtimeProvider` soket olaylarını react-query cache'ine yazdığı için
 * `PersistQueryClientProvider`'ın İÇİNDE olmak zorunda.
 */

/**
 * Derin bağlantıyla (bildirime dokunma, davet) doğrudan bir sohbete
 * gelindiğinde yığının altında sekmeler olsun: aksi hâlde ekranda geri
 * düğmesi çıkmıyor ve kullanıcı sohbette mahsur kalıyordu.
 */
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// iOS geri menüsü önceki ekranın başlığını gösterir; başlıksız sekme grubu
// "(tabs)" diye görünüyordu.
const TAB_TITLES: Record<string, MessageKey> = {
  index: "tabs.chats",
  servers: "tabs.servers",
  notifications: "tabs.notifications",
  me: "tabs.me",
};

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

// WebRTC global'leri modül yüklenirken bir kez kaydedilir; React ağacına
// bağlı değildir ve render sırasında çağrılmamalıdır.
setupLiveKit();

// Oturum yokken auth ekranları temadan bağımsız koyu paletle çizilir (web
// `.ciklet-auth`); girişte kullanıcının teması geri gelir. Efekt yerine
// abonelik: durum değiştiği ANDA, render'dan önce çalışır — efekt bir kare
// geç kalır ve yeni ekran bir an yanlış paletle görünürdü.
useAuth.subscribe((state, previous) => {
  if (state.status === previous.status || state.status === "loading") return;
  useTheme.getState().setAuthIsland(state.status !== "signedIn");
});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const themeRevision = useTheme((s) => s.revision);
  const scheme = useTheme((s) => s.scheme);
  const palette = useTheme((s) => s.palette);
  const themeHydrated = useTheme((s) => s.hydrated);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const hydratePreferences = usePreferences((s) => s.hydrate);
  const appFonts = useAppFonts();
  const reduceMotionPreference = usePreferences((s) => s.reduceMotion);
  const reducedMotion = useReducedMotion();
  const t = useT();
  // Hareket azaltmada ekranlar kaymak yerine yerinde belirir.
  const stackScreenOptions = {
    ...createStackScreenOptions(palette),
    ...(reducedMotion ? { animation: "fade" as const } : {}),
  };
  useScreenTracking();
  // Tema telefonun açık/koyu modunu canlı izler (açıkta Porselen).
  useSystemSchemeSync();
  const modalScreenOptions = createModalScreenOptions(palette);
  const navigationTheme = createNavigationTheme(palette);
  const ready = status !== "loading" && appFonts.ready && themeHydrated;

  useEffect(() => {
    void hydrateTheme();
    void hydratePreferences();
    void bootstrap();
    void loadDokimorjiManifest();
  }, [bootstrap, hydratePreferences, hydrateTheme]);

  // Yerel splash ile JS açılış ekranı aynı görüntü (BrandSplash); yerel olan,
  // JS'teki ikon ekrana çizildiği an kalkar ve geçiş görünmez. Uygulama ilk
  // karede hazırsa ana ağacın ilk karesinde, görsel olayı hiç gelmezse kısa
  // süre sonra yine kalkar. Ekran hazır olunca beklemeden açılır (WhatsApp).
  const onSplashReady = useCallback(() => SplashScreen.hide(), []);
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hide(), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <BrandSplash onReady={onSplashReady} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView onLayout={onSplashReady} style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <RealtimeProvider>
            {/* Reanimated animasyonlarının hepsi bu tek ayara uyar (lib/accessibility). */}
            <ReducedMotionConfig mode={reanimatedMotionMode(reduceMotionPreference)} />
            <StatusBar style={scheme === "light" ? "dark" : "light"} />
            <ConnectionBanner key={`connection-${themeRevision}`} />
            {/*
              React Compiler, prop'u değişmeyen alt bileşenleri otomatik
              memoize edebilir. Renk Proxy'sindeki değişimi bağımlılık olarak
              göremediği için bazı saydam yüzeyler eski temada kalıyordu.
              Tema anahtarı navigator ağacını yeniden kurar; tüm ekranlar ve
              yüzen kabuklar yeni paleti aynı karede yeniden okur.
            */}
            {/* Tema sağlayıcısı iOS başlığının açık/koyu stilini paletten alır. */}
            <ThemeProvider value={navigationTheme}>
              <Stack key={`${themeRevision}-${appFonts.revision}`} screenOptions={stackScreenOptions}>
                <Stack.Protected guard={status === "signedIn"}>
                  <Stack.Screen
                    name="(tabs)"
                    options={({ route }) => ({
                      headerShown: false,
                      title: t(TAB_TITLES[getFocusedRouteNameFromRoute(route) ?? "index"] ?? "tabs.chats"),
                    })}
                  />
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
                  <Stack.Screen name="settings/index" options={{ title: t("settings.title") }} />
                  <Stack.Screen name="settings/help" options={{ title: "Yardım" }} />
                  <Stack.Screen
                    name="settings/appearance"
                    options={{ title: t("settings.appearance.title") }}
                  />
                </Stack.Protected>

                <Stack.Protected guard={status === "signedOut"}>
                  <Stack.Screen name="(auth)/index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)/verify-email" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
                </Stack.Protected>

                {/* Girişten sonraki kapılar — web /redirect sırasıyla: sözleşme,
                    telefon. Her biri bekleyen oturumun gidebileceği TEK yer. */}
                <Stack.Protected guard={status === "eulaPending"}>
                  <Stack.Screen name="(auth)/eula" options={{ headerShown: false }} />
                </Stack.Protected>
                <Stack.Protected guard={status === "phonePending"}>
                  <Stack.Screen name="(auth)/verify-phone" options={{ headerShown: false }} />
                </Stack.Protected>
                <Stack.Protected guard={status === "banned"}>
                  <Stack.Screen name="(auth)/banned" options={{ headerShown: false }} />
                </Stack.Protected>

                {/* Yalnızca bildirimden açılan boş geçiş rotası; başlığı olmaz.
                    Korumasız ve en sonda: ilk rota seçimini etkilemez. */}
                <Stack.Screen name="call/incoming" options={{ headerShown: false, animation: "none" }} />
              </Stack>
            </ThemeProvider>
            {/* Çağrı katmanı yığının DIŞINDA: gelen arama hangi ekranda
                olursan ol görünmeli. */}
            <CallOverlay key={`call-${themeRevision}`} />
            {/* Tek görsel görüntüleyici: mesajlardaki görseller buraya açılır. */}
            <ImageViewerHost key={`viewer-${themeRevision}`} />
            <DialogHost key={`dialog-${themeRevision}`} />
            <ToastHost key={`toast-${themeRevision}`} />
            {/* Ön planda gelen DM / etiketlenme kartı. */}
            <InAppNoticeHost key={`notice-${themeRevision}`} />
          </RealtimeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
