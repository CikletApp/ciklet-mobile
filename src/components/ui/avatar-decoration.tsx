import { useEffect, useId } from "react";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from "react-native-svg";

import { findDecoration } from "@/lib/avatar-decorations";
import { useScreenActive } from "@/lib/use-screen-active";

import { TurkiyeEmblem } from "./turkiye-emblem";

/**
 * Avatar süsü halkası — web'deki `AvatarDecorationRing` karşılığı.
 *
 * Avatarın ÜSTÜNE, dışa taşan mutlak bir katman olarak çizilir; yerleşimi
 * etkilemez (avatar kutusu aynı boyutta kalır, halka kenardan taşar). Bu
 * sayede listelerde satır yüksekliği süs takan kişide değişmez.
 */
export function AvatarDecorationRing({ id, size }: { id: string | null | undefined; size: number }) {
  const deco = findDecoration(id);
  // Halka kalınlığı avatarla ölçeklenir; küçük avatarda 2 px altına inmez.
  const stroke = Math.max(2, Math.round(size * 0.06));
  const outer = size + stroke * 2;
  const gradientId = `deco-${useId().replace(/:/g, "")}`;
  const reduceMotion = useReducedMotion();
  const screenActive = useScreenActive();
  const rotation = useSharedValue(0);
  // Dönüş yalnızca görünür ekranda ve okunur boyutta: küçük avatarlarda
  // (liste satırları) fark edilmiyor ama her biri kare başına iş üretiyordu.
  const spin = Boolean(deco?.spin) && !reduceMotion && screenActive && size >= 32;

  useEffect(() => {
    if (!spin) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [spin, rotation]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (!deco) return null;
  const stops = deco.colors.map((color, index) => (
    <Stop key={`${color}-${index}`} offset={deco.colors.length === 1 ? 0 : index / (deco.colors.length - 1)} stopColor={color} />
  ));
  // Rozet çok küçük avatarlarda okunmuyor ve ada biniyor; yalnızca halka kalır.
  const showBadge = Boolean(deco.badge) && size >= 32;
  const showEmblem = deco.emblem === "ayyildiz" && size >= 32;
  const emblemSize = Math.round(size * 0.4);

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: -stroke, top: -stroke, width: outer, height: outer }}
    >
      <Animated.View style={[{ width: outer, height: outer }, spinStyle]}>
        <Svg width={outer} height={outer}>
          <Defs>
            {deco.radial ? (
              <RadialGradient id={gradientId} cx="30%" cy="30%" r="80%">
                {stops}
              </RadialGradient>
            ) : (
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                {stops}
              </LinearGradient>
            )}
          </Defs>
          <Circle
            cx={outer / 2}
            cy={outer / 2}
            r={(outer - stroke) / 2}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            fill="none"
          />
        </Svg>
      </Animated.View>
      {showEmblem ? (
        // Kırmızı rozetin içinde ay-yıldız (web ile aynı yerleşim).
        <View
          style={{
            position: "absolute",
            right: -Math.round(size * 0.06),
            top: -Math.round(size * 0.06),
            width: emblemSize,
            height: emblemSize,
            borderRadius: emblemSize / 2,
            backgroundColor: "#e30a17",
            borderWidth: 1.5,
            borderColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TurkiyeEmblem width={emblemSize * 0.62} height={emblemSize * 0.46} />
        </View>
      ) : showBadge ? (
        <Text
          style={{
            position: "absolute",
            right: -2,
            top: -4,
            fontSize: Math.max(11, Math.round(size * 0.26)),
            lineHeight: Math.max(13, Math.round(size * 0.3)),
          }}
        >
          {deco.badge}
        </Text>
      ) : null}
    </View>
  );
}
