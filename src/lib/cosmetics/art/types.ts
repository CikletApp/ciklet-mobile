/**
 * Avatar süsü çizimi: 128×128 viewBox, avatar dairesi merkez (64,64)
 * yarıçap 48 — süs avatarın 4/3'ü boyutunda çizilir (bkz.
 * components/avatar-decoration → DECORATION_SCALE).
 *
 *  - `back`: avatarın ARKASINDA kalan katman (kulak tabanı, kuyruk kökü,
 *    ışıma); avatar onun üstüne biner.
 *  - `front`: avatarın ÖNÜNDEKİ katman (pati, fiyonk, figürler).
 *
 * Her ikisi de `p` kimlik önekiyle tam bir `<svg>` belgesi döner.
 */
export interface DecorationArt {
  front: (p: string) => string;
  back?: (p: string) => string;
}

export const DECO_VIEWBOX = "0 0 128 128";
/** Avatar dairesinin viewBox'taki çapı (128'de 96). */
export const DECO_AVATAR = 96;
