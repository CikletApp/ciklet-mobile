import { useEffect, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { Button, EmptyState, Screen, ScreenLoader } from "@/components/ui";
import { launchActivityById } from "@/features/activities/launch";

/**
 * Derin bağlantı / eski yol: aktiviteyi kalıcı katmanda başlatıp ekranı kapatır.
 *
 * Aktivite artık bir ekran değil, kök düzendeki kalıcı katmanda
 * (features/activities/activity-host) çalışıyor: küçültülüp sohbetin üstünde
 * yüzen pencerede sürebilsin, gezinirken yeniden yüklenmesin. Uygulama içi
 * girişler doğrudan `launchActivity` çağırır; bu rota yalnızca adresle
 * gelenler için.
 */
export default function ActivityLaunchScreen() {
  const { clientId, chatId, serverId } = useLocalSearchParams<{
    clientId: string;
    chatId?: string;
    serverId?: string;
  }>();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void launchActivityById(clientId, { chatId, serverId }).then((found) => {
      if (cancelled) return;
      if (!found) {
        setMissing(true);
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, chatId, serverId]);

  if (!missing) return <ScreenLoader label="Aktivite hazırlanıyor…" />;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Aktivite" }} />
      <EmptyState
        icon="compass"
        title="Aktivite bulunamadı"
        description="Bu aktivite kaldırılmış veya artık onaylı değil."
        action={<Button label="Geri dön" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
      />
    </Screen>
  );
}
