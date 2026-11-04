import { Text, View } from "react-native";
import { Image } from "expo-image";

import type { GameStatsCardView, GameStatView } from "@/api/types";
import { Icon } from "@/components/ui";
import { resolveMediaUrl } from "@/lib/config";
import { useLocale, useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/** "Onaylı" oyun rozeti (web components/profile/game-stats-cards VerifiedGameBadge). */
export function VerifiedGameBadge({ size = 13 }: { size?: number }) {
  const t = useT();
  return (
    <View accessible accessibilityLabel={t("gameStats.verified.label")}>
      <Icon name="badge-check" size={size} color="#34d399" />
    </View>
  );
}

function statLabel(field: GameStatView, locale: string): string {
  const loc = field.nameLocalizations;
  if (!loc) return field.name;
  return loc[locale] ?? loc[locale.split("-")[0] ?? ""] ?? field.name;
}

function statValue(field: GameStatView, locale: string): string {
  if (field.type === 1) return new Intl.NumberFormat(locale).format(Number(field.value));
  if (field.type === 3) return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(field.value)));
  return String(field.value);
}

/**
 * Profil › Oyun İstatistikleri (web `GameStatsCards` ile aynı düzen): başlıkta
 * oyun (onaylıysa rozetle) ya da uygulama, altında alanlar iki sütunda.
 */
export function GameStatsCards({ cards }: { cards: GameStatsCardView[] }) {
  const t = useT();
  const locale = useLocale();
  return (
    <View style={{ gap: spacing.sm }}>
      {cards.map((card) => {
        const title = card.game?.name ?? card.application.name;
        const icon = resolveMediaUrl(card.game?.iconUrl ?? card.application.iconUrl);
        return (
          <View key={card.application.id} style={{ borderRadius: radii.md, backgroundColor: colors.raised, padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: radii.sm, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.panel }}>
                {icon ? <Image source={{ uri: icon }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="gamepad" size={16} color={colors.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
                    {title}
                  </Text>
                  {card.game?.verified ? <VerifiedGameBadge /> : null}
                </View>
                {card.game ? (
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                    {t("gameStats.card.by", { app: card.application.name })}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs }}>
              {card.fields.map((field) => (
                <View key={field.key} style={{ width: "50%", paddingRight: spacing.sm }}>
                  <Text style={{ fontSize: 10.5, ...fw(700), color: colors.muted, letterSpacing: 0.4 }} numberOfLines={1}>
                    {statLabel(field, locale).toLocaleUpperCase(locale)}
                  </Text>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                    {statValue(field, locale)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
