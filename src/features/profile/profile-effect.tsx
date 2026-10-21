import { memo, useEffect, useState } from "react";
import { View, type DimensionValue, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { CosmeticSvg } from "@/components/cosmetics/cosmetic-svg";
import { GradientFill } from "@/components/cosmetics/gradient-fill";
import { effectArt, effectLayout, type EffectArt, type EffectPiece, type SpriteArt } from "@/lib/cosmetics/art";
import { findProfileEffect } from "@/lib/profile-effects";
import { useScreenActive } from "@/lib/use-screen-active";

/**
 * Profil efekti — afişin/kartın üstünde oynayan katman (web
 * `components/store/profile-effect.tsx` + cosmetics.css `.ck-fx-*`).
 * Çizim ve yerleşim web ile ortak (lib/cosmetics/art/effects):
 *  - örtü (`tint`): CSS gradyanı → SVG (lib/cosmetics/css-gradient);
 *  - parçacık (`particles`): afişin tepesinden dibine yağan ya da dibinden
 *    yükselen sprite'lar, kendi salınımlarıyla (tumble/waver);
 *  - ışıltı (`glints`): yerinde parlayan yıldız/ateş böceği;
 *  - parça (`pieces`): köşeye/kenara sabit çizim (ağ, sis, iskelet…), bazıları
 *    kendi yavaş döngüsüyle (fog/peek/descend/shoot/sheen/ribbon).
 *
 * Yerleşim deterministik (`effectLayout`, her açılışta aynı). Hareketler web
 * keyframe'lerinin Reanimated karşılığı; evre (`delay`) her öğeyi farklı
 * noktadan başlatır. Hareket azaltmada ve ekran arkadayken durağan: parçacık
 * kendi evresindeki konumda, kayan yıldız gizli (`animate={false}` de böyle).
 *
 * Afiş kapsayıcısının içine konur; katman tamamını kaplar ve dokunmaları
 * geçirir.
 */
export function ProfileEffectOverlay({
  id,
  height,
  animate = true,
}: {
  id: string | null | undefined;
  height: number;
  /** false → durağan kare (seçici ızgarası: onlarca efekt aynı anda oynamasın). */
  animate?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const [width, setWidth] = useState(0);
  const effect = findProfileEffect(id);
  const art = effect ? effectArt(effect.id) : null;
  if (!art) return null;
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  return (
    <View pointerEvents="none" style={FILL} onLayout={onLayout}>
      <GradientFill css={art.tint} />
      {width > 0 ? <EffectLayer art={art} width={width} height={height} still={reduceMotion || !active || !animate} /> : null}
    </View>
  );
}

const FILL = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" } as const;

const EffectLayer = memo(function EffectLayer({ art, width, height, still }: { art: EffectArt; width: number; height: number; still: boolean }) {
  const { particles, glints } = art;
  return (
    <>
      {art.pieces?.map((piece, i) => (
        <Piece key={`s${i}`} piece={piece} width={width} height={height} still={still} />
      ))}
      {particles
        ? effectLayout(particles.seed, particles.count, particles.size, particles.duration).map((slot, i) => (
            <Particle
              key={`p${i}`}
              draw={particles.sprites[i % particles.sprites.length]}
              left={(slot.left / 100) * width}
              size={slot.size}
              travel={height}
              durationMs={slot.duration * 1000}
              phase={(slot.delay / slot.duration) % 1}
              swayMs={slot.swayDuration * 1000}
              motion={particles.motion}
              sway={particles.sway}
              still={still}
            />
          ))
        : null}
      {glints
        ? effectLayout(glints.seed, glints.count, glints.size, [1.8, 3.2], glints.band).map((slot, i) => (
            <Glint
              key={`g${i}`}
              draw={glints.sprites[i % glints.sprites.length]}
              x={(slot.left / 100) * width}
              y={(slot.top / 100) * height}
              size={slot.size}
              durationMs={slot.duration * 1000}
              phase={(slot.delay / slot.duration) % 1}
              still={still}
            />
          ))
        : null}
    </>
  );
});

// ── Döngü yardımcıları ────────────────────────────────────────────────

/** 0→1 doğrusal, sonsuz; durağanken 0. Evre worklet içinde eklenir. */
function useLoop(durationMs: number, still: boolean): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (still) {
      cancelAnimation(progress);
      progress.set(0);
      return;
    }
    progress.set(0);
    progress.set(withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [durationMs, progress, still]);
  return progress;
}

/** `alternate` + ease-in-out döngüsünün evreli karşılığı (0→1→0). */
function pingPong(u: number): number {
  "worklet";
  const tri = u < 0.5 ? u * 2 : 2 - u * 2;
  return 0.5 - 0.5 * Math.cos(Math.PI * tri);
}

/** Parçalı doğrusal ara değer: `[t, v]` noktaları arasında. */
function keyframes(t: number, points: readonly (readonly [number, number])[]): number {
  "worklet";
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    const [t0, v0] = points[i - 1];
    if (t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return points[points.length - 1][1];
}

// ── Parçacık ─────────────────────────────────────────────────────────

function Particle({
  draw,
  left,
  size,
  travel,
  durationMs,
  phase,
  swayMs,
  motion,
  sway,
  still,
}: {
  draw: SpriteArt;
  left: number;
  size: number;
  travel: number;
  durationMs: number;
  phase: number;
  swayMs: number;
  motion: "fall" | "rise";
  sway: "tumble" | "waver";
  still: boolean;
}) {
  const fall = useLoop(durationMs, still);
  // Salınım `alternate` olduğundan bir tam gidiş-dönüş iki süre.
  const swing = useLoop(swayMs * 2, still);

  // Web: sütun kapsayıcı yüksekliğinde, translateY -%12 → %104 (yağış) /
  // %104 → -%12 (yükseliş); opaklık kenarlarda söner.
  const columnStyle = useAnimatedStyle(() => {
    const t = (fall.get() + phase) % 1;
    const y = motion === "fall" ? -0.12 + t * 1.16 : 1.04 - t * 1.16;
    const opacity =
      motion === "fall"
        ? keyframes(t, [[0, 0], [0.1, 1], [0.88, 1], [1, 0]])
        : keyframes(t, [[0, 0], [0.12, 1], [0.8, 0.9], [1, 0]]);
    return { opacity: still ? 0.85 : opacity, transform: [{ translateY: y * travel }] };
  });
  const spriteStyle = useAnimatedStyle(() => {
    const s = still ? 0.5 : pingPong((swing.get() + phase) % 1);
    if (sway === "tumble") {
      return { transform: [{ translateX: -10 + s * 22 }, { rotate: `${-35 + s * 75}deg` }] };
    }
    return { transform: [{ translateX: -5 + s * 10 }, { scale: 0.9 + s * 0.15 }] };
  });

  return (
    <Animated.View style={[{ position: "absolute", left, top: 0, width: size, height: size }, columnStyle]}>
      <Animated.View style={[{ width: size, height: size }, spriteStyle]}>
        <CosmeticSvg draw={draw} width={size} height={size} />
      </Animated.View>
    </Animated.View>
  );
}

// ── Işıltı ───────────────────────────────────────────────────────────

function Glint({
  draw,
  x,
  y,
  size,
  durationMs,
  phase,
  still,
}: {
  draw: SpriteArt;
  x: number;
  y: number;
  size: number;
  durationMs: number;
  phase: number;
  still: boolean;
}) {
  const loop = useLoop(durationMs * 2, still);
  // Web: scale .35 → 1.05, rotate 0 → 25°, opacity .1 → 1 (alternate).
  const style = useAnimatedStyle(() => {
    const s = still ? 0.8 : pingPong((loop.get() + phase) % 1);
    return { opacity: 0.1 + s * 0.9, transform: [{ scale: 0.35 + s * 0.7 }, { rotate: `${s * 25}deg` }] };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size }, style]}>
      <CosmeticSvg draw={draw} width={size} height={size} />
    </Animated.View>
  );
}

