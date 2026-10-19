import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { ReduceMotion } from "react-native-reanimated";

import { usePreferences } from "@/stores/preferences";

/**
 * Hareket azaltma — web `lib/accessibility` ile aynı üç durum.
 *
 * "system" işletim sisteminin "Hareketi azalt" / "Animasyonları kaldır"
 * tercihine uyar; "on"/"off" onu ezer. Reanimated animasyonları kök
 * düzendeki `ReducedMotionConfig` ile tek yerden kısılır (her `withTiming`
 * varsayılan olarak `ReduceMotion.System`'e bakar); reanimated dışı iki
 * döngü (iskelet nabzı, bağlantı şeridi) ve ekran geçişleri bu kancayla
 * karar verir. Böylece bir yer sisteme, diğeri ayara bakmaz.
 */
export type ReducedMotionPreference = "system" | "on" | "off";

export const REDUCED_MOTION_LABELS: Record<ReducedMotionPreference, string> = {
  system: "Sistem",
  on: "Açık",
  off: "Kapalı",
};

/** Ayar + sistem tercihi → animasyonlar kısılsın mı. */
export function resolveReducedMotion(preference: ReducedMotionPreference, systemReduced: boolean): boolean {
  if (preference === "on") return true;
  if (preference === "off") return false;
  return systemReduced;
}

/** Reanimated'ın genel kipi. */
export function reanimatedMotionMode(preference: ReducedMotionPreference): ReduceMotion {
  if (preference === "on") return ReduceMotion.Always;
  if (preference === "off") return ReduceMotion.Never;
  return ReduceMotion.System;
}

/** Sistemin hareket azaltma tercihi; değişince canlı güncellenir. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Bu cihazda animasyonlar kısılsın mı (ayar + sistem). */
export function useReducedMotion(): boolean {
  const preference = usePreferences((state) => state.reduceMotion);
  const system = useSystemReducedMotion();
  return resolveReducedMotion(preference, system);
}
