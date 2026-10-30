import { Text, View } from "react-native";

import { Icon, Pressable } from "@/components/ui";
import { activityButtons, type ButtonSource } from "@/lib/activity-party";
import { openGuardedLink } from "@/lib/external-link";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Discord uyumlu etkinlik düğmeleri (en çok 2; ciklet-web
 * components/activity ile aynı kural) — programın verdiği bağlantılar.
 *
 * Yalnızca BAŞKASININ etkinliğinde çizilir (Discord gibi; çağıran karar
 * verir). Adres lib/activity-party'den geçer (yalnızca https) ve Ciklet
 * dışına çıktığı için "Ciklet'ten ayrılıyorsun" onayıyla açılır
 * (lib/external-link). "Katıl" mobilde yok: oyun bilgisayarda çalışıyor.
 *
 * Kart dokununca yanıt sayfasını açıyor; düğmeler iç içe Pressable —
 * dokunuşu kendileri alır, karta geçmez.
 */
export function ActivityButtons({
  activity,
  compact = false,
}: {
  activity: ButtonSource | null | undefined;
  compact?: boolean;
}) {
  const buttons = activityButtons(activity);
  if (buttons.length === 0) return null;
  return (
    <View style={{ marginTop: spacing.sm, gap: compact ? 4 : 6 }}>
      {buttons.map((button, index) => (
        <Pressable
          key={`${index}:${button.url}`}
          onPress={() => openGuardedLink(button.url)}
          haptic="light"
          noHitSlop
          accessibilityRole="link"
          accessibilityLabel={button.label}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: compact ? 5 : 8,
            paddingHorizontal: spacing.sm,
            borderRadius: radii.md,
            borderCurve: "continuous",
            backgroundColor: colors.raised,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{ flexShrink: 1, fontSize: compact ? 12 : 13, lineHeight: compact ? 16 : 18, ...fw(700), color: colors.bright }}
            numberOfLines={1}
          >
            {button.label}
          </Text>
          <Icon name="arrow-up-right" size={compact ? 13 : 15} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}
