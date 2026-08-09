import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { Pressable, type HapticKind } from "./pressable";

/**
 * Düğme.
 *
 * Dört varyant, tek bir kural: birincil eylem ekranda **en fazla bir tane**
 * olur. `danger` yıkıcı eylemler içindir ve varsayılan olarak uyarı
 * titreşimi verir — kullanıcı dokunduğunda geri dönülmez bir şey yaptığını
 * hisseder.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Satırda tüm genişliği kaplasın. */
  fullWidth?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  // Tema rengi render anında okunur. Modül seviyesindeki sabit bir nesne
  // renkleri ilk temaya kilitler ve tema değişiminde karışık palet üretir.
  const palette = variantPalette(inactive ? "disabled" : variant);
  const height = size === "lg" ? 52 : MIN_TOUCH_TARGET;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      haptic={inactive ? undefined : (haptic ?? DEFAULT_HAPTIC[variant])}
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          height,
          paddingHorizontal: spacing.xl,
          borderRadius: radii.full,
          backgroundColor: palette.bg,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
          <Text style={{ ...typography.bodyStrong, color: palette.fg }} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function variantPalette(variant: Variant | "disabled") {
  switch (variant) {
    case "primary": return { bg: colors.brand, fg: colors.onBrand, border: undefined };
    case "secondary": return { bg: colors.panel, fg: colors.bright, border: undefined };
    case "ghost": return { bg: "transparent", fg: colors.text, border: colors.border };
    case "danger": return { bg: "transparent", fg: colors.danger, border: colors.danger };
    case "disabled": return { bg: colors.raised, fg: colors.muted, border: undefined };
  }
}

const DEFAULT_HAPTIC: Record<Variant, HapticKind> = {
  primary: "light",
  secondary: "light",
  ghost: "light",
  danger: "warning",
};

/**
 * Dairesel ikon düğmesi — başlık çubuğu ve satır içi eylemler.
 */
export function IconButton({
  icon,
  onPress,
  label,
  tint = colors.text,
  background = colors.panel,
  size = 36,
  disabled,
  haptic = "light",
}: {
  icon: IconName;
  onPress?: () => void;
  /** Ekran okuyucu için — ikon düğmelerinde görünür metin yok. */
  label: string;
  tint?: string;
  background?: string;
  size?: number;
  disabled?: boolean;
  haptic?: HapticKind;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      haptic={disabled ? undefined : haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={tint} />
    </Pressable>
  );
}

/** Ekranın altına sabitlenmiş eylem çubuğu (modal formlar). */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.deep,
      }}
    >
      {children}
    </View>
  );
}
