import { useEffect, useState } from "react";

/** Modül düzeyinde: render içinde doğrudan `Date.now` React Compiler'a takılıyor. */
function nowMs(): number {
  return Date.now();
}

/**
 * Belirli aralıkla tikleyen saat — susturma ve zaman aşımı gibi "kalan
 * süre" metinleri için. `intervalMs` 0 ise yalnızca ilk değer döner.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = setInterval(() => setNow(nowMs()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
