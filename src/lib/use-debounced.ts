import { useEffect, useState } from "react";

/** Değer `delayMs` boyunca değişmeden kalınca döner — yazarken sunucu araması için. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
