import { useId } from "react";
import Svg, { Circle, Defs, Mask, Polygon, Rect } from "react-native-svg";

/**
 * Türk bayrağının ay-yıldızı (web `components/turkiye-emblem` ile aynı
 * oranlar). Emoji kullanılmıyor: bayrak emojisi bazı platformlarda harf
 * olarak çiziliyor. Hilal maskeyle oyulur, arka plan ne olursa olsun doğru.
 */
export function TurkiyeEmblem({ width, height, color = "#fff" }: { width: number; height: number; color?: string }) {
  const maskId = `ayyildiz-${useId().replace(/:/g, "")}`;
  return (
    <Svg width={width} height={height} viewBox="8 22 76 56">
      <Defs>
        <Mask id={maskId}>
          <Rect x="0" y="0" width="100" height="100" fill="#fff" />
          <Circle cx="44.25" cy="50" r="20" fill="#000" />
        </Mask>
      </Defs>
      <Circle cx="38" cy="50" r="25" fill={color} mask={`url(#${maskId})`} />
      <Polygon
        fill={color}
        points="56.50,50.00 65.14,47.19 65.14,38.11 70.48,45.46 79.11,42.65 73.78,50.00 79.11,57.35 70.48,54.54 65.14,61.89 65.14,52.81"
      />
    </Svg>
  );
}
