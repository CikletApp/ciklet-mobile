/**
 * Web çizim metnini (lib/cosmetics/art) `react-native-svg` `SvgXml` için
 * hazırlar. Saf modül — scripts/verify-cosmetics.mjs doğrular.
 *
 *  - `class` ve `style` öznitelikleri atılır: çizimde YALNIZCA CSS
 *    animasyonu taşıyorlar (kit.ts → anim(): `ck-a ck-<ad>` +
 *    `transform-origin` / `animation-delay`). RN ayrıştırıcısı `style`'ı
 *    stil nesnesine çevirip yerel görünüme geçirirdi; hareket mobilde
 *    katman düzeyinde Reanimated ile verilir.
 *  - `withLeftFade`: isim plakası sahnesinin sol kenarını saydamlaştırır
 *    (web'deki CSS `mask-image` karşılığı), isim solda okunaklı kalsın.
 */

export function stripCssAttributes(xml: string): string {
  return xml.replace(/\s(?:class|style)="[^"]*"/g, "");
}

/**
 * Kök `<svg>`'nin içeriğini yatay bir saydamlık maskesine sarar: viewBox'ın
 * solundan `0 → .55 → 1` (web: `transparent 0%, rgba(0,0,0,.55) 24%,
 * #000 48%`). `width`/`height` viewBox ölçüleri (plaka 160×48).
 */
export function withLeftFade(xml: string, width: number, height: number, id = "npfade"): string {
  const open = xml.indexOf(">", xml.indexOf("<svg"));
  const close = xml.lastIndexOf("</svg>");
  if (open < 0 || close < 0 || close < open) return xml;
  const defs =
    `<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.24" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.48" stop-color="#fff"/>` +
    `</linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#${id}g)"/></mask></defs>`;
  return `${xml.slice(0, open + 1)}${defs}<g mask="url(#${id})">${xml.slice(open + 1, close)}</g>${xml.slice(close)}`;
}
