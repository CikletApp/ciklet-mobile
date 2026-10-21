import { useEffect } from "react";
import * as Font from "expo-font";
import { create } from "zustand";

/**
 * Ad stili yazı tipleri (lib/name-style NAME_FONTS) — web
 * `lib/name-font-faces` karşılığı. Dosyalar `@expo-google-fonts/*`
 * paketlerinden (yalnızca kullanılan ağırlık; JS + .ttf, yerel derleme
 * gerekmez) uygulamaya gömülür; YÜKLEME tembeldir: bir yazı tipi ekranda o
 * aileyle çizilen bir ad olduğunda `Font.loadAsync` ile kaydedilir. Hiç ad
 * stili görmeyen kullanıcı hiçbir yazı tipini belleğe almaz.
 *
 * Aile adı `CikletName-<kimlik>` — uygulama yazı tipleriyle (CikletInter-…)
 * çakışmaz. Android'de özel ailede `fontWeight` sistem fontuna düşürür;
 * ağırlık dosyanın kendisinde (Cinzel 700, Pixelify 600, Grenze 700), çizen
 * taraf `fontWeight: "normal"` verir.
 *
 * Paket içi .ttf yolları `require` ile verilir (Metro varlık olarak gömer);
 * paket yolları `@expo-google-fonts/<aile>/<ağırlık>/<Aile>_<ağırlık>.ttf`.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const FONT_ASSETS: Readonly<Record<string, number>> = {
  nf_bungee: require("@expo-google-fonts/bungee/400Regular/Bungee_400Regular.ttf"),
  nf_pacifico: require("@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf"),
  nf_terminal: require("@expo-google-fonts/vt323/400Regular/VT323_400Regular.ttf"),
  nf_orbit: require("@expo-google-fonts/audiowide/400Regular/Audiowide_400Regular.ttf"),
  nf_comic: require("@expo-google-fonts/bangers/400Regular/Bangers_400Regular.ttf"),
  nf_royal: require("@expo-google-fonts/cinzel-decorative/700Bold/CinzelDecorative_700Bold.ttf"),
  nf_lobster: require("@expo-google-fonts/lobster/400Regular/Lobster_400Regular.ttf"),
  nf_pixel: require("@expo-google-fonts/pixelify-sans/600SemiBold/PixelifySans_600SemiBold.ttf"),
  nf_arcade: require("@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf"),
  nf_nightmare: require("@expo-google-fonts/nosifer/400Regular/Nosifer_400Regular.ttf"),
  nf_glitch: require("@expo-google-fonts/rubik-glitch/400Regular/RubikGlitch_400Regular.ttf"),
  nf_neonsign: require("@expo-google-fonts/monoton/400Regular/Monoton_400Regular.ttf"),
  nf_wetpaint: require("@expo-google-fonts/rubik-wet-paint/400Regular/RubikWetPaint_400Regular.ttf"),
  nf_gothic: require("@expo-google-fonts/grenze-gotisch/700Bold/GrenzeGotisch_700Bold.ttf"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function nameFontFamilyKey(fontId: string): string {
  return `CikletName-${fontId}`;
}

interface NameFontState {
  loaded: Record<string, true>;
}

const useNameFontStore = create<NameFontState>(() => ({ loaded: {} }));
const inflight = new Map<string, Promise<void>>();

function markLoaded(fontId: string) {
  const { loaded } = useNameFontStore.getState();
  if (loaded[fontId]) return;
  useNameFontStore.setState({ loaded: { ...loaded, [fontId]: true } });
}

/** Yazı tipini kaydeder (bir kez; aynı anda gelen istekler birleşir). */
export function loadNameFont(fontId: string): Promise<void> {
  const asset = FONT_ASSETS[fontId];
  if (!asset) return Promise.resolve();
  const family = nameFontFamilyKey(fontId);
  if (Font.isLoaded(family)) {
    markLoaded(fontId);
    return Promise.resolve();
  }
  const pending = inflight.get(fontId);
  if (pending) return pending;
  const task = Font.loadAsync({ [family]: asset })
    .then(() => markLoaded(fontId))
    .catch(() => {
      // Yüklenemezse ad uygulama yazı tipiyle çizilmeye devam eder;
      // bir sonraki çizimde yeniden denenebilir.
    })
    .finally(() => inflight.delete(fontId));
  inflight.set(fontId, task);
  return task;
}

/**
 * Ad için `fontFamily` — yazı tipi yüklendiyse aile adı, yüklenmediyse
 * (ilk kare) null ve yükleme başlar; yüklenince yeniden çizilir.
 */
export function useNameFontFamily(fontId: string | null | undefined): string | null {
  const known = Boolean(fontId && FONT_ASSETS[fontId]);
  const loaded = useNameFontStore((s) => (fontId ? Boolean(s.loaded[fontId]) : false));
  useEffect(() => {
    if (known && !loaded && fontId) void loadNameFont(fontId);
  }, [fontId, known, loaded]);
  return known && loaded && fontId ? nameFontFamilyKey(fontId) : null;
}
