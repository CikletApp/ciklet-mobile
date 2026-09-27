import { create } from "zustand";

/**
 * Atlanılan mesajın kısa vurgusu (sabit çubuğu, "bir mesajı sabitledi"
 * satırı, alıntıya dokunma). React durumu yerine küçük bir depo: yalnızca
 * vurgulanan satır yeniden çizilir, liste ve `renderItem` yerinde kalır.
 */

/** Vurgu animasyonunun süresi; bittikten sonra işaret temizlenir. */
export const FLASH_DURATION = 1200;

const useFlashStore = create<{ id: string | null; token: number }>(() => ({ id: null, token: 0 }));

let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function flashMessage(messageId: string) {
  useFlashStore.setState((state) => ({ id: messageId, token: state.token + 1 }));
  if (clearTimer) clearTimeout(clearTimer);
  // Temizlenmezse satır listeden çıkıp geri geldiğinde vurgu yeniden oynardı.
  clearTimer = setTimeout(() => useFlashStore.setState({ id: null }), FLASH_DURATION + 400);
}

/** Bu mesaj şu an vurgulanıyorsa her vurguya özgü sayı, değilse null. */
export function useMessageFlash(messageId: string): number | null {
  return useFlashStore((state) => (state.id === messageId ? state.token : null));
}
