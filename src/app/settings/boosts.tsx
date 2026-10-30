import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ApiError } from "@/api/client";
import { useApplyBoost, useCancelBoost, useMyBoosts, useTransferBoost, type BoostSlot, type BoostSource } from "@/api/hooks";
import { Avatar, Button, ErrorState, Icon, Screen, ScreenLoader, showToast } from "@/components/ui";
import { BoostBuySection, openStoreBoostSubscription } from "@/features/server-boost/boost-buy";
import { BoostServerPicker } from "@/features/server-boost/boost-ui";
import { formatDate } from "@/lib/format";
import { useT, type MessageKey } from "@/lib/i18n";
import { IAP_ENABLED, PURCHASES_ENABLED } from "@/lib/purchases";
import { BOOST_PINK, boosterTenureLabel } from "@/lib/server-boost";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const SOURCE_KEY: Record<BoostSource, MessageKey> = {
  MENTOL: "serverBoost.mine.sourceMentol",
  PURCHASE: "serverBoost.mine.sourcePurchase",
  STORE: "serverBoost.mine.sourceStore",
};

/**
 * Ayarlar → Sunucu Takviyesi ("Takviyelerim") — web
 * `settings/settings-boosts-tab` karşılığı (Discord Kullanıcı Ayarları →
 * Sunucu Takviyesi).
 *
 * Slotlar önce uygulananlar (sunucu adı/ikonu), sonra boştakiler. Boştaki
 * slot bir sunucuya uygulanır, uygulanmış olan 7 günlük bekleme bitince
 * aktarılır; yalnızca web'de satın alınmış (PURCHASE) takviye burada iptal
 * edilir — mağaza takviyesi mağazanın abonelik ayarlarından, Mentol
 * takviyesi Mentol aboneliğiyle biter.
 */
export default function MyBoostsScreen() {
  const t = useT();
  const boosts = useMyBoosts();
  const apply = useApplyBoost();
  const transfer = useTransferBoost();
  const cancel = useCancelBoost();
  /** Sunucu seçicisi hangi slot için açık (uygula ya da aktar). */
  const [picking, setPicking] = useState<BoostSlot | null>(null);

  const failed = (error: unknown) =>
    showToast(error instanceof ApiError && error.message ? error.message : t("serverBoost.actions.failed"), "error");

  const onPick = (slot: BoostSlot, serverId: string) => {
    if (slot.server) {
      transfer.mutate({ boostId: slot.id, serverId }, { onSuccess: () => showToast(t("serverBoost.actions.transferred")), onError: failed });
    } else {
      apply.mutate({ serverId, boostIds: [slot.id] }, { onSuccess: () => showToast(t("serverBoost.actions.applied")), onError: failed });
    }
  };

  const toggleCancel = (slot: BoostSlot) => {
    const canceled = !slot.canceledAt;
    cancel.mutate(
      { boostId: slot.id, canceled },
      { onSuccess: () => showToast(t(canceled ? "serverBoost.actions.canceled" : "serverBoost.actions.uncanceled")), onError: failed }
    );
  };

  if (boosts.isLoading) return <ScreenLoader />;
  if (boosts.isError || !boosts.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("serverBoost.title") }} />
        <ErrorState message={t("serverBoost.mobile.loadFailed")} onRetry={() => void boosts.refetch()} />
      </Screen>
    );
  }

  const data = boosts.data;
  const applied = data.slots.filter((slot) => slot.server);
  const unused = data.slots.filter((slot) => !slot.server);
  const ordered = [...applied, ...unused];
  const hasStoreSlot = data.slots.some((slot) => slot.source === "STORE");
  const busy = apply.isPending || transfer.isPending || cancel.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ title: t("serverBoost.title") }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}
        refreshControl={<RefreshControl refreshing={boosts.isRefetching} onRefresh={() => void boosts.refetch()} tintColor={colors.muted} />}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.title, color: colors.bright }}>{t("serverBoost.mine.title")}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverBoost.mine.description")}</Text>
        </View>

        {data.includedBoosts > 0 || (PURCHASES_ENABLED && data.discount > 0) || data.boosterTenureMonths !== null ? (
          <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.panel }}>
            {data.includedBoosts > 0 ? <InfoLine text={t("serverBoost.mine.mentolIncluded", { count: data.includedBoosts })} /> : null}
            {/* İndirim yalnızca web fiyatına uygulanır; iOS'ta dışarıdaki satın almadan söz edilmez (lib/purchases). */}
            {PURCHASES_ENABLED && data.discount > 0 ? <InfoLine text={t("serverBoost.mine.discount", { percent: data.mentolDiscountPercent })} /> : null}
            {data.boosterTenureMonths !== null ? (
              <InfoLine text={t("serverBoost.mine.tenure", { label: boosterTenureLabel(data.boosterTenureMonths) })} />
            ) : null}
          </View>
        ) : null}

        {ordered.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverBoost.mine.empty")}</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {ordered.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                busy={busy}
                onPickServer={() => setPicking(slot)}
                onToggleCancel={() => toggleCancel(slot)}
              />
            ))}
          </View>
        )}

        <BoostBuySection hasStoreSlot={hasStoreSlot} variant={ordered.length > 0 ? "secondary" : "primary"} />
      </ScrollView>

      <BoostServerPicker
        visible={picking !== null}
        excludeServerId={picking?.server?.id ?? null}
        onClose={() => setPicking(null)}
        onPick={(serverId) => {
          if (picking) onPick(picking, serverId);
        }}
      />
    </Screen>
  );
}

function InfoLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
      <Icon name="gem" size={14} color={BOOST_PINK} />
      <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>{text}</Text>
    </View>
  );
}

function SlotCard({
  slot,
  busy,
  onPickServer,
  onToggleCancel,
}: {
  slot: BoostSlot;
  busy: boolean;
  onPickServer: () => void;
  onToggleCancel: () => void;
}) {
  const t = useT();
  const coolingDown = Boolean(slot.cooldownUntil && !slot.available);
  const lines: { text: string; tone?: string }[] = [];
  if (coolingDown && slot.cooldownUntil) lines.push({ text: t("serverBoost.mine.cooldown", { date: formatDate(slot.cooldownUntil) }) });
  if (slot.canceledAt && slot.expiresAt) lines.push({ text: t("serverBoost.mine.endsAt", { date: formatDate(slot.expiresAt) }), tone: colors.warning });
  else if (slot.expiresAt) lines.push({ text: t("serverBoost.mine.expires", { date: formatDate(slot.expiresAt) }) });

  return (
    <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {slot.server ? (
          <Avatar imageUrl={slot.server.imageUrl} fallbackText={slot.server.name} size={40} shape="squircle" backgroundColor={colors.bento} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}>
            <Icon name="gem" size={20} color={BOOST_PINK} />
          </View>
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ ...typography.bodyStrong, color: slot.server ? colors.bright : colors.muted }} numberOfLines={1}>
            {slot.server ? slot.server.name : t("serverBoost.mine.unused")}
          </Text>
          <Text style={{ ...typography.caption, ...fw(600), color: BOOST_PINK }}>{t(SOURCE_KEY[slot.source])}</Text>
        </View>
      </View>
      {lines.map((line) => (
        <Text key={line.text} style={{ ...typography.caption, color: line.tone ?? colors.muted }}>
          {line.text}
        </Text>
      ))}
      {slot.source === "STORE" ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverBoost.mobile.storeCancelHint")}</Text> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Button
          label={slot.server ? t("serverBoost.actions.transfer") : t("serverBoost.mobile.applyToServer")}
          variant={slot.server ? "secondary" : "primary"}
          disabled={busy || !slot.available}
          onPress={onPickServer}
        />
        {slot.source === "PURCHASE" ? (
          <Button
            label={slot.canceledAt ? t("serverBoost.actions.uncancel") : t("serverBoost.actions.cancel")}
            variant={slot.canceledAt ? "secondary" : "ghost"}
            disabled={busy}
            onPress={onToggleCancel}
          />
        ) : null}
        {slot.source === "STORE" && IAP_ENABLED ? (
          <Button
            label={t("serverBoost.mobile.manageStore")}
            variant="ghost"
            onPress={() => openStoreBoostSubscription(() => showToast(t("serverBoost.actions.failed"), "error"))}
          />
        ) : null}
      </View>
    </View>
  );
}