// ── Parça ────────────────────────────────────────────────────────────

const PIECE_DURATION: Record<NonNullable<EffectPiece["anim"]>, number> = {
  fog: 9,
  peek: 6,
  descend: 5,
  shoot: 4.5,
  sheen: 4.5,
  ribbon: 5,
};

/** Web CSS değeri → RN boyutu: `12%` olduğu gibi, `74px`/`0` sayı. */
function cssLength(value: string | undefined): DimensionValue | undefined {
  if (value === undefined) return undefined;
  const v = value.trim();
  if (v.endsWith("%")) return v as `${number}%`;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function cssRatio(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const [a, b] = value.split("/").map((part) => parseFloat(part));
  if (!Number.isFinite(a)) return undefined;
  return Number.isFinite(b) && b > 0 ? a / b : a;
}

const pct = (value: string | undefined) => (value?.trim().endsWith("%") ? parseFloat(value) / 100 : null);

/** Parçanın piksel boyutu — yalnızca hareket mesafesi için (yerleşimi Yoga yapar). */
function pieceSize(style: Record<string, string>, width: number, height: number): { w: number; h: number } {
  const ratio = cssRatio(style.aspectRatio);
  const maxW = style.maxWidth ? parseFloat(style.maxWidth) : Infinity;
  let w = pct(style.width) !== null ? (pct(style.width) as number) * width : NaN;
  if (Number.isNaN(w) && style.left !== undefined && style.right !== undefined) {
    w = width * (1 - (pct(style.left) ?? 0) - (pct(style.right) ?? 0));
  }
  if (Number.isFinite(maxW)) w = Math.min(w, maxW);
  let h = pct(style.height) !== null ? (pct(style.height) as number) * height : NaN;
  if (Number.isNaN(h) && ratio && Number.isFinite(w)) h = w / ratio;
  if (Number.isNaN(w) && ratio && Number.isFinite(h)) w = h * ratio;
  return { w: Number.isFinite(w) ? w : width, h: Number.isFinite(h) ? h : height };
}

function Piece({ piece, width, height, still }: { piece: EffectPiece; width: number; height: number; still: boolean }) {
  const anim = piece.anim;
  const durationMs = ((anim ? (piece.duration ?? PIECE_DURATION[anim]) : 1) * 1000) | 0;
  // `alternate` döngüler bir gidiş-dönüşü iki sürede tamamlar.
  const pingPongAnim = anim === "fog" || anim === "descend" || anim === "ribbon";
  const loop = useLoop(pingPongAnim ? durationMs * 2 : durationMs, still || !anim);
  const phase = anim && piece.delay ? (piece.delay / (durationMs / 1000) / (pingPongAnim ? 2 : 1)) % 1 : 0;
  const { w, h } = pieceSize(piece.style, width, height);

  const animated = useAnimatedStyle(() => {
    if (!anim) return {};
    const u = (loop.get() + phase) % 1;
    switch (anim) {
      case "fog": {
        const s = still ? 0.6 : pingPong(u);
        return { transform: [{ translateX: (-0.06 + s * 0.1) * w }] };
      }
      case "descend": {
        const s = still ? 1 : pingPong(u);
        return { transform: [{ translateY: (-0.55 + s * 0.55) * h }] };
      }
      case "ribbon": {
        const s = still ? 0.5 : pingPong(u);
        return { transform: [{ skewY: `${-2 + s * 4}deg` }, { scaleY: 1 - s * 0.06 }] };
      }
      case "peek": {
        if (still) return { transform: [{ translateY: 0 }, { rotate: "0deg" }] };
        const e = 0.5 - 0.5 * Math.cos(Math.PI * keyframes(u, [[0, 0], [0.3, 1], [0.7, 1], [1, 0]]));
        const tilt = keyframes(u, [[0, 0], [0.3, 0], [0.5, -6], [0.7, 0], [1, 0]]);
        return { transform: [{ translateY: (1 - e) * 0.55 * h }, { rotate: `${tilt}deg` }] };
      }
      case "shoot": {
        if (still) return { opacity: 0 };
        const k = u <= 0.7 ? 0 : ((u - 0.7) / 0.3) ** 2; // ease-in
        const opacity = keyframes(u, [[0, 0], [0.7, 0], [0.74, 1], [1, 0]]);
        return { opacity, transform: [{ translateX: -1.6 * w * k }, { translateY: 0.9 * h * k }] };
      }
      case "sheen": {
        if (still) return { opacity: 0 };
        const s = keyframes(u, [[0, 0], [0.6, 1], [1, 1]]);
        const e = 0.5 - 0.5 * Math.cos(Math.PI * s);
        return { transform: [{ translateX: (-1 + e * 2) * w }] };
      }
    }
    return {};
  });

  const base: ViewStyle = {
    position: "absolute",
    left: cssLength(piece.style.left),
    right: cssLength(piece.style.right),
    top: cssLength(piece.style.top),
    bottom: cssLength(piece.style.bottom),
    width: cssLength(piece.style.width),
    height: cssLength(piece.style.height),
    maxWidth: cssLength(piece.style.maxWidth),
    aspectRatio: cssRatio(piece.style.aspectRatio),
  };
  return (
    <Animated.View style={[base, animated]}>
      <CosmeticSvg draw={piece.art} />
    </Animated.View>
  );
}
