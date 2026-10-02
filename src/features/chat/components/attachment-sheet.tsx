import { Modal, Pressable as RNPressable, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Pressable, type IconName } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "+" düğmesinin alt sayfası — WhatsApp düzeni: Galeri, Kamera, Dosya.
 *
 * Eskiden düğme doğrudan sistem dosya seçicisini açıyordu; telefonda
 * fotoğraf göndermenin birincil yolu galeri, dosya seçici onu "Belgeler"
 * görünümünün arasına gömüyordu.
 */
export type AttachmentSource = "gallery" | "camera" | "file";

const OPTIONS: { source: AttachmentSource; icon: IconName; title: string; detail: string }[] = [
  { source: "gallery", icon: "image", title: "Galeri", detail: "Fotoğraf veya video seç" },
  { source: "camera", icon: "camera", title: "Kamera", detail: "Fotoğraf çek" },
  { source: "file", icon: "file", title: "Dosya", detail: "Belge, ses ya da başka bir dosya" },
];

export function AttachmentSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (source: AttachmentSource) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
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
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center", marginVertical: spacing.sm }} />
          {OPTIONS.map((option) => (
            <Pressable
              key={option.source}
              noHitSlop
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={option.title}
              accessibilityHint={option.detail}
              onPress={() => {
                onClose();
                onPick(option.source);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: spacing.md,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.brandSoft,
                }}
              >
                <Icon name={option.icon} size={21} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, ...fw(600), color: colors.bright }}>{option.title}</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>{option.detail}</Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </RNPressable>
    </Modal>
  );
}
