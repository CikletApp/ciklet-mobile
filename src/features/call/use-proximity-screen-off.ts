import { useEffect } from "react";

import CikletCalls from "../../../modules/ciklet-calls";

/**
 * Yakınlık sensörü: telefon kulağa yaklaşınca ekran kararır, yanağın
 * dokunuşu "Bitir"e ya da mikrofona basmaz (telefon uygulamalarıyla aynı).
 *
 * Yalnızca `enabled` iken — çağıran bunu "sesli görüşme + ses ahizede"
 * olarak verir. Hoparlörde ya da kulaklıkta telefon elde tutulur ve ekran
 * kararmamalı. Kapanırken kilit bırakılır; Android'de telefon hâlâ
 * kulaktaysa ekran uzaklaşınca açılır.
 *
 * Modülsüz ya da eski derlemede (işlev yok) sessizce hiçbir şey yapmaz.
 */
export function useProximityScreenOff(enabled: boolean): void {
  useEffect(() => {
    const native = CikletCalls;
    if (!enabled || !native || typeof native.setProximityScreenOff !== "function") return;
    try {
      native.setProximityScreenOff(true);
    } catch {
      return;
    }
    return () => {
      try {
        native.setProximityScreenOff?.(false);
      } catch {
        /* modül kapanmış */
      }
    };
  }, [enabled]);
}
