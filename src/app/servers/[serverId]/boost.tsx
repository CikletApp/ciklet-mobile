import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useApplyBoost, useMyBoosts, useServerBoost, useServerSummary, type BoostSlot } from "@/api/hooks";
import { Avatar, Button, ErrorState, Icon, Screen, ScreenLoader, showToast } from "@/components/ui";
import { BoostBuySection } from "@/features/server-boost/boost-buy";
import { BoostBar } from "@/features/server-boost/boost-ui";
import { displayNameOf, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { BOOST_PINK, BOOST_TIER_THRESHOLDS, perkRows, type PremiumTier } from "@/lib/server-boost";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const PERK_LEVELS: readonly PremiumTier[] = [1, 2, 3];

/**
 * Sunucu Takviyesi ekranı — web `modals/server-boost-modal` karşılığı
 * (sunucu menüsü → "Sunucu Takviyesi", sunucu kartındaki ilerleme çubuğu).
 *
 * Seviye + takviye sayısı, sonraki seviyeye ilerleme (ek süre notu),
 * Seviye 1–3 ayrıcalık tablosu (lib/server-boost perkRows), takviye edenler
 * ve ana düğme: boşta takviye varsa "Takviye Uygula", yoksa mağazadan
 * "Takviye Satın Al" (satın alınan takviye doğrulanınca bu sunucuya uygulanır).
 */
export default function ServerBoostScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const t = useT();
  const { data: server } = useServerSummary(serverId);
  const boost = useServerBoost(serverId);
  const mine = useMyBoosts();
  const apply = useApplyBoost();

  const applyBoosts = (input: { quantity?: number; boostIds?: string[] }) =>
    apply.mutate(
      { serverId, ...input },
      {
        onSuccess: () => showToast(t("serverBoost.actions.applied")),
        onError: (error) => showToast(error instanceof ApiError && error.message ? error.message : t("serverBoost.actions.failed"), "error"),
      }
    );

  // Mağazadan alınan yeni (boştaki) takviye doğrudan bu sunucuya uygulanır.
  const onPurchased = (slots: BoostSlot[]) => {
    const fresh = slots.find((slot) => slot.source === "STORE" && !slot.server && slot.available);
    if (fresh) applyBoosts({ boostIds: [fresh.id] });
    else showToast(t("serverBoost.mobile.purchased"));
  };

  if (boost.isLoading) return <ScreenLoader />;
  if (boost.isError || !boost.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("serverBoost.title") }} />
        <ErrorState message={t("serverBoost.mobile.loadFailed")} onRetry={() => void boost.refetch()} />
      </Screen>
    );
  }

  const data = boost.data;
  const levelLabel = data.tier > 0 ? t("serverBoost.level", { tier: data.tier }) : t("serverBoost.noLevel");
  const caption =
    data.progress.next === null
      ? t("serverBoost.progress.max")
      : t("serverBoost.progress.toNext", { tier: data.progress.next, count: data.progress.needed });
  const hasStoreSlot = (mine.data?.slots ?? []).some((slot) => slot.source === "STORE");

  return (
    <Screen>
      <Stack.Screen options={{ title: t("serverBoost.title") }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}
        refreshControl={
          <RefreshControl
            refreshing={boost.isRefetching}
            onRefresh={() => {
              void boost.refetch();
              void mine.refetch();
            }}
            tintColor={colors.muted}
          />
        }
      >
        {/* Seviye kartı */}
        <View style={{ alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
          <View style={{ borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden" }}>
            <Avatar imageUrl={server?.imageUrl} fallbackText={server?.name ?? "?"} size={64} radius={0} backgroundColor={colors.bento} />
          </View>
          {server ? (
            <Text style={{ ...typography.title, color: colors.bright, textAlign: "center" }} numberOfLines={2}>
              {server.name}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="gem" size={18} color={BOOST_PINK} />
            <Text style={{ ...typography.bodyStrong, color: BOOST_PINK }}>{levelLabel}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>· {t("serverBoost.boostCount", { count: data.count })}</Text>
          </View>
          <View style={{ alignSelf: "stretch", gap: 6, marginTop: spacing.xs }}>
            <BoostBar ratio={data.progress.ratio} height={8} />
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>{caption}</Text>
            {data.graceUntil ? (
              <Text style={{ ...typography.caption, color: colors.warning, textAlign: "center" }}>
                {t("serverBoost.progress.grace", { date: formatDate(data.graceUntil) })}
              </Text>
            ) : null}
          </View>

          <View style={{ alignSelf: "stretch", marginTop: spacing.sm }}>
            {data.me.available > 0 ? (
              <Button
                label={t("serverBoost.actions.boostAvailable", { count: data.me.available })}
                icon="gem"
                fullWidth
                size="lg"
                loading={apply.isPending}
                onPress={() => applyBoosts({ quantity: 1 })}
              />
            ) : (
              <BoostBuySection hasStoreSlot={hasStoreSlot} onVerified={onPurchased} />
            )}
          </View>
        </View>

        {/* Seviye ayrıcalıkları */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>{t("serverBoost.perks.title").toLocaleUpperCase("tr-TR")}</Text>
          {PERK_LEVELS.map((level) => {
            const unlocked = data.tier >= level;
            const current = data.tier === level;
            return (
              <View
                key={level}
                style={{
                  gap: spacing.sm,
                  padding: spacing.lg,
                  borderRadius: radii.xl,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: current ? BOOST_PINK : colors.bentoBorder,
                  backgroundColor: colors.panel,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Icon name="gem" size={16} color={unlocked ? BOOST_PINK : colors.muted} />
                  <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }}>{t("serverBoost.level", { tier: level })}</Text>
                  <Text style={{ ...typography.caption, ...fw(600), color: unlocked ? BOOST_PINK : colors.muted }}>
                    {current
                      ? t("serverBoost.perks.current")
                      : unlocked
                        ? t("serverBoost.perks.unlocked")
                        : t("serverBoost.perks.needs", { count: BOOST_TIER_THRESHOLDS[level] })}
                  </Text>
                </View>
                {perkRows(level).map((row) => (
                  <View key={row} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                    <Icon name={unlocked ? "check" : "lock"} size={14} color={unlocked ? colors.success : colors.muted} />
                    <Text style={{ ...typography.caption, color: unlocked ? colors.text : colors.muted, flex: 1 }}>{row}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Takviye edenler */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>{t("serverBoost.boosters.title").toLocaleUpperCase("tr-TR")}</Text>
          {data.boosters.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverBoost.boosters.empty")}</Text>
          ) : (
            <View style={{ borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, paddingVertical: spacing.xs }}>
              {data.boosters.map((booster) => (
                <View key={booster.profile.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                  <Avatar profileId={booster.profile.id} imageUrl={booster.profile.imageUrl} fallbackText={booster.profile.username} size={36} backgroundColor={colors.panel} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                      {displayNameOf(booster.profile)}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                      {t("serverBoost.boosters.since", { date: formatDate(booster.since) })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="gem" size={14} color={BOOST_PINK} />
                    <Text style={{ ...typography.caption, ...fw(700), color: BOOST_PINK }}>{t("serverBoost.boosters.times", { count: booster.count })}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
