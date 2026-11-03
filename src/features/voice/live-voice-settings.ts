import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/react-native";
import { RoomEvent, Track, type LocalVideoTrack, type Room } from "livekit-client";

import { noiseSuppressionConstraints, type NoiseSuppressionMode } from "@/lib/noise-suppression";
import { applySenderMaxBitrate, parseRoomVoiceMetadata } from "@/lib/voice-live-settings";
import { usePreferences } from "@/stores/preferences";

/**
 * Bağlıyken değişen ses ayarları yeniden bağlanmadan uygulanır — web
 * `components/livekit/channel-voice-live-sync.tsx` ve media-room
 * `AudioProcessingSync` ile aynı davranış. `LiveKitRoom` içinde kullanılır.
 *
 *  - Kanalın bit hızı (oda metadata'sı, lib/voice-live-settings): mikrofon
 *    göndericisinin `maxBitrate`'i `setParameters` ile değişir; odanın yayın
 *    varsayılanı da güncellenir (mikrofon yeniden yayınlanırsa yeni değer).
 *  - Görüntü kalitesi: mobilde kamera plan çözünürlüğüyle yakalanmıyor
 *    (cihaz varsayılanı), değişen tek şey kodlayıcının bozulma tercihi —
 *    açık kameraya hemen, sonra açılana yayın varsayılanından uygulanır.
 *  - Gürültü engelleme (Ayarlar → Ses ve Video): mikrofon parçası yeni
 *    kısıtla yeniden başlatılır.
 */
export function useLiveVoiceSettings() {
  const room = useRoomContext();

  useEffect(() => {
    const onMetadata = (metadata: string | undefined) => {
      const next = parseRoomVoiceMetadata(metadata);
      if (!next) return;
      applyPublishDefaults(room, next.bitrate, next.videoQualityMode === "full");

      const sender = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack?.sender;
      applySenderMaxBitrate(sender, next.bitrate).catch(() => {
        // Gönderici bu arada kalktıysa sonraki yayın varsayılandan alır.
      });
      const camera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack as LocalVideoTrack | undefined;
      camera
        ?.setDegradationPreference(next.videoQualityMode === "full" ? "maintain-resolution" : "maintain-framerate")
        .catch(() => undefined);
    };
    room.on(RoomEvent.RoomMetadataChanged, onMetadata);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, onMetadata);
    };
  }, [room]);

  const noiseSuppressionMode = usePreferences((s) => s.noiseSuppressionMode);
  const appliedMode = useRef(noiseSuppressionMode);
  useEffect(() => {
    // İlk çizimde oda zaten bu kısıtla açıldı.
    if (appliedMode.current === noiseSuppressionMode) return;
    appliedMode.current = noiseSuppressionMode;
    restartMicWithNoiseSuppression(room, noiseSuppressionMode);
  }, [room, noiseSuppressionMode]);
}

/** Odanın yayın varsayılanları (sonradan yayınlanan mikrofon/kamera için). */
function applyPublishDefaults(room: Room, bitrate: number, keepResolution: boolean) {
  const defaults = { ...room.options.publishDefaults, audioPreset: { maxBitrate: bitrate } };
  if (keepResolution) defaults.degradationPreference = "maintain-resolution";
  else delete defaults.degradationPreference;
  room.options.publishDefaults = defaults;
}

function restartMicWithNoiseSuppression(room: Room, mode: NoiseSuppressionMode) {
  const capture = { ...room.options.audioCaptureDefaults, ...noiseSuppressionConstraints(mode) };
  room.options.audioCaptureDefaults = capture;
  const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
  mic?.restartTrack(capture).catch(() => undefined);
}

/** Hook'u kendi bileşeni olmayan yerlere (DM araması) takmak için. */
export function LiveVoiceSettingsBridge() {
  useLiveVoiceSettings();
  return null;
}
