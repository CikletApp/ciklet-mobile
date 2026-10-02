import { create } from "zustand";

/**
 * Şu an ekranda AÇIK olan sohbet.
 *
 * Bildirim kararları buna bakıyor: açık sohbetin mesajı için uygulama içi
 * şerit ya da ses üretilmez — kullanıcı mesajı zaten görüyor. `ChatView`
 * bağlanırken yazar, ayrılırken siler; aynı anda tek sohbet açık olabilir.
 */
interface ActiveChatState {
  chatId: string | null;
  setActive: (chatId: string | null) => void;
}

export const useActiveChat = create<ActiveChatState>((set) => ({
  chatId: null,
  setActive: (chatId) => set({ chatId }),
}));

export const activeChatId = () => useActiveChat.getState().chatId;
