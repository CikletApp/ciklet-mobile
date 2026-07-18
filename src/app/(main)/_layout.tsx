import { Tabs } from "expo-router";

import { colors } from "@/theme/colors";

export default function MainTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.surface2 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.mainBg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Sunucular" }} />
      <Tabs.Screen name="directs" options={{ title: "Mesajlar" }} />
      <Tabs.Screen name="settings" options={{ title: "Ayarlar" }} />
    </Tabs>
  );
}
