import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Bento kartı — web'deki `rounded-bento-item-radius` + `bg-bento-item`
 * deseninin mobil karşılığı.
 *
 * Uygulama kabuğu artık kenardan kenara düz paneller yerine, aralarında
 * boşluk olan yuvarlatılmış kartlardan oluşuyor. Kart yüzeyi zeminden
 * ayrıldığı için okuma alanı netleşir ve ekranın kenar kavisleriyle uyumlu
 * durur.
 */
export function BentoCard({
  children,
  style,
  /** İç boşluk uygulanmasın (liste kendi boşluğunu yönetiyorsa). */
  flush,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  flush?: boolean;
}) {
  return (
    <View
      style={[
        {
          flex: 1,
          borderRadius: radii.bento,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.bento,
          overflow: "hidden",
          padding: flush ? 0 : spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Bento kabuğu — kartları taşıyan dış kap.
 *
 * Zemin web'deki `--main-bg` (#131417) ile aynı; kartlar (`--bento-item`,
 * #232428) onun üstünde bir tık AÇIK durur. Daha koyu bir zemin (theme
 * `deep`) denendi ve kabuk fazla kararıyordu.
 */
export function BentoShell({
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
          flex: 1,
          flexDirection: "row",
          gap: spacing.sm,
          padding: spacing.sm,
          backgroundColor: colors.bentoShell,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
