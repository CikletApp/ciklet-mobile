import { Tabs } from "expo-router";

import { Icon } from "@/components/ui/icon";
import { tabScreenOptions } from "@/theme/navigation";

/**
 * Alt sekmeler — uygulamanın birincil gezinme ekseni.
 *
 * Üç sekme bilinçli bir sınır: dördüncüsü eklendiğinde her sekme
 * dokunma hedefi olarak daralır ve etiketler Türkçe'de kırpılmaya başlar.
 * Sunucu/DM ayrımı sekme değil, Ana Sayfa içindeki ray ile yapılır.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ ...tabScreenOptions, headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, focused }) => (
            <Icon name="home" color={color} size={22} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Bildirimler",
          tabBarIcon: ({ color, focused }) => (
            <Icon name="bell" color={color} size={22} filled={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Sen",
          tabBarIcon: ({ color, focused }) => (
            <Icon name="user" color={color} size={22} filled={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
