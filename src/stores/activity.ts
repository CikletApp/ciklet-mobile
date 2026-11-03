import { create } from "zustand";

import type { ChatActivityRoom, ChatActivityRooms } from "@/features/activities/card-state";

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
   * Sohbet başına aktivite ODALARI — uygulama başına bir oda (ağ geçidi
   * `activity.update`, anahtar `roomKey`): davet kartlarının canlılığı,
   * katılımcıları ve süresi BURADAN okunur (features/activities/card-state)
   * — kartın metninden değil. Web `use-activities` `chatRooms` ile aynı.
   */
  rooms: Record<string, ChatActivityRooms>;

  start: (data: Omit<ActivitySession, "key">) => void;
  leave: () => void;
  minimize: () => void;
  expand: () => void;
  setLandscape: (landscape: boolean) => void;
  setRoom: (chatId: string, key: string, room: ChatActivityRoom, activity: ActivityDescriptor | null) => void;
  /** Odayı (ya da `key` yoksa sohbetin bütün odalarını) bitmiş say. */
  clearRoom: (chatId: string, key?: string | null) => void;
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
  setRoom: (chatId, key, room, activity) =>
    set((state) => {
      // Oda uygulama başına. "Katılınabilir": canlı odaların ilki (önceki
      // hâlâ canlıysa korunur); katılımcı satırı açık aktivitemizin odasından.
      const current = state.joinable[chatId] ?? null;
      let joinable = current;
      if (room.participants.length > 0 && activity) {
        joinable = !current || current.id === activity.id ? activity : current;
      } else if (current && (!key || current.id === key)) {
        joinable = null;
      }
      const ours = state.session?.chatId !== chatId || !key || key === state.session.activity.id;
      return {
        rooms: { ...state.rooms, [chatId]: { ...state.rooms[chatId], [key]: room } },
        joinable: { ...state.joinable, [chatId]: joinable },
        channelParticipants: ours
          ? { ...state.channelParticipants, [chatId]: room.participants }
          : state.channelParticipants,
      };
    }),
  clearRoom: (chatId, key) =>
    set((state) => {
      let next: ChatActivityRooms = {};
      if (key != null) {
        next = { ...state.rooms[chatId] };
        delete next[key];
      }
      const clearsJoinable = !key || state.joinable[chatId]?.id === key;
      return {
        rooms: { ...state.rooms, [chatId]: next },
        channelParticipants: clearsJoinable ? { ...state.channelParticipants, [chatId]: [] } : state.channelParticipants,
        joinable: clearsJoinable ? { ...state.joinable, [chatId]: null } : state.joinable,
      };
    }),
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
