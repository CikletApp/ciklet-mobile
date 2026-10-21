import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { CosmeticSvg } from "@/components/cosmetics/cosmetic-svg";
import { findDecoration } from "@/lib/avatar-decorations";
import { decorationArt } from "@/lib/cosmetics/art";
import { useScreenActive } from "@/lib/use-screen-active";

/**
 * Avatar süsü — özgün SVG çizimi (lib/cosmetics/art, web ile ortak). Web
 * `components/avatar-decoration` karşılığı.
 *
 * Süs avatarın 4/3'ü boyutunda, ortalı çizilir: 128'lik viewBox'ta avatar
 * dairesi merkez 64, yarıçap 48 — katman her yandan avatarın 1/6'sı kadar
 * taşar ve çizimin dairesi tam avatarın üstüne oturur. Yerleşimi etkilemez
 * (mutlak; avatar kutusu aynı boyutta kalır), bu yüzden listelerde satır
 * yüksekliği süs takan kişide değişmez.
 *
 * İki katman: `back` (kulak tabanı, kuyruk, ışıma) avatardan ÖNCE çizilir,
 * avatar üstüne biner; `front` (pati, fiyonk, figürler) avatardan SONRA.
 *
 * Hareket: web'deki öğe başına CSS animasyonları yerine katman düzeyinde
 * hafif bir döngü (ön katman salınır ve süzülür, arka katman nefes alır).
 * Yalnızca `animate` verilen büyük avatarlarda (profil başlığı, önizleme);
 * listelerde durağan. Hareket azaltmada ve ekran arkadayken durur.
 */
export const DECORATION_SCALE = 4 / 3;

export function AvatarDecorationLayer({
  id,
  size,
  layer,
  animate = false,
}: {
  id: string | null | undefined;
  size: number;
  layer: "back" | "front";
  animate?: boolean;
}) {
  const art = findDecoration(id) ? decorationArt(id) : null;
  const draw = art?.[layer];
  if (!draw) return null;
  const box = Math.round(size * DECORATION_SCALE);
  const offset = (size - box) / 2;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: offset, top: offset, width: box, height: box }}>
      {animate ? (
        <LiveLayer layer={layer} size={size}>
          <CosmeticSvg draw={draw} width={box} height={box} />
        </LiveLayer>
      ) : (
        <CosmeticSvg draw={draw} width={box} height={box} />
      )}
    </View>
  );
}

function LiveLayer({ layer, size, children }: { layer: "back" | "front"; size: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const active = useScreenActive();
  const still = reduceMotion || !active;
  const phase = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(phase);
      phase.set(0);
      return;
    }
    phase.set(
      withRepeat(withTiming(1, { duration: layer === "front" ? 2600 : 3400, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    return () => cancelAnimation(phase);
  }, [layer, phase, still]);

  // Ön katman: avatar boyunun ~%1.5'i kadar süzülme + ±1.5° salınım.
  // Arka katman: %1.5 nefes (ölçek) + hafif opaklık.
  const amplitude = size * 0.015;
  const style = useAnimatedStyle(() => {
    const t = phase.get();
    if (layer === "front") {
      return { transform: [{ translateY: (t - 0.5) * 2 * amplitude }, { rotate: `${(t - 0.5) * 3}deg` }] };
    }
    return { opacity: 0.88 + t * 0.12, transform: [{ scale: 1 + t * 0.015 }] };
  });

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
