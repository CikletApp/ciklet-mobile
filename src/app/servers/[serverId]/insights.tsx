import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useServerInsights, type DayPoint } from "@/api/hooks/use-server-admin";
import { EmojiText, ErrorState, Icon, ScreenLoader, Screen, type IconName } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu İstatistikleri — web Sunucu Ayarları › İstatistikler sekmesi
 * (Sunucu İstatistiklerini Görüntüle): son 30 gün, günler UTC'ye göre.
 */
export default function ServerInsightsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data, isLoading, isError, refetch } = useServerInsights(serverId);

  if (isLoading) return <ScreenLoader label="İstatistikler yükleniyor…" />;

  return (
    <Screen>
      <Stack.Screen options={{ title: "İstatistikler" }} />
      {isError || !data ? (
        <ErrorState message="İstatistikler yüklenemedi." onRetry={() => void refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Son 30 gün. Silinmiş mesajlar sayılmaz; günler UTC&apos;ye göre.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <Stat icon="users" label="Üye" value={data.memberCount} />
            <Stat icon="trending-up" label="Katılım" value={data.totals.joins} hint="30 günde" />
            <Stat icon="arrow-down-left" label="Ayrılma" value={data.totals.leaves} hint="30 günde" />
            <Stat icon="hash" label="Aktif üye" value={data.totals.activeAuthors7d} hint="son 7 günde yazan" />
          </View>

          <Card title={`MESAJLAR / GÜN · TOPLAM ${data.totals.messages}`}>
            <Bars points={data.messages} color={colors.brand} />
          </Card>
          <Card title="YAZAN ÜYE / GÜN">
            <Bars points={data.activeAuthors} color={colors.success} />
          </Card>
          <Card title="KATILIM / GÜN">
            <Bars points={data.joins} color={colors.success} />
          </Card>
          <Card title="AYRILMA / GÜN">
            <Bars points={data.leaves} color={colors.danger} />
          </Card>

          <Card title="EN HAREKETLİ KANALLAR · 7 GÜN">
            {data.topChannels.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.muted }}>Bu hafta mesaj yok.</Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {data.topChannels.map((channel) => {
                  const max = data.topChannels[0].count || 1;
                  return (
                    <View key={channel.channelId} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <View style={{ width: 120, flexDirection: "row", alignItems: "center", gap: 2 }}>
                        <Icon name="hash" size={13} color={colors.muted} />
                        <EmojiText style={{ ...typography.caption, color: colors.text, flexShrink: 1 }} numberOfLines={1}>
                          {channel.name}
                        </EmojiText>
                      </View>
                      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: "hidden" }}>
                        <View style={{ width: `${(channel.count / max) * 100}%`, height: "100%", borderRadius: 4, backgroundColor: colors.brand }} />
                      </View>
                      <Text style={{ ...typography.caption, color: colors.muted, width: 44, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                        {channel.count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: number; hint?: string }) {
  return (
    <View
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: radii.bento,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Icon name={icon} size={13} color={colors.muted} />
        <Text style={{ ...typography.overline, color: colors.muted }}>{label.toLocaleUpperCase("tr-TR")}</Text>
      </View>
      <Text style={{ ...typography.display, ...fw(800), color: colors.bright, marginTop: 2, fontVariant: ["tabular-nums"] }}>{value}</Text>
      {hint ? <Text style={{ ...typography.caption, color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radii.bento,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
      }}
    >
      <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
      {children}
    </View>
  );
}

/** Basit çubuk grafiği (web `Bars` gibi, 30 gün, en yüksek değere göre). */
function Bars({ points, color }: { points: DayPoint[]; color: string }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <View style={{ height: 96, flexDirection: "row", alignItems: "flex-end", gap: 2 }} accessibilityRole="image">
      {points.map((point) => (
        <View
          key={point.day}
          accessibilityLabel={`${point.day}: ${point.value}`}
          style={{ flex: 1, height: `${Math.max(1, (point.value / max) * 100)}%`, borderRadius: 2, backgroundColor: color, opacity: point.value ? 1 : 0.25 }}
        />
      ))}
    </View>
  );
}
