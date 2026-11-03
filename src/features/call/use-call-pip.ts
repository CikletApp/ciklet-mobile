import { useEffect, useState } from "react";
import { Platform } from "react-native";

import CikletCalls from "../../../modules/ciklet-calls";

/**
 * Görüntülü görüşmenin resim içinde resim (PiP) penceresi.
 *
 * ANDROID: `enabled` iken uygulamadan çıkınca (Ana ekran, son uygulamalar)
 * tüm etkinlik küçük pencereye geçer; React ağacı o pencerede çizilmeye
 * devam eder. Bu yüzden `active` döner — çağıran PiP'teyken yalnızca ana
 * görüntüyü çizer (kontroller, kendi kameran ve üst çubuk gizlenir).
 * Yerel taraf: modules/ciklet-calls CallPictureInPicture.kt, manifest:
 * plugins/with-call-pip.js.
 *
 * iOS: sistem AVPictureInPictureController'ı yalnızca bir video katmanını
 * küçük pencereye taşır (uygulama arayüzü değil) — `VideoTrack`'in
 * `iosPIP` seçeneği; bkz. {@link iosPipOptions}. `active` iOS'ta hep false.
 *
 * Modülsüz ya da eski derlemede sessizce hiçbir şey yapmaz.
 */
const native = Platform.OS === "android" ? CikletCalls : null;
const supported = Boolean(native && typeof native.setAutoPictureInPicture === "function");

function readActive(): boolean {
  try {
    return supported && native?.isInPictureInPicture?.() === true;
  } catch {
    return false;
  }
}

export function useCallPip(enabled: boolean, landscape = false): { active: boolean } {
  const [active, setActive] = useState(readActive);

  useEffect(() => {
    if (!native || !supported) return;
    const subscription = native.addListener("onPictureInPictureChange", (event) => setActive(Boolean(event.active)));
    return () => subscription.remove();
  }, []);

  const { width, height } = landscape ? LANDSCAPE : PORTRAIT;
  useEffect(() => {
    if (!native || !supported || !enabled) return;
    void native.setAutoPictureInPicture?.(true, width, height).catch(() => undefined);
    return () => {
      void native.setAutoPictureInPicture?.(false, width, height).catch(() => undefined);
    };
  }, [enabled, width, height]);

  return { active: active && enabled };
}

const PORTRAIT = { width: 9, height: 16 } as const;
/** Paylaşılan ekran — yatay pencere. */
export const LANDSCAPE = { width: 16, height: 9 } as const;

function iosOptions(aspect: { width: number; height: number }) {
  return {
    enabled: true,
    startAutomatically: true,
    stopAutomatically: true,
    preferredSize: { width: aspect.width, height: aspect.height },
  };
}

// Sabit nesneler: her çizimde yeni nesne yerel görünüme yeniden yazılmasın.
const IOS_PORTRAIT = iosOptions(PORTRAIT);
const IOS_LANDSCAPE = iosOptions(LANDSCAPE);

/**
 * iOS `VideoTrack iosPIP` seçenekleri: uygulama arka plana geçince ana
 * görüntü (karşı tarafın kamerası ya da paylaştığı ekran) sistem PiP
 * penceresinde sürer. Android'de `undefined` (orada tüm etkinlik PiP'e geçer).
 */
export function iosPipOptions(enabled: boolean, landscape = false) {
  if (Platform.OS !== "ios" || !enabled) return undefined;
  return landscape ? IOS_LANDSCAPE : IOS_PORTRAIT;
}
