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

import { TurkiyeEmblem } from "@/components/ui/turkiye-emblem";
import { PROFILE_EFFECTS } from "@/lib/profile-extras";
import { useScreenActive } from "@/lib/use-screen-active";

/**
 * Mağaza profil efekti — afişin üstünde süzülen emoji parçacıkları (web
 * `ProfileEffectOverlay`). Konumlar sabit yuvalardan gelir, her açılışta
 * aynı; hareket azaltma açıksa parçacıklar yerinde durur.
 */
const SLOTS = [8, 22, 37, 51, 64, 78, 91];

export function ProfileEffectOverlay({ id, height }: { id: string | null | undefined; height: number }) {
  // Ekran arkada ya da uygulama arka plandayken parçacıklar durur.
  const active = useScreenActive();
  const particles = id ? PROFILE_EFFECTS[id] : undefined;
  if (!particles) return null;
  if (id === "fx_turkiye") return <TurkiyeEffect height={height} paused={!active} />;
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
          paused={!active}
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
  paused,
}: {
  glyph: string;
  left: number;
  height: number;
  delay: number;
  duration: number;
  paused: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion || paused) return;
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [delay, duration, paused, progress, reduceMotion]);

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

/**
 * Al Bayrak (web ): kırmızı ipek katmanı, sağda nefes alan
 * ay-yıldız ve yanıp sönen beyaz yıldızlar. Hareket azaltmada durağan.
 */
const FLAG_STARS = [
  { left: 9, top: 0.24, size: 9, delay: 0 },
  { left: 23, top: 0.7, size: 7, delay: 1100 },
  { left: 38, top: 0.3, size: 8, delay: 2300 },
  { left: 52, top: 0.74, size: 6, delay: 600 },
  { left: 61, top: 0.18, size: 7, delay: 1800 },
];

function TurkiyeEffect({ height, paused }: { height: number; paused: boolean }) {
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || paused) return;
    breathe.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [breathe, paused, reduceMotion]);
  const emblemStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-3 + breathe.value * 5}deg` }, { scale: 1 + breathe.value * 0.06 }],
  }));
  const emblemHeight = Math.min(120, height * 0.72);

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(227, 10, 23, 0.74)" }} />
      {FLAG_STARS.map((star) => (
        <Twinkle
          key={star.left}
          left={star.left}
          top={star.top * height}
          size={star.size}
          delay={star.delay}
          paused={paused}
        />
      ))}
      <Animated.View
        style={[
          { position: "absolute", right: "9%", top: (height - emblemHeight) / 2, shadowColor: "#fff", shadowOpacity: 0.7, shadowRadius: 6 },
          emblemStyle,
        ]}
      >
        <TurkiyeEmblem width={emblemHeight * (76 / 56)} height={emblemHeight} />
      </Animated.View>
    </View>
  );
}

function Twinkle({
  left,
  top,
  size,
  delay,
  paused,
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
  paused: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion || paused) return;
    pulse.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [delay, paused, pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: 0.15 + pulse.value * 0.85, transform: [{ scale: 0.6 + pulse.value * 0.55 }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: `${left}%`, top }, style]}>
      <Text style={{ color: "#fff", fontSize: size, lineHeight: size + 2 }}>✦</Text>
    </Animated.View>
  );
}
