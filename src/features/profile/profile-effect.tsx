import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { PROFILE_EFFECTS } from "@/lib/profile-extras";

/**
 * Mağaza profil efekti — afişin üstünde süzülen emoji parçacıkları (web
 * `ProfileEffectOverlay`). Konumlar sabit yuvalardan gelir, her açılışta
 * aynı; hareket azaltma açıksa parçacıklar yerinde durur.
 */
const SLOTS = [8, 22, 37, 51, 64, 78, 91];

export function ProfileEffectOverlay({ id, height }: { id: string | null | undefined; height: number }) {
  const particles = id ? PROFILE_EFFECTS[id] : undefined;
  if (!particles) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {SLOTS.map((left, index) => (
        <Particle
          key={left}
          glyph={particles[index % particles.length]}
          left={left}
          height={height}
          delay={((index * 0.61) % 4.2) * 1000}
          duration={(3.6 + (index % 3) * 0.5) * 1000}
        />
      ))}
    </View>
  );
}

function Particle({
  glyph,
  left,
  height,
  delay,
  duration,
}: {
  glyph: string;
  left: number;
  height: number;
  delay: number;
  duration: number;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [delay, duration, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    // Afişin altından üstüne süzülür; başta ve sonda solar.
    transform: [{ translateY: height - progress.value * (height + 20) }],
    opacity: progress.value < 0.15 ? progress.value / 0.15 : progress.value > 0.85 ? (1 - progress.value) / 0.15 : 1,
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: `${left}%`, top: 0 }, style]}>
      <Text style={{ fontSize: 14, lineHeight: 18 }}>{glyph}</Text>
    </Animated.View>
  );
}
