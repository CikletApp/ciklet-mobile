import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/** Noktalar arası gecikme; her noktanın periyodu aynı, dalga fazda kalır. */
const STAGGER_MS = 160;

/**
 * "Yazıyor" noktaları — üç nokta sırayla zıplar (klasik dalga).
 *
 * Renk prop olarak gelir: `colors` bir JS Proxy'si, UI iş parçacığındaki
 * animasyon kodundan okunamaz. Kap sabit yükseklikte; zıplama düzeni
 * oynatmaz ve kırpılmaz. Hareket azaltma açıksa yalnızca yavaş solma.
 */
export function TypingDots({
  color,
  size = 7,
  gap = 4,
  distance = 4,
}: {
  color: string;
  size?: number;
  gap?: number;
  distance?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", alignItems: "flex-end", gap, height: size + distance }}
    >
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} color={color} size={size} distance={distance} />
      ))}
    </View>
  );
}

function Dot({ index, color, size, distance }: { index: number; color: string; size: number; distance: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    const up = reduced ? 600 : 300;
    // Hareket azaltma burada elle uygulanıyor (zıplama yok, yalnızca solma).
    // Varsayılan `System` sonsuz tekrarı tek karede bitirip noktaları
    // donuk bırakırdı.
    const never = ReduceMotion.Never;
    t.set(
      withDelay(
        index * STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(1, { duration: up, easing: Easing.out(Easing.quad), reduceMotion: never }),
            withTiming(0, { duration: up, easing: Easing.in(Easing.quad), reduceMotion: never }),
            withTiming(0, { duration: reduced ? 0 : 420, reduceMotion: never })
          ),
          -1,
          false,
          undefined,
          never
        ),
        never
      )
    );
    return () => cancelAnimation(t);
  }, [index, reduced, t]);

  const animated = useAnimatedStyle(() => {
    const value = t.get();
    return {
      opacity: 0.35 + 0.65 * value,
      transform: [{ translateY: reduced ? 0 : -distance * value }],
    };
  }, [reduced, distance]);

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animated]}
    />
  );
}
