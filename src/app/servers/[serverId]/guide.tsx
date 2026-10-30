import { ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useMarkGuideSeen, useServerChannels, useServerGuide, useServerSummary } from "@/api/hooks";
import { Button, EmptyState, ErrorState, Screen, ScreenLoader } from "@/components/ui";
import { ServerGuideBody } from "@/features/server/guide-view";
import { ServerJoinGate, openServerChannel } from "@/features/server/join-flow";
import { useT } from "@/lib/i18n";

/**
 * Sunucu Rehberi sayfası — web `servers/[serverId]/guide` karşılığı. Kanal
 * listesinin en üstündeki giriş buraya açılır; yeni üye sunucu kökünden bir
 * kez buraya yönlendirilir. İlk açılış kaydedilir (bir daha yönlendirilmez).
 * Katılım perdeleri (sorular + kurallar) burada da çizilir.
 */
export default function ServerGuideScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const t = useT();
  const { data: server } = useServerSummary(serverId);
  const { data: channels } = useServerChannels(serverId);
  const { data, isLoading, error, refetch } = useServerGuide(serverId);
  const guide = data?.guide ?? null;
  useMarkGuideSeen(serverId, guide !== null);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("serverGuide.title") }} />
      {isLoading ? (
        <ScreenLoader />
      ) : error ? (
        <ErrorState
          message={error instanceof ApiError ? error.message : t("serverGuide.settings.loadFailed")}
          onRetry={() => void refetch()}
        />
      ) : !guide ? (
        <EmptyState
          icon="compass"
          title={t("serverGuide.page.disabled")}
          action={<Button label="Geri dön" variant="ghost" onPress={() => router.back()} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
            <ServerGuideBody
              serverId={serverId}
              serverName={server?.name ?? ""}
              serverImageUrl={server?.imageUrl || null}
              guide={guide}
              onOpenChannel={(channelId) => openServerChannel(serverId, channelId, channels)}
            />
          </ScrollView>
          <ServerJoinGate serverId={serverId} channels={channels} />
        </View>
      )}
    </Screen>
  );
}
