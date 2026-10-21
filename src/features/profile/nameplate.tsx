import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { XmlSvg } from "@/components/cosmetics/cosmetic-svg";
import { NAMEPLATE_ASPECT, nameplateArt } from "@/lib/cosmetics/art";
import { withLeftFade } from "@/lib/cosmetics/native-svg";
import { findNameplate, nameplateStops } from "@/lib/profile-effects";

/** Maskeli sahne metni plaka başına bir kez kurulur. */
const sceneCache = new Map<string, string | null>();
function sceneXml(id: string): string | null {
  const cached = sceneCache.get(id);
  if (cached !== undefined) return cached;
  const draw = nameplateArt(id);
  const xml = draw ? withLeftFade(draw("c"), 160, 48) : null;
  sceneCache.set(id, xml);
  return xml;
}

/**
 * İsim plakası — web `components/store/nameplate` karşılığı. Satırın içine
 * İLK çocuk olarak konur (mutlak, dokunmaları geçirir); satırın düzenini
 * etkilemez. İki parça:
 *  - sağdan sola saydamlaşan renk (web `background`), tüm satır boyunca;
 *  - sağa yaslı, satır yüksekliğinde çizimli sahne (lib/cosmetics/art
 *    NAMEPLATE_ART, 160×48). Sol kenarı SVG maskesiyle isme doğru
 *    saydamlaşır (web CSS `mask-image`); isim solda okunaklı kalır.
 *
 * Sahne durağan (web'de listelerde de yalnızca fare üstündeyken oynuyor).
 * Kapsayıcı `overflow: hidden` olmalı ya da `radius` verilmeli.
 */
export function NameplateBackground({ id, radius = 0 }: { id: string | null | undefined; radius?: number }) {
  const plate = findNameplate(id);
  const gradientId = `np-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!plate) return null;
  const scene = sceneXml(plate.id);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}
    >
      <Svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {nameplateStops(plate).map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {scene ? (
        <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, aspectRatio: NAMEPLATE_ASPECT, maxWidth: "100%" }}>
          <XmlSvg xml={scene} />
        </View>
      ) : null}
    </View>
  );
}
