import { create } from "zustand";

/**
 * Aktif ses oturumu.
 *
 * Uygulamada AYNI ANDA TEK bir ses kanalı olabilir — sunucu tarafı da böyle
 * davranıyor (`join_voice_channel` önceki kanaldan otomatik çıkarıyor).
 * Bu store, kullanıcı sohbetler arasında gezinirken bağlantının hangi
 * kanalda olduğunu ve alt çubuğun ne göstereceğini bilir.
 */

export interface ActiveVoice {
  /** LiveKit oda adı = channelId (ya da DM görüşmesinde directId). */
  roomId: string;
  channelName: string;
  serverName?: string;
  serverId?: string;
  joinedAt: number;
  kind?: "audio" | "video";
}

export interface VoiceParticipant {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  callType?: string;
}

interface VoiceState {
  active: ActiveVoice | null;
  /** Sunucudan gelen katılımcı listesi (bot'lar dahil). */
  participants: VoiceParticipant[];
  muted: boolean;

  join: (session: ActiveVoice) => void;
  leave: () => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  setMuted: (muted: boolean) => void;
}

export const useVoice = create<VoiceState>((set) => ({
  active: null,
  participants: [],
  muted: false,

  // Liste yalnızca BAŞKA bir odaya geçerken silinir. Ağ geçidinin katılım
  // yanıtı token'dan önce geliyor; katılımda koşulsuz silmek o yanıtı
  // yutup ekranı boş bırakıyordu. Ayrılışta `leave` zaten temizliyor.
  join: (active) =>
    set((state) =>
      state.active && state.active.roomId !== active.roomId
        ? { active, participants: [], muted: false }
        : { active }
    ),
  leave: () => set({ active: null, participants: [] }),
  setParticipants: (participants) => set({ participants }),
  setMuted: (muted) => set({ muted }),
}));
