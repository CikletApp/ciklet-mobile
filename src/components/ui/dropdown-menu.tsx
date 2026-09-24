import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radii, spacing, typography } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";

export interface MenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * Köşedeki bir düğmeden açılan menü — web'deki açılır menülerin dili
 * (`components/ui/dropdown-menu.tsx`): yuvarlak kart, içinde yuvarlak
 * satırlar, ince kenarlık ve yumuşak gölge.
 *
 * Konum ekranın üst köşesine göre verilir (başlık düğmeleri hep orada);
 * dokunulan öğenin ölçümüne gerek kalmıyor.
 */
export function DropdownMenu({
  visible,
  onClose,
  items,
  side = "left",
}: {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  /** Menü hangi köşedeki düğmeye bağlı. */
  side?: "left" | "right";
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <RNPressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Menüyü kapat">
        <View
          style={{
            position: "absolute",
            top: insets.top + 58,
            [side]: spacing.lg,
            minWidth: 232,
            padding: 6,
            gap: 2,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            boxShadow: `0 12px 32px ${colors.shadow}`,
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              noHitSlop
              accessibilityRole="menuitem"
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 46,
                paddingHorizontal: spacing.md,
                borderRadius: radii.md + 2,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Icon name={item.icon} size={19} color={item.destructive ? colors.danger : colors.muted} />
              <Text style={{ ...typography.body, color: item.destructive ? colors.danger : colors.bright }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </RNPressable>
    </Modal>
  );
}
