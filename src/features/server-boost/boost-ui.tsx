import { Text, View } from "react-native";

import { useMyServers } from "@/api/hooks";
import { Icon, Pressable, showToast } from "@/components/ui";
import { ChoiceSheet } from "@/features/server/settings-form";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { BOOST_PINK, boostProgress, normalizePremiumTier } from "@/lib/server-boost";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Takviyesi'nin küçük ortak parçaları — web
 * `components/server-boost/*` karşılıkları (pembe taş #ff73fa).
 */

/**
 * Takviyeci rozeti — üye listesinde adın yanında pembe taş (web
 * `BoosterGem`). Web'deki ipucu yerine basılı tutunca aynı metin.
 */
export function BoosterGem({ since, size = 14 }: { since: string | null | undefined; size?: number }) {
  const t = useT();
  if (!since) return null;
  const label = t("serverBoost.badge.boosterSince", { date: formatDate(since) });
  return (
    <Pressable
      onLongPress={() => showToast(label)}
      noHitSlop
      accessibilityRole="image"
      accessibilityLabel={t("serverBoost.badge.booster")}
      accessibilityHint={label}
      style={{ marginLeft: 4 }}
    >
      <Icon name="gem" size={size} color={BOOST_PINK} />
    </Pressable>
  );
}

/**
 * Emoji / çıkartma / ses listelerindeki yuva notu: "Seviye 1 · 100 yuva";
 * sınırın üstündeyse (seviye düşmüş) uyarı (web `BoostSlotsHint`).
 */
export function BoostSlotsHint({ tier, used, max }: { tier: number | null | undefined; used: number; max: number }) {
  const t = useT();
  const level = normalizePremiumTier(tier);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="gem" size={14} color={BOOST_PINK} />
        <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>
          {t("serverBoost.settings.slots", { tier: level, max })}
        </Text>
      </View>
      {used > max ? (
        <Text
          style={{
            ...typography.caption,
            fontSize: 12,
            color: colors.warning,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radii.md,
            backgroundColor: colors.raised,
          }}
        >
          {t("serverBoost.settings.overLimit")}
        </Text>
      ) : null}
    </View>
  );
}

/** "Seviye 2 gerekir" kilit hapı (Sunucu Ayarları). */
export function BoostLockedPill({ tier }: { tier: number }) {
  const t = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: colors.scrim,
      }}
    >
      <Icon name="gem" size={12} color={BOOST_PINK} />
      <Text style={{ ...typography.caption, fontSize: 12, ...fw(600), color: "#ffffff" }}>
        {t("serverBoost.settings.locked", { tier })}
      </Text>
    </View>
  );
}

/** Pembe ilerleme çubuğu (oran 0–1). */
export function BoostBar({ ratio, height = 6 }: { ratio: number; height?: number }) {
  const t = useT();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t("serverBoost.progress.barLabel")}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: radii.full, backgroundColor: colors.raised, overflow: "hidden" }}
    >
      <View style={{ width: `${clamped * 100}%`, height: "100%", borderRadius: radii.full, backgroundColor: BOOST_PINK }} />
    </View>
  );
}

/**
 * Sunucu kartındaki ince takviye ilerlemesi (web kenar çubuğu
 * `ServerBoostBar`): "Seviye N" + çubuk + sonraki seviyeye kalan. Dokununca
 * takviye ekranı. Yalnızca `premiumProgressBarEnabled` açıkken çizilir.
 */
export function ServerBoostProgress({
  tier,
  count,
  onPress,
}: {
  tier: number | null | undefined;
  count: number | null | undefined;
  onPress: () => void;
}) {
  const t = useT();
  const level = normalizePremiumTier(tier);
  const progress = boostProgress(count ?? 0);
  const caption = progress.next === null ? t("serverBoost.progress.max") : t("serverBoost.progress.toNext", { tier: progress.next, count: progress.needed });
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${t("serverBoost.title")}: ${level > 0 ? t("serverBoost.level", { tier: level }) : t("serverBoost.noLevel")}, ${caption}`}
      style={({ pressed }) => ({
        alignSelf: "stretch",
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="gem" size={14} color={BOOST_PINK} />
        <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>
          {level > 0 ? t("serverBoost.level", { tier: level }) : t("serverBoost.noLevel")}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1, textAlign: "right" }} numberOfLines={1}>
          {caption}
        </Text>
      </View>
      <BoostBar ratio={progress.ratio} height={4} />
    </Pressable>
  );
}

/** "Hangi sunucuya?" — kullanıcının sunucuları (uygula / aktar). */
export function BoostServerPicker({
  visible,
  excludeServerId,
  onClose,
  onPick,
}: {
  visible: boolean;
  excludeServerId?: string | null;
  onClose: () => void;
  onPick: (serverId: string) => void;
}) {
  const t = useT();
  const { servers } = useMyServers();
  const options = servers
    .filter((server) => server.id !== excludeServerId)
    .map((server) => ({ id: server.id, label: server.name }));
  return (
    <ChoiceSheet
      visible={visible}
      title={t("serverBoost.actions.pickServer")}
      options={options}
      selected={[]}
      onClose={onClose}
      onPick={(id) => {
        onClose();
        onPick(id);
      }}
      empty={t("serverBoost.mobile.noServers")}
    />
  );
}
