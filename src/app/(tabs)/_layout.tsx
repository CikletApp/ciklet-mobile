import { Tabs } from "expo-router";

import { FloatingTabBar } from "@/components/ui";
import { tabScreenOptions } from "@/theme/navigation";

/**
 * Alt sekmeler — uygulamanın birincil gezinme ekseni.
 *
 * Üç sekme bilinçli bir sınır: dördüncüsü eklendiğinde her sekme dokunma
 * hedefi olarak daralır ve etiketler Türkçe'de kırpılmaya başlar.
 * Sunucu/DM ayrımı sekme değil, Ana Sayfa içindeki ray ile yapılır.
 *
 * Çubuk özel: ekrana yapışan tam genişlikte bir bar yerine kenarlardan
 * boşluklu, tamamen yuvarlatılmış ve arkası bulanık bir ada
 * (`FloatingTabBar`). İçerik altından kayarken görünür kalır.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ ...tabScreenOptions, headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler" }} />
      <Tabs.Screen name="me" options={{ title: "Sen" }} />
    </Tabs>
  );
}
