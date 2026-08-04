import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";

/**
 * Liste primitifleri — ayarlar, arkadaşlar, kanallar ve arama sonuçları
 * aynı satır dilini paylaşır.
 */

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
      }}
    >
      <Text style={{ ...typography.overline, color: colors.muted, flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

/** İlişkili satırları saran kart — ayarlar gruplarında kullanılır. */
export function ListGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radii.lg,
          backgroundColor: colors.panel,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Sağda gri, ikincil bilgi (ör. seçili tema adı). */
  detail?: string;
  icon?: IconName;
  iconTint?: string;
  /** Avatar gibi özel bir başlangıç öğesi. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Sağda ok göster (gezinme satırı). Varsayılan: onPress varsa evet. */
  chevron?: boolean;
  titleColor?: string;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  detail,
  icon,
  iconTint = colors.muted,
  leading,
  trailing,
  onPress,
  disabled,
  chevron,
  titleColor = colors.text,
  accessibilityHint,
}: ListRowProps) {
  const interactive = Boolean(onPress) && !disabled;
  const showChevron = chevron ?? (interactive && !trailing && !detail);

  return (
    <Pressable
      onPress={interactive ? onPress : undefined}
      disabled={!interactive}
      haptic={interactive ? "light" : undefined}
      noHitSlop
      accessibilityRole={interactive ? "button" : "text"}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: MIN_TOUCH_TARGET + 8,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      {leading ?? (icon ? <Icon name={icon} size={20} color={iconTint} /> : null)}

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: titleColor }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {detail ? (
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}

      {trailing}

      {showChevron ? (
        <Icon name="chevron-right" size={16} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}

/** Satırlar arası ince ayraç — ikonun soluna hizalı girinti bırakır. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: 1,
        marginLeft: inset,
        backgroundColor: colors.border,
      }}
    />
  );
}
