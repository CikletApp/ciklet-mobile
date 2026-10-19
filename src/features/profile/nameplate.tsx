import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { findNameplate } from "@/lib/profile-extras";

/**
 * İsim plakası — üye satırının arkasında soldan sağa sönen gradyan (web
 * `NAMEPLATES` CSS arka planı). Satırın içine ilk çocuk olarak konur;
 * mutlak konumlu ve dokunmaları geçirir.
 */
export function NameplateBackground({ id, radius = 0 }: { id: string | null | undefined; radius?: number }) {
  const plate = findNameplate(id);
  const gradientId = `np-${useId().replace(/:/g, "")}`;
  if (!plate) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset={0} stopColor={plate.color} stopOpacity={plate.opacity} />
            <Stop offset={0.7} stopColor={plate.color} stopOpacity={plate.opacity * 0.25} />
            <Stop offset={1} stopColor={plate.color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
