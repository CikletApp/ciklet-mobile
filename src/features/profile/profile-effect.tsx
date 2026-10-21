import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";

import { TurkiyeEmblem } from "@/components/ui/turkiye-emblem";
import {
  effectFrame,
  effectParticles,
  findProfileEffect,
  type EffectParticle,
  type ProfileEffectMotion,
} from "@/lib/profile-effects";
import { useScreenActive } from "@/lib/use-screen-active";

/**
 * Profil efekti — afişin üstünde süzülen parçacıklar (web
 * `components/store/profile-effect.tsx` + globals.css `.profile-fx-*`).
 * Katalog `lib/profile-effects.ts`; hareket türü efektten gelir (yağar /
 * yükselir / parlar). Hareket azaltma açıksa parçacıklar durağan ama
 * görünür kalır; ekran arkadayken animasyon durur.
 *
 * Afiş kapsayıcısının içine konur; katman tamamını kaplar ve dokunmaları
 * geçirir.
 */
export function ProfileEffectOverlay({ id, height }: { id: string | null | undefined; height: number }) {
  const active = useScreenActive();
  const effect = findProfileEffect(id);
  if (!effect) return null;
  if (effect.art === "turkiye") return <TurkiyeEffect height={height} paused={!active} />;
  return (
    <View pointerEvents="none" style={FILL}>
      {effectParticles(effect).map((particle) => (
        <Particle key={particle.left} particle={particle} motion={effect.motion} height={height} paused={!active} />
      ))}
    </View>
  );
}

const FILL = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" } as const;

function Particle({
  particle,
  motion,
  height,
  paused,
}: {
  particle: EffectParticle;
  motion: ProfileEffectMotion;
  height: number;
  paused: boolean;
}) {
  const reduceMotion = useReducedMotion();
  // Hareket azaltmada orta kare: düşen/yükselen parçacık afişin ortasında,
  // parlayan tam parlak (web: animation none, opacity .8).
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);
  const still = reduceMotion || paused;

  useEffect(() => {
    if (still) return;
    progress.set(
      withDelay(
        particle.delayMs,
        withRepeat(withTiming(1, { duration: particle.durationMs, easing: Easing.linear }), -1, false)
      )
    );
    return () => cancelAnimation(progress);
  }, [particle.delayMs, particle.durationMs, progress, still]);

  const style = useAnimatedStyle(() => {
    const frame = effectFrame(motion, progress.get(), height);
    return {
      opacity: reduceMotion ? 0.8 : frame.opacity,
      transform: [{ translateY: frame.translateY }, { scale: frame.scale }, { rotate: `${frame.rotate}deg` }],
    };
  });

  const top = particle.top === null ? 0 : (particle.top / 100) * height - 9;
  return (
    <Animated.View style={[{ position: "absolute", left: `${particle.left}%`, top }, style]}>
      <Text style={{ fontSize: 14, lineHeight: 18 }} allowFontScaling={false}>
        {particle.glyph}
      </Text>
    </Animated.View>
  );
}

/**
 * Al Bayrak: dalgalanan yarı saydam kırmızı ipek (afiş görseli altta
 * seçilir), üstünden geçen beyaz parıltı, sağda nefes alan ay-yıldız ve
 * yanıp sönen beyaz yıldızlar. Hareket azaltmada durağan, parıltı gizli.
 */
const FLAG_STARS = [
  { left: 9, top: 0.24, size: 9, delay: 0 },
  { left: 23, top: 0.7, size: 7, delay: 1100 },
  { left: 38, top: 0.3, size: 8, delay: 2300 },
  { left: 52, top: 0.74, size: 6, delay: 600 },
  { left: 61, top: 0.18, size: 7, delay: 1800 },
];

/** Web `repeating-linear-gradient(100deg, …)` şeritleri: 220 birimlik katmanda 14'er birim. */
const SILK_BANDS = Array.from({ length: 16 }, (_, i) => i * 14);

function TurkiyeEffect({ height, paused }: { height: number; paused: boolean }) {
  const reduceMotion = useReducedMotion();
  const still = reduceMotion || paused;
  const [width, setWidth] = useState(0);
  const breathe = useSharedValue(0);
  const wave = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    breathe.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true));
    wave.set(withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true));
    // Sürenin %60'ında süpürür, kalanında afiş dışında bekler (web 4.5 sn).
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1800 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(wave);
      cancelAnimation(sweep);
    };
  }, [breathe, still, sweep, wave]);

  const emblemStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-3 + breathe.get() * 5}deg` }, { scale: 1 + breathe.get() * 0.06 }],
  }));
  // Şerit katmanı afişin 2.2 katı; dalga onu sola-sağa kaydırır.
  const silkStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -wave.get() * width * 1.2 }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * 0.5 + sweep.get() * width * 1.6 }, { skewX: "-12deg" }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const emblemHeight = Math.min(120, height * 0.72);

  return (
    <View pointerEvents="none" style={FILL} onLayout={onLayout}>
      {/* Kırmızı ipek tabanı: kenarlar koyu, ortası hafif açık. */}
      <Svg style={FILL} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="fx-silk" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#e30a17" stopOpacity={0.78} />
            <Stop offset="0.55" stopColor="#c80814" stopOpacity={0.62} />
            <Stop offset="1" stopColor="#e30a17" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#fx-silk)" />
      </Svg>
      {width > 0 ? (
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: width * 2.2 }, silkStyle]}>
          <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 220 100">
            {SILK_BANDS.map((x) => (
              <Polygon key={`l${x}`} points={`${x + 2},0 ${x + 9},0 ${x + 7},100 ${x},100`} fill="#fff" fillOpacity={0.07} />
            ))}
            {SILK_BANDS.map((x) => (
              <Polygon key={`d${x}`} points={`${x + 9},0 ${x + 16},0 ${x + 14},100 ${x + 7},100`} fill="#000" fillOpacity={0.1} />
            ))}
          </Svg>
        </Animated.View>
      ) : null}
      {!reduceMotion && width > 0 ? (
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: width * 0.5 }, sheenStyle]}>
          <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id="fx-sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#fff" stopOpacity={0.28} />
                <Stop offset="1" stopColor="#fff" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#fx-sheen)" />
          </Svg>
        </Animated.View>
      ) : null}
      {FLAG_STARS.map((star) => (
        <Twinkle key={star.left} left={star.left} top={star.top * height} size={star.size} delay={star.delay} still={still} />
      ))}
      <Animated.View
        style={[
          {
            position: "absolute",
            right: "9%",
            top: (height - emblemHeight) / 2,
            shadowColor: "#fff",
            shadowOpacity: 0.7,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
          emblemStyle,
        ]}
      >
        <TurkiyeEmblem width={emblemHeight * (76 / 56)} height={emblemHeight} />
      </Animated.View>
    </View>
  );
}

function Twinkle({ left, top, size, delay, still }: { left: number; top: number; size: number; delay: number; still: boolean }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (still) return;
    pulse.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true)));
    return () => cancelAnimation(pulse);
  }, [delay, pulse, still]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + pulse.get() * 0.85,
    transform: [{ scale: 0.6 + pulse.get() * 0.55 }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: `${left}%`, top }, style]}>
      <Text style={{ color: "#fff", fontSize: size, lineHeight: size + 2 }} allowFontScaling={false}>
        ✦
      </Text>
    </Animated.View>
  );
}
