import { ActivityIndicator, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { colors, radii } from "@/theme/tokens";
import { CikletLogo } from "./ciklet-logo";

/** Bento yüzeyinin gerçek merkezinde duran marka-duyarlı yenileme rozeti. */
export function ModernRefreshIndicator({ visible, top = 116 }: { visible: boolean; top?: number }) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutUp.duration(140)}
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top, zIndex: 20, alignItems: "center" }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.raised,
          shadowColor: colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 8,
        }}
      >
        <ActivityIndicator color={colors.brand} size={46} style={{ position: "absolute" }} />
        <CikletLogo height={6} color={colors.bright} />
      </View>
    </Animated.View>
  );
}
