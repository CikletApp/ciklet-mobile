import { Tabs } from "expo-router";

import { FloatingTabBar } from "@/components/ui";
import { useTheme } from "@/stores/theme";
import { createTabScreenOptions } from "@/theme/navigation";
import { themes } from "@/theme/tokens";

/**
 * Alt sekmeler — uygulamanın birincil gezinme ekseni.
 *
 * **Sohbetler ve Sunucular AYRI sekmelerdir.** Önceki düzende Ana Sayfa'nın
 * solunda kalıcı 64px'lik bir sunucu rayı duruyordu ve sağdaki panel seçime
 * göre DM listesine ya da kanal listesine dönüşüyordu. İki sorunu vardı:
 * mesaj listesi kalıcı olarak 64px dar yaşıyordu ve bir sunucuya bakmak
 * mesaj listesini ekrandan tamamen kaldırıyordu — yani en sık yapılan iki
 * iş birbirinin yerini alıyordu.
 *
 * Ayrım şimdi sekme düzeyinde: mesajların kendi evi var, sunucuların kendi
 * evi var, ikisi arasında geçiş tek dokunuş ve hiçbiri diğerini kapatmıyor.
 *
 * Dördüncü sekmenin maliyeti ölçüldü: 360dp'lik bir ekranda her hedef
 * ~90dp kalıyor, yani `MIN_TOUCH_TARGET` (44pt) rahatça sağlanıyor ve en
 * uzun etiket ("Bildirimler") 10px'te sığıyor. Beşincisi bu payı bitirir.
 */
export default function TabsLayout() {
  const themeId = useTheme((s) => s.themeId);
  const tabScreenOptions = createTabScreenOptions(themes[themeId]);

  return (
    <Tabs
      screenOptions={{ ...tabScreenOptions, headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Sohbetler" }} />
      <Tabs.Screen name="servers" options={{ title: "Sunucular" }} />
      <Tabs.Screen name="notifications" options={{ title: "Bildirimler" }} />
      <Tabs.Screen name="me" options={{ title: "Sen" }} />
    </Tabs>
  );
}
