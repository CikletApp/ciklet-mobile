import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { setupLiveKit } from "@/lib/livekit";
import { useAuth } from "@/stores/auth";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

setupLiveKit();

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.mainBg },
        }}
      >
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="servers/[serverId]/index" options={{ title: "Kanallar" }} />
          <Stack.Screen name="servers/[serverId]/[channelId]" options={{ title: "" }} />
          <Stack.Screen name="directs/[directId]" options={{ title: "" }} />
        </Stack.Protected>
        <Stack.Protected guard={status !== "signedIn"}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
