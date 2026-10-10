import { create } from "zustand";

/**
 * "Yazıyor" durumu — sohbet başına şu an yazanlar (web: `use-typing-store`).
 *
 * Tek kaynak: ağ geçidi dinleyicisi `realtime/provider.tsx`'te modül
 * düzeyinde bağlı; sohbet gövdesi ve başlık aynı listeyi okur. Kayıtlar
 * kendiliğinden söner: karşı taraf uygulamayı kapatırsa "durdu" hiç gelmez.
 * Zamanlayıcılar durumun DIŞINDA tutulur; her tuş vuruşundaki tazeleme
 * yeniden çizim üretmesin.
 */

/** Gönderen 3 sn'de bir tazeliyor (web 4 sn); arada kopma payı. */
const TTL_MS = 7_000;

export interface Typer {
  id: string;
  /** Görünen ad (yoksa kullanıcı adı). */
  name: string;
  username: string;
  imageUrl: string | null;
}

interface TypingState {
  byChat: Record<string, Typer[]>;
  setTyping: (chatId: string, typer: Typer, isTyping: boolean) => void;
  clear: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useTypingStore = create<TypingState>((set, get) => ({
  byChat: {},

  setTyping: (chatId, typer, isTyping) => {
    const key = `${chatId}:${typer.id}`;
    const pending = timers.get(key);
    if (pending) clearTimeout(pending);
    timers.delete(key);

    const current = get().byChat[chatId] ?? [];
    const existing = current.find((entry) => entry.id === typer.id);

    if (!isTyping) {
      if (!existing) return;
      const rest = current.filter((entry) => entry.id !== typer.id);
      set((state) => ({ byChat: withChat(state.byChat, chatId, rest) }));
      return;
    }

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        get().setTyping(chatId, typer, false);
      }, TTL_MS)
    );

    if (
      existing &&
      existing.name === typer.name &&
      existing.username === typer.username &&
      existing.imageUrl === typer.imageUrl
    ) {
      return;
    }
    const next = existing
      ? current.map((entry) => (entry.id === typer.id ? typer : entry))
      : [...current, typer];
    set((state) => ({ byChat: withChat(state.byChat, chatId, next) }));
  },

  clear: () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    set({ byChat: {} });
  },
}));

/** Yazan kişinin mesajı geldi: göstergesi "durdu"yu beklemeden söner. */
export function clearTyper(chatId: string, profileId: string) {
  useTypingStore.getState().setTyping(chatId, { id: profileId, name: "", username: "", imageUrl: null }, false);
}

function withChat(byChat: Record<string, Typer[]>, chatId: string, typers: Typer[]) {
  const next = { ...byChat };
  if (typers.length > 0) next[chatId] = typers;
  else delete next[chatId];
  return next;
}

/** Seçici kararlı başvuru döndürmeli; her çağrıda yeni dizi sonsuz döngü yapar. */
const EMPTY: Typer[] = [];

export function useTypers(chatId: string | undefined): Typer[] {
  return useTypingStore((state) => (chatId && state.byChat[chatId]) || EMPTY);
}

/** Bu sohbette yazan var mı (liste satırları için). */
export function useIsTyping(chatId: string | undefined): boolean {
  return useTypingStore((state) => Boolean(chatId && state.byChat[chatId]?.length));
}
