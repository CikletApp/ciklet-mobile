import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  KeyboardState,
  useAnimatedKeyboard,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";

/**
 * Klavye ↔ satır içi panel (emoji / GIF / aktivite) yer paylaşımı.
 *
 * Panel klavyenin yerini alır ve boyu klavyeyle AYNIDIR; ikisi arasında
 * geçerken yazma çubuğu yerinden oynamaz. Bunun için son görülen klavye
 * yüksekliği saklanır (uygulama yeniden açıldığında da geçerli); hiç
 * klavye görülmediyse ekranın ~%38'i varsayılır.
 *
 * Klavye yüksekliği `KeyboardAvoider` ile AYNI iki kaynaktan okunur ve
 * büyük olan alınır: Reanimated'ın UI iş parçacığındaki değeri (açılma
 * animasyonuyla kare kare) ve RN'nin klavye olayları (Reanimated'ın hiç
 * değer bildirmediği emülatörler için yedek).
 */

export type PanelTab = "gif" | "activity" | "emoji";

const STORAGE_KEY = "ciklet.composer.panel";
const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

interface PanelMemory {
  /** Son görülen klavye yüksekliği (dp); henüz yoksa null. */
  keyboardHeight: number | null;
  /** Panel en son hangi sekmede bırakıldı — bir dahaki açılış oradan. */
  tab: PanelTab;
}

const usePanelMemory = create<PanelMemory>(() => ({ keyboardHeight: null, tab: "emoji" }));

let hydration: Promise<void> | null = null;
/** Saklanan değer okunmadan kullanıcı sekme seçtiyse o kazanır. */
let tabChosen = false;

function hydrate() {
  hydration ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as Partial<PanelMemory>) : {};
      usePanelMemory.setState((current) => ({
        keyboardHeight:
          current.keyboardHeight ??
          (typeof saved.keyboardHeight === "number" && saved.keyboardHeight > 0 ? saved.keyboardHeight : null),
        tab: tabChosen || !isPanelTab(saved.tab) ? current.tab : saved.tab,
      }));
    })
    .catch(() => {});
}

function isPanelTab(value: unknown): value is PanelTab {
  return value === "gif" || value === "activity" || value === "emoji";
}

function persist() {
  const { keyboardHeight, tab } = usePanelMemory.getState();
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ keyboardHeight, tab })).catch(() => {});
}

function rememberKeyboardHeight(height: number) {
  const rounded = Math.round(height);
  if (rounded <= 0 || rounded === usePanelMemory.getState().keyboardHeight) return;
  usePanelMemory.setState({ keyboardHeight: rounded });
  persist();
}

export function rememberPanelTab(tab: PanelTab) {
  tabChosen = true;
  if (usePanelMemory.getState().tab === tab) return;
  usePanelMemory.setState({ tab });
  persist();
}

/**
 * Panelin boyu: son klavye yüksekliği, yoksa ekranın ~%38'i. Ekranın
 * %28–%60'ı arasına sıkıştırılır: yüzen klavye ya da donanım klavyesinin
 * araç şeridi 50–100 dp gibi küçük bir "klavye" bildiriyor ve bu saklanınca
 * panel neredeyse sıfır yükseklikte açılıyordu.
 */
export function usePanelHeight(): number {
  const stored = usePanelMemory((state) => state.keyboardHeight);
  const { height } = useWindowDimensions();
  const fallback = Math.round(height * 0.38);
  const min = Math.round(height * 0.28);
  const max = Math.round(height * 0.6);
  return Math.min(max, Math.max(min, stored ?? fallback));
}

export function useLastPanelTab(): PanelTab {
  return usePanelMemory((state) => state.tab);
}

/**
 * Anlık klavye yüksekliği (UI iş parçacığında) ve görünür olup olmadığı.
 * Klavye her açıldığında yüksekliği panel için saklanır.
 */
export function useKeyboardSpace() {
  const keyboard = useAnimatedKeyboard();
  const eventHeight = useSharedValue(0);
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    hydrate();
    const show = Keyboard.addListener(SHOW_EVENT, (event) => {
      const height = event.endCoordinates.height;
      eventHeight.set(withTiming(height, { duration: 160 }));
      rememberKeyboardHeight(height);
      setVisible(true);
    });
    const hide = Keyboard.addListener(HIDE_EVENT, () => {
      eventHeight.set(withTiming(0, { duration: 160 }));
      setVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [eventHeight]);

  const height = useDerivedValue(() => {
    const state = keyboard.state.get();
    // Kapanırken Reanimated değeri bir kare 0'a düşebiliyor; yalnızca
    // açıkken/açılırken kullanılır (bkz. KeyboardAvoider).
    const opening = state === KeyboardState.OPEN || state === KeyboardState.OPENING;
    return Math.max(opening ? keyboard.height.get() : 0, eventHeight.get());
  });

  return { height, visible };
}
