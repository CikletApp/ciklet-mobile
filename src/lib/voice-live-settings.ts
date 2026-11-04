/**
 * Ses kanalı ayarlarının BAĞLIYKEN uygulanması — ciklet-web
 * `src/lib/voice/live-settings.ts` kopyası (ortak paket yok; biçim değişirse
 * ikisi birlikte değişir).
 *
 * Kanalın bit hızı / görüntü kalitesi ya da sunucunun Takviye seviyesi
 * değişince sunucu LiveKit oda metadata'sını yazar. Oda metadata'sını yalnızca
 * sunucu yazabilir; istemci `RoomEvent.RoomMetadataChanged` ile alır ve
 * yayınladığı parçanın kodlayıcısını yeniden bağlanmadan günceller.
 */
import { isStreamQuality, type StreamQuality } from "@/lib/stream-quality";
import { readBitrate, readVideoQualityMode, type VideoQualityMode } from "@/lib/voice-settings";

export const ROOM_VOICE_METADATA_VERSION = 1;

export interface RoomVoiceSettings {
  bitrate: number;
  videoQualityMode: VideoQualityMode;
  /** Takviye seviyesinin yayın kalitesi tavanı; eski metadata'da yok. */
  streamQualityMax: StreamQuality | null;
}

/** Oda metadata'sını okur; boş, bozuk ya da başka biçimde metadata `null`. */
export function parseRoomVoiceMetadata(raw: string | null | undefined): RoomVoiceSettings | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { v?: unknown; voice?: unknown };
  if (record.v !== ROOM_VOICE_METADATA_VERSION || !record.voice || typeof record.voice !== "object") return null;
  const voice = record.voice as { bitrate?: unknown; videoQualityMode?: unknown; streamQualityMax?: unknown };
  return {
    bitrate: readBitrate(voice.bitrate),
    videoQualityMode: readVideoQualityMode(voice.videoQualityMode),
    streamQualityMax: isStreamQuality(voice.streamQualityMax) ? voice.streamQualityMax : null,
  };
}

interface SenderLike {
  getParameters(): { encodings?: { maxBitrate?: number }[] };
  setParameters(params: unknown): Promise<unknown>;
}

/** Ses parçası göndericisinin en yüksek bit hızını değiştirir (yeniden bağlanmadan). */
export async function applySenderMaxBitrate(sender: SenderLike | undefined, maxBitrate: number): Promise<boolean> {
  if (!sender) return false;
  const params = sender.getParameters();
  const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
  if (encodings.every((encoding) => encoding.maxBitrate === maxBitrate)) return false;
  await sender.setParameters({ ...params, encodings: encodings.map((encoding) => ({ ...encoding, maxBitrate })) });
  return true;
}
