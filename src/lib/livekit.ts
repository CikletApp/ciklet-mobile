import { registerGlobals, setupIOSAudioManagement } from "@livekit/react-native";
import type { LiveKitTokenResponse } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { appleConfigFor } from "@/features/voice/audio-route";

/**
 * LiveKit köprüsü.
 *
 * `registerGlobals()` WebRTC API'lerini RN ortamına kaydeder; uygulama
 * girişinde (kök düzen modülü yüklenirken) bir kez çağrılır.
 *
 * Sinyal adresi web istemcisiyle aynıdır: nginx `/rtc` yolunu SFU'ya
 * proxy'ler, medya UDP 7882 / TCP 7881'den doğrudan akar. Adres
 * `lib/config.ts` içinde türetilir — burada tekrarlanmaz.
 */

let globalsRegistered = false;

export function setupLiveKit() {
  if (globalsRegistered) return;
  // iOS ses kategorisini SDK'nın sabit "hoparlör tercihli" ayarı yerine
  // bizim geri çağrımız belirler — ahize/hoparlör seçimi motor her yeniden
  // açıldığında korunur (bkz. features/voice/audio-route.ts).
  registerGlobals({ autoConfigureAudioSession: false });
  setupIOSAudioManagement(true, appleConfigFor);
  globalsRegistered = true;
}

export { LIVEKIT_URL } from "@/lib/config";

/**
 * Oda token'ı. Sunucu, kanal üyeliğini veya DM katılımcılığını doğruladıktan
 * sonra token üretir — istemcinin oda adına güvenilmez.
 */
export async function fetchRoomToken(room: string, username: string): Promise<RoomToken> {
  const res = await api<LiveKitTokenResponse & { moderation?: Partial<VoiceModerationState> | null }>(
    endpoints.livekitToken(room, username)
  );
  return {
    token: res.token,
    moderation: {
      muted: res.moderation?.muted === true,
      deafened: res.moderation?.deafened === true,
    },
  };
}

/**
 * Kalıcı sunucu susturması / sağırlaştırması (web `lib/voice/moderation`):
 * token yanıtı katılım anındaki durumu taşır; sonrası LiveKit izinlerinden
 * (`canPublishSources`, `canSubscribe`) okunur.
 */
export interface VoiceModerationState {
  muted: boolean;
  deafened: boolean;
}

export const NO_VOICE_MODERATION: VoiceModerationState = { muted: false, deafened: false };

export interface RoomToken {
  token: string;
  moderation: VoiceModerationState;
}
