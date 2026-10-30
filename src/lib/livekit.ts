import { registerGlobals, setupIOSAudioManagement } from "@livekit/react-native";
import type { LiveKitTokenResponse } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { appleConfigFor } from "@/features/voice/audio-route";
import { roomUsesE2EE } from "@/lib/voice-e2ee/session";
import { readBitrate, readVideoQualityMode, type VideoQualityMode } from "@/lib/voice-settings";

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
  const res = await api<
    LiveKitTokenResponse & {
      moderation?: Partial<VoiceModerationState> | null;
      voice?: { bitrate?: unknown; videoQualityMode?: unknown } | null;
      afk?: boolean;
      stage?: unknown;
      e2ee?: unknown;
    }
  >(endpoints.livekitToken(room, username));
  return {
    token: res.token,
    moderation: {
      muted: res.moderation?.muted === true,
      deafened: res.moderation?.deafened === true,
    },
    // Kanalın ses ayarları (web api/livekit `voice`); DM aramasında yok.
    voice: res.voice
      ? {
          bitrate: readBitrate(res.voice.bitrate),
          videoQualityMode: readVideoQualityMode(res.voice.videoQualityMode),
        }
      : null,
    afk: res.afk === true,
    // Sahne kanalı Discord'daki gibi uçtan uca şifresiz (lib/voice-e2ee).
    stage: Boolean(res.stage),
    // Uçtan uca şifreli oda mı? Sunucunun ana anahtarı (VOICE_E2EE_ENABLED)
    // kapalıysa ya da sahneyse hayır — eskisi gibi katılınır.
    e2ee: roomUsesE2EE(res),
  };
}

/** Kanalın ses ayarları — mikrofon bit hızı ve kamera kalitesi. */
export interface ChannelVoiceSettings {
  bitrate: number;
  videoQualityMode: VideoQualityMode;
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
  voice: ChannelVoiceSettings | null;
  /** Sunucunun AFK kanalı: kimse konuşamaz (token yayın izni vermiyor). */
  afk: boolean;
  /** Sahne kanalı: uçtan uca şifreleme yok (Discord ile aynı). */
  stage: boolean;
  /** Sunucu bu odayı uçtan uca şifreli kurdu (ana anahtar açık, sahne değil). */
  e2ee: boolean;
}

/**
 * Oda yayın varsayılanları: kanalın bit hızı mikrofon kodlayıcısının tavanı;
 * "720p" kipinde kamera ağ kötüleşince çözünürlüğü korur (web lib/call-quality).
 */
export function roomOptionsFor(voice: ChannelVoiceSettings | null) {
  return {
    adaptiveStream: true,
    dynacast: true,
    ...(voice
      ? {
          publishDefaults: {
            audioPreset: { maxBitrate: voice.bitrate },
            ...(voice.videoQualityMode === "full" ? { degradationPreference: "maintain-resolution" as const } : {}),
          },
        }
      : {}),
  };
}
