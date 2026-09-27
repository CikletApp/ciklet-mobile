import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kısa bilgi şeridi — "İndirildi" gibi, kullanıcıdan bir şey istemeyen
 * geri bildirimler için. Onay isteyen durumlar `showDialog`'dur.
 *
 * Aynı anda tek şerit; yenisi eskisinin yerini alır.
 */

interface Toast {
  id: number;
  message: string;
  tone: "default" | "error";
}

const useToasts = create<{ current: Toast | null }>(() => ({ current: null }));

let counter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, tone: Toast["tone"] = "default") {
  counter += 1;
  useToasts.setState({ current: { id: counter, message, tone } });
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => useToasts.setState({ current: null }), 2600);
}

/**
 * Kök düzende bir kez. Modal'ların içinde de kullanılabilir: Modal ayrı bir
 * pencere olduğu için kökteki şerit onun arkasında kalır.
 */
export function ToastHost() {
  const toast = useToasts((state) => state.current);
  const insets = useSafeAreaInsets();
  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 96, alignItems: "center" }}
    >
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOut.duration(180)}
        accessibilityLiveRegion="polite"
        style={{
          maxWidth: "86%",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm + 2,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: toast.tone === "error" ? colors.danger : colors.bentoBorder,
          backgroundColor: colors.panel,
          boxShadow: `0 8px 24px ${colors.shadow}`,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.bright, textAlign: "center" }}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}
