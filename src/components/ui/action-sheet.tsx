import { useRef, type ReactNode } from "react";
import { Modal, Platform, Pressable as RNPressable, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: IconName;
  /** Etiketin altındaki açıklama satırı. */
  detail?: string;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Alttan açılan eylem listesi — basılı tutma menüleri için (WhatsApp düzeni).
 *
 * Seçilen eylem sayfa kapandıktan SONRA çalışır: iOS iki RN Modal'ı aynı
 * anda sunamıyor; sayfa kapanırken açılan bir onay diyaloğu (DialogHost da
 * bir Modal) hiç görünmüyordu. iOS'ta `onDismiss` beklenir, Android'de
 * hemen çalışır.
 */
export function ActionSheet({
  visible,
  onClose,
  header,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  header?: ReactNode;
  items: (ActionSheetItem | "separator")[];
}) {
  const insets = useSafeAreaInsets();
  const pending = useRef<(() => void) | null>(null);

  const flush = () => {
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  const choose = (item: ActionSheetItem) => {
    pending.current = item.onPress;
    onClose();
    if (Platform.OS === "ios") {
      // `onDismiss` gelmezse eylem kaybolmasın.
      setTimeout(flush, 700);
    } else {
      flush();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={flush}
    >
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <Animated.View
          entering={SlideInDown.duration(200)}
          style={{
            marginHorizontal: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: 6,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            boxShadow: `0 18px 48px ${colors.shadow}`,
          }}
        >
          {/* Kartın içine dokunmak arka plana geçip sayfayı kapatmasın. */}
          <RNPressable onPress={() => undefined} accessible={false}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: radii.full,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginVertical: spacing.sm,
              }}
            />
            {header ? (
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingBottom: spacing.md,
                  marginBottom: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {header}
              </View>
            ) : null}
            {items.map((item, index) =>
              item === "separator" ? (
                <View
                  key={`sep-${index}`}
                  style={{ height: 1, marginVertical: 6, marginHorizontal: spacing.md, backgroundColor: colors.border }}
                />
              ) : (
                <Pressable
                  key={item.key}
                  noHitSlop
                  haptic={item.destructive ? undefined : "light"}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityHint={item.detail}
                  onPress={() => choose(item)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    minHeight: 52,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 6,
                    borderRadius: radii.lg,
                    borderCurve: "continuous",
                    backgroundColor: pressed ? colors.raised : "transparent",
                  })}
                >
                  <Icon name={item.icon} size={21} color={item.destructive ? colors.danger : colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, ...fw(500), color: item.destructive ? colors.danger : colors.bright }}>
                      {item.label}
                    </Text>
                    {item.detail ? (
                      <Text style={{ ...typography.caption, color: colors.muted }}>{item.detail}</Text>
                    ) : null}
                  </View>
                </Pressable>
              )
            )}
          </RNPressable>
        </Animated.View>
      </RNPressable>
    </Modal>
  );
}
