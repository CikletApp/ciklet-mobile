import { create } from "zustand";

import { EMPTY_ROOM, type ChatActivityRoom } from "@/features/activities/card-state";

/**
 * Açık aktivite oturumu — web `hooks/use-activities` karşılığı.
 *
 * Aktivite tek bir kalıcı WebView'de çalışır (features/activities/
 * activity-host, kök düzende). Ekranlar arasında gezinirken oturum yaşar;
 * görünüm tam ekran ↔ yüzen mini pencere arasında değişir, WebView hiç
 * yeniden yüklenmez.
 */

export interface ActivityDescriptor {
  /** OAuth client_id. */
  id: string;
  name: string;
  url: string;
  icon: string;
  color?: string;
  description?: string;
}

/** Ağ geçidinin `activity.update` yükündeki katılımcı (SlimProfile). */
export interface ActivityParticipant {
  id: string;
  username: string;
  name?: string | null;
  imageUrl?: string | null;
}

export interface ActivitySession {
  activity: ActivityDescriptor;
  /** Bağlı sohbet (kanal ya da DM); sohbetsiz başlatılırsa null. */
  chatId: string | null;
  chatType: "channel" | "direct" | null;
  serverId: string | null;
  isHost: boolean;
  /**
   * SDK başlatma bağlamı (web `use-activities` launchContext): özel
   * bağlantının customId'si ve daveti paylaşan kullanıcı. iframe adresine
   * `custom_id` / `referrer_id` olarak yazılır (features/activities/sdk-host).
   */
  customId?: string | null;
  referrerId?: string | null;
  /** Her başlatmada yeni — aynı aktiviteyi yeniden açmak WebView'i tazeler. */
  key: number;
}

/** full: tam ekran; mini: sohbetin üstünde yüzen küçük pencere. */
export type ActivityViewMode = "full" | "mini";

interface ActivityState {
  session: ActivitySession | null;
  mode: ActivityViewMode;
  /** Tam ekranda yatay video görünümü (uygulama dikey kilitli; görünüm döndürülür). */
  landscape: boolean;
  /** Sohbet başına odadaki katılımcılar — davet kartının avatar/sayı satırı. */
  channelParticipants: Record<string, ActivityParticipant[]>;
  /** Sohbet başına odadaki aktif aktivite (katılımcısı varsa). */
  joinable: Record<string, ActivityDescriptor | null>;
  /**
   * Sohbet başına aktivite odası (ağ geçidi `activity.update`): davet
   * kartlarının canlılığı, katılımcıları ve süresi BURADAN okunur
   * (features/activities/card-state) — kartın metninden değil. Web
   * `use-activities` `chatRooms` ile aynı.
   */
  rooms: Record<string, ChatActivityRoom>;

  start: (data: Omit<ActivitySession, "key">) => void;
  leave: () => void;
  minimize: () => void;
  expand: () => void;
  setLandscape: (landscape: boolean) => void;
  setRoom: (chatId: string, room: ChatActivityRoom, activity: ActivityDescriptor | null) => void;
  clearRoom: (chatId: string) => void;
}

let nextKey = 1;

export const useActivitySession = create<ActivityState>((set) => ({
  session: null,
  mode: "full",
  landscape: false,
  channelParticipants: {},
  joinable: {},
  rooms: {},

  start: (data) => set({ session: { ...data, key: nextKey++ }, mode: "full", landscape: false }),
  leave: () => set({ session: null, mode: "full", landscape: false }),
  minimize: () => set((state) => (state.session ? { mode: "mini", landscape: false } : state)),
  expand: () => set((state) => (state.session ? { mode: "full" } : state)),
  setLandscape: (landscape) => set((state) => (state.session ? { landscape, mode: "full" } : state)),
  setRoom: (chatId, room, activity) =>
    set((state) => ({
      channelParticipants: { ...state.channelParticipants, [chatId]: room.participants },
      joinable: { ...state.joinable, [chatId]: room.participants.length > 0 ? activity : null },
      rooms: { ...state.rooms, [chatId]: room },
    })),
  clearRoom: (chatId) =>
    set((state) => ({
      channelParticipants: { ...state.channelParticipants, [chatId]: [] },
      joinable: { ...state.joinable, [chatId]: null },
      rooms: { ...state.rooms, [chatId]: EMPTY_ROOM },
    })),
}));

/** Bu sohbetteki bu aktivitenin içinde miyim (davet kartı "Katıldın"). */
export function isInActivity(
  session: ActivitySession | null,
  chatId: string,
  target: { id?: string; url?: string }
): boolean {
  if (!session || session.chatId !== chatId) return false;
  return (
    (Boolean(target.url) && session.activity.url === target.url) ||
    (Boolean(target.id) && session.activity.id === target.id)
  );
}
