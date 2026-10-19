import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";

// Tek AppState dinleyicisi: her süslü avatar ayrı abonelik açmasın.
let appActive = AppState.currentState === "active";
const listeners = new Set<() => void>();
AppState.addEventListener("change", (next) => {
  const active = next === "active";
  if (active === appActive) return;
  appActive = active;
  listeners.forEach((listener) => listener());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Uygulama ön planda mı (`AppState === "active"`); değişince yeniden çizer. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, () => appActive);
}

/**
 * Ekran şu an görünür mü: odakta VE uygulama ön planda. Sonsuz animasyonlar
 * ve saniyelik sayaçlar bunu beklemeli — yığında arkada kalan ekranlar ve
 * arka plandaki uygulama boşuna kare çizip pil yemesin.
 */
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const active = useAppActive();
  return focused && active;
}
