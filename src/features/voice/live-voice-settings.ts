import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/react-native";
import { RoomEvent, Track, type LocalVideoTrack, type Room } from "livekit-client";

import { audioCaptureConstraints, type AudioCaptureSettings } from "@/lib/noise-suppression";
import { applySenderMaxBitrate, parseRoomVoiceMetadata } from "@/lib/voice-live-settings";
import { usePreferences } from "@/stores/preferences";
import { useCallStreamQuality } from "./stream-quality";

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
 *  - Gürültü engelleme, Yankı Giderme, Otomatik Kazanç (Ayarlar → Ses ve
 *    Video): mikrofon parçası yeni kısıtlarla yeniden başlatılır.
 */
export function useLiveVoiceSettings() {
  const room = useRoomContext();

  useEffect(() => {
    const onMetadata = (metadata: string | undefined) => {
      const next = parseRoomVoiceMetadata(metadata);
      if (!next) return;
      applyPublishDefaults(room, next.bitrate, next.videoQualityMode === "full");
      // Takviye seviyesi değişti: yayın kalitesi tavanı bir sonraki paylaşımda geçerli.
      useCallStreamQuality.getState().setBoostMax(next.streamQualityMax);

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
  const echoCancellation = usePreferences((s) => s.echoCancellation);
  const autoGainControl = usePreferences((s) => s.autoGainControl);
  const applied = useRef(`${noiseSuppressionMode}|${echoCancellation}|${autoGainControl}`);
  useEffect(() => {
    // İlk çizimde oda zaten bu kısıtlarla açıldı.
    const key = `${noiseSuppressionMode}|${echoCancellation}|${autoGainControl}`;
    if (applied.current === key) return;
    applied.current = key;
    restartMicWithCapture(room, { noiseSuppressionMode, echoCancellation, autoGainControl });
  }, [room, noiseSuppressionMode, echoCancellation, autoGainControl]);
}

/** Odanın yayın varsayılanları (sonradan yayınlanan mikrofon/kamera için). */
function applyPublishDefaults(room: Room, bitrate: number, keepResolution: boolean) {
  const defaults = { ...room.options.publishDefaults, audioPreset: { maxBitrate: bitrate } };
  if (keepResolution) defaults.degradationPreference = "maintain-resolution";
  else delete defaults.degradationPreference;
  room.options.publishDefaults = defaults;
}

function restartMicWithCapture(room: Room, settings: AudioCaptureSettings) {
  const capture = { ...room.options.audioCaptureDefaults, ...audioCaptureConstraints(settings) };
  room.options.audioCaptureDefaults = capture;
  const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
  mic?.restartTrack(capture).catch(() => undefined);
}

/** Hook'u kendi bileşeni olmayan yerlere (DM araması) takmak için. */
export function LiveVoiceSettingsBridge() {
  useLiveVoiceSettings();
  return null;
}
