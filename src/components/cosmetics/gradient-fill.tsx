import { useMemo } from "react";
import { View } from "react-native";

import { cssGradientSvg } from "@/lib/cosmetics/css-gradient";

import { XmlSvg } from "./cosmetic-svg";

/**
 * CSS gradyan metnini (web kozmetik verisindeki `background` değerleri)
 * kapsayıcıyı dolduran bir SVG olarak çizer — bkz. lib/cosmetics/css-gradient.
 * Desteklenmeyen metinde hiçbir şey çizmez.
 */
export function GradientFill({ css }: { css: string | null | undefined }) {
  const xml = useMemo(() => cssGradientSvg(css), [css]);
  if (!xml) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <XmlSvg xml={xml} />
    </View>
  );
}
