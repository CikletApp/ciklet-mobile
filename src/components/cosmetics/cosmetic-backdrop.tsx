import { View } from "react-native";

import { getCosmeticShowcase } from "@/lib/cosmetics/showcase";

import { CosmeticSvg } from "./cosmetic-svg";

/**
 * Vitrin sahnesi (lib/cosmetics/showcase) — mağaza önizlemesinde ürünün
 * ARKASINA serilen atmosferik çizim (ay ışıklı mezarlık, kutup ışıkları…).
 * Kapsayıcıyı doldurur (`slice`), dokunmaları geçirir; bilinmeyen üründe
 * hiçbir şey çizmez. Durağan.
 */
export function CosmeticBackdrop({ id }: { id: string | null | undefined }) {
  const showcase = getCosmeticShowcase(id);
  if (!showcase) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <CosmeticSvg draw={showcase.backdrop} />
    </View>
  );
}
