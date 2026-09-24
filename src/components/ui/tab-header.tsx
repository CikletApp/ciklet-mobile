import { Text, View } from "react-native";

import { fw } from "@/theme/fonts";
import { colors, spacing } from "@/theme/tokens";
import { IconButton } from "./button";
import type { IconName } from "./icon";

/**
 * Sekme ekranlarının başlığı: üstte yuvarlak eylem düğmeleri, altında büyük
 * başlık. Mesajlaşma uygulamalarındaki alışılmış düzen — kullanıcı hangi
 * sekmede olduğunu başlıktan, ne yapabileceğini köşedeki düğmelerden okur.
 *
 * Başlık tek satır ve kalın; logo yerine sekmenin adı. Marka zaten sekme
 * çubuğunda ve renklerde; her ekranda logo tekrar etmek yer yiyordu.
 */
export function TabHeader({
  title,
  left,
  right,
  children,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Başlığın altındaki içerik (arama, çipler). */
  children?: React.ReactNode;
}) {
  return (
    <View style={{ paddingTop: spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 48,
          paddingHorizontal: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>{left}</View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>{right}</View>
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          fontSize: 32,
          lineHeight: 40,
          ...fw(800),
          letterSpacing: -0.6,
          color: colors.bright,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.xs,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Başlıktaki yuvarlak düğme. `accent` birincil eylem içindir (yeni sohbet,
 * yeni sunucu); ekranda en fazla bir tane olmalı.
 */
export function HeaderButton({
  icon,
  label,
  onPress,
  accent = false,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <IconButton
      icon={icon}
      label={label}
      size={44}
      background={accent ? colors.brand : colors.panel}
      tint={accent ? colors.onBrand : colors.bright}
      onPress={onPress}
      disabled={disabled}
      haptic={accent ? "medium" : "light"}
    />
  );
}
