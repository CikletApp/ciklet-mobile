/**
 * Kozmetik çizim kaydı — kimlik → çizim. Saf modül (web + mobil).
 *
 * Mobil (react-native-svg): `decorationSvg(id, "front", prefix)` gibi
 * işlevler tam `<svg>` metni döner; `SvgXml` ile çizilir (CSS animasyonu
 * yok sayılır, çizim durağan kalır).
 */
import { resolveCosmeticId } from "../aliases";
import { CUTE_DECORATIONS } from "./decorations-cute";
import { NATURE_DECORATIONS } from "./decorations-nature";
import { SPOOKY_DECORATIONS } from "./decorations-spooky";
import { EFFECT_ART, type EffectArt } from "./effects";
import { NAMEPLATE_ART } from "./nameplates";
import type { DecorationArt } from "./types";

export const DECORATION_ART: Readonly<Record<string, DecorationArt>> = {
  ...SPOOKY_DECORATIONS,
  ...CUTE_DECORATIONS,
  ...NATURE_DECORATIONS,
};

export function decorationArt(id: string | null | undefined): DecorationArt | null {
  if (!id) return null;
  return DECORATION_ART[resolveCosmeticId(id)] ?? null;
}

/** Süs katmanının tam SVG metni (yoksa null). `prefix`: gradyan kimlik öneki. */
export function decorationSvg(id: string, layer: "front" | "back", prefix = "d"): string | null {
  const art = decorationArt(id);
  const draw = art?.[layer];
  return draw ? draw(prefix) : null;
}

export function nameplateArt(id: string | null | undefined): ((p: string) => string) | null {
  if (!id) return null;
  return NAMEPLATE_ART[resolveCosmeticId(id)] ?? null;
}

export function effectArt(id: string | null | undefined): EffectArt | null {
  if (!id) return null;
  return EFFECT_ART[resolveCosmeticId(id)] ?? null;
}

export { NAMEPLATE_ART, EFFECT_ART };
export { NAMEPLATE_VIEWBOX, NAMEPLATE_ASPECT } from "./nameplates";
export { DECO_VIEWBOX, DECO_AVATAR, type DecorationArt } from "./types";
export { effectLayout, type EffectArt, type EffectPiece, type EffectParticles, type EffectGlints, type SpriteArt } from "./effects";
