import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SvgAst, parse, type JsxAST } from "react-native-svg";

import { stripCssAttributes } from "@/lib/cosmetics/native-svg";

/**
 * Kozmetik çizimini (lib/cosmetics/art — saf SVG metni) `react-native-svg`
 * ile çizer. Web `components/cosmetics/cosmetic-svg` karşılığı.
 *
 * Web her örneğe ayrı kimlik öneki veriyor (satır içi SVG kimlikleri belge
 * genelinde; üye listesinde aynı çizim onlarca kez). React Native'de her
 * `<Svg>` kökü kendi tanım (defs) kaydını tutar — kimlikler kökler arasında
 * çakışmaz. Bu yüzden önek sabit ve ayrıştırılmış ağaç (AST) çizim başına
 * BİR KEZ kurulup önbellekte tutulur: listede yüz avatar aynı süsü taşısa da
 * metin bir kez üretilir ve ayrıştırılır.
 */
const PREFIX = "c";

type Draw = (prefix: string) => string;

const astByDraw = new WeakMap<Draw, JsxAST | null>();
const astByXml = new Map<string, JsxAST | null>();
const XML_CACHE_LIMIT = 120;

function safeParse(xml: string): JsxAST | null {
  try {
    return parse(stripCssAttributes(xml));
  } catch {
    return null;
  }
}

/** Çizim işlevinin ayrıştırılmış ağacı (çizim işlevleri modül sabiti; WeakMap yeterli). */
function astForDraw(draw: Draw): JsxAST | null {
  const cached = astByDraw.get(draw);
  if (cached !== undefined) return cached;
  const ast = safeParse(draw(PREFIX));
  astByDraw.set(draw, ast);
  return ast;
}

/** Hazır SVG metninin ağacı (gradyan örtüleri, maskeli plaka sahnesi). */
function astForXml(xml: string): JsxAST | null {
  const cached = astByXml.get(xml);
  if (cached !== undefined) return cached;
  const ast = safeParse(xml);
  if (astByXml.size >= XML_CACHE_LIMIT) {
    const oldest = astByXml.keys().next().value;
    if (oldest !== undefined) astByXml.delete(oldest);
  }
  astByXml.set(xml, ast);
  return ast;
}

interface SvgBoxProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}

/** Çizim işlevinden (`decorationSvg`, `NAMEPLATE_ART[id]`, sprite) çizer. */
export const CosmeticSvg = memo(function CosmeticSvg({ draw, width = "100%", height = "100%", style }: SvgBoxProps & { draw: Draw }) {
  const ast = astForDraw(draw);
  if (!ast) return null;
  return <SvgAst ast={ast} override={{ width, height, style, pointerEvents: "none" }} />;
});

/** Hazır SVG metninden çizer (metin aynı kaldıkça ağaç önbellekten). */
export const XmlSvg = memo(function XmlSvg({ xml, width = "100%", height = "100%", style }: SvgBoxProps & { xml: string }) {
  const ast = astForXml(xml);
  if (!ast) return null;
  return <SvgAst ast={ast} override={{ width, height, style, pointerEvents: "none" }} />;
});
