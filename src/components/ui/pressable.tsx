import { forwardRef, useCallback } from "react";
import {
  Pressable as RNPressable,
  type PressableProps,
  type View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { MIN_TOUCH_TARGET } from "@/theme/tokens";

/**
 * Dokunma primitifi.
 *
 * İki şeyi tek yerde garanti eder:
 *  1. Erişilebilir dokunma hedefi — `hitSlop` varsayılan olarak 44pt'ye
 *     tamamlar. Küçük ikon düğmeleri en sık kaçırılan erişilebilirlik
 *     kuralıdır ve her çağrı yerinde elle yazılmaz.
 *  2. Dokunsal geri bildirim — `haptic` verildiğinde basınca titreşim.
 *     Yıkıcı eylemlerde ("warning") kullanıcıya farklı bir his verir.
 */

export type HapticKind = "light" | "medium" | "success" | "warning" | "error";

const HAPTIC_MAP: Record<HapticKind, () => Promise<void>> = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export interface CikletPressableProps extends PressableProps {
  haptic?: HapticKind;
  /** Dokunma hedefini 44pt'ye tamamlayan hitSlop eklenmesin. */
  noHitSlop?: boolean;
}

export const Pressable = forwardRef<View, CikletPressableProps>(function Pressable(
  { haptic, noHitSlop, onPress, hitSlop, ...rest },
  ref
) {
  const handlePress = useCallback<NonNullable<PressableProps["onPress"]>>(
    (event) => {
      if (haptic) {
        // Titreşim başarısız olursa (izin yok, emülatör) eylemi engelleme.
        void HAPTIC_MAP[haptic]().catch(() => {});
      }
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <RNPressable
      ref={ref}
      onPress={handlePress}
      hitSlop={hitSlop ?? (noHitSlop ? undefined : DEFAULT_HIT_SLOP)}
      {...rest}
    />
  );
});

/** 24pt'lik bir ikonu 44pt hedefe tamamlar. */
const DEFAULT_HIT_SLOP = Math.round((MIN_TOUCH_TARGET - 24) / 2);
