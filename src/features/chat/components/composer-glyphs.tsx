import Svg, { Path } from "react-native-svg";

/**
 * Yazma çubuğuna özgü iki glif. Ortak ikon setindeki kurallarla çizildi
 * (24×24 kutu, 2px çizgi, yuvarlak uç ve birleşim) ki yan yana durdukları
 * `Icon`'lardan ayrışmasın.
 */

const KEYBOARD = [
  "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  "M6 9h.01",
  "M10 9h.01",
  "M14 9h.01",
  "M18 9h.01",
  "M8 13h.01",
  "M12 13h.01",
  "M16 13h.01",
  "M8 16h8",
];

const BACKSPACE = [
  "M10 5a2 2 0 0 0-1.34.52l-6.33 5.74a1 1 0 0 0 0 1.48l6.33 5.74A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  "m12 9 6 6",
  "m18 9-6 6",
];

function Glyph({ paths, size, color }: { paths: string[]; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Panel açıkken emoji düğmesinin yerini alır: "klavyeye dön". */
export function KeyboardGlyph({ size = 20, color }: { size?: number; color: string }) {
  return <Glyph paths={KEYBOARD} size={size} color={color} />;
}

/** Emoji panelindeki geri silme. */
export function BackspaceGlyph({ size = 20, color }: { size?: number; color: string }) {
  return <Glyph paths={BACKSPACE} size={size} color={color} />;
}
