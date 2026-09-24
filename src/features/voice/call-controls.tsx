import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { AudioSession, useLocalParticipant } from "@livekit/react-native";

import { IconButton } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";

/**
 * Ortak çağrı kontrolleri — DM araması ve sesli kanal aynı çubuğu kullanır.
 *
 * **Sessize alma neden bozuktu:** durum kendi Zustand deposumda tutuluyordu
 * ve LiveKit'in gerçek mikrofon durumuyla ayrışabiliyordu; düğme "kapalı"
 * görünürken mikrofon açık kalıyordu. Artık TEK DOĞRULUK KAYNAĞI LiveKit'in
 * kendi `isMicrophoneEnabled` değeri — düğme onu okur, onu değiştirir.
 *
 * **Hoparlör:** `AudioSession.selectAudioOutput()` ile çıkış cihazı
 * değiştirilir. Android'de kimlikler `speaker` / `earpiece` gibi sabit
 * dizelerdir; iOS'ta sistem route picker'ı açmak idiomatik olan yoldur
 * (Bluetooth/AirPlay seçimini de kapsar).
 */
export function CallControls({
  onHangUp,
  hangUpLabel = "Görüşmeyi bitir",
  showCamera = false,
}: {
  onHangUp: () => void;
  hangUpLabel?: string;
  showCamera?: boolean;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const { speakerOn, toggleSpeaker, canToggleSpeaker } = useAudioOutput();
  const [busy, setBusy] = useState(false);

  const toggleMic = useCallback(async () => {
    if (!localParticipant || busy) return;
    setBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } finally {
      setBusy(false);
    }
  }, [localParticipant, isMicrophoneEnabled, busy]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant || busy) return;
    setBusy(true);
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } finally {
      setBusy(false);
    }
  }, [localParticipant, isCameraEnabled, busy]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xl,
      }}
    >
      <IconButton
        icon={isMicrophoneEnabled ? "mic" : "mic-off"}
        label={isMicrophoneEnabled ? "Mikrofonu kapat" : "Mikrofonu aç"}
        onPress={toggleMic}
        size={56}
        background={isMicrophoneEnabled ? colors.raised : colors.dangerSolid}
        tint={isMicrophoneEnabled ? colors.bright : "#ffffff"}
        haptic="light"
      />

      {showCamera ? (
        <IconButton
          icon="video"
          label={isCameraEnabled ? "Kamerayı kapat" : "Kamerayı aç"}
          onPress={toggleCamera}
          size={56}
          background={isCameraEnabled ? colors.brand : colors.raised}
          tint={isCameraEnabled ? colors.onBrand : colors.bright}
          haptic="light"
        />
      ) : null}

      {canToggleSpeaker ? (
        <IconButton
          icon={speakerOn ? "volume" : "phone"}
          label={speakerOn ? "Hoparlörü kapat" : "Hoparlöre al"}
          onPress={toggleSpeaker}
          size={56}
          background={speakerOn ? colors.brand : colors.raised}
          tint={speakerOn ? colors.onBrand : colors.bright}
          haptic="light"
        />
      ) : null}

      <IconButton
        icon="phone-off"
        label={hangUpLabel}
        onPress={onHangUp}
        size={56}
        background={colors.dangerSolid}
        tint="#ffffff"
        haptic="warning"
      />
    </View>
  );
}

/** Android'de bilinen çıkış kimlikleri; iOS route picker'a devreder. */
const SPEAKER_IDS = ["speaker", "SPEAKER", "speakerphone"];
const EARPIECE_IDS = ["earpiece", "EARPIECE", "receiver"];

export function useAudioOutput() {
  const [outputs, setOutputs] = useState<string[]>([]);
  const [speakerOn, setSpeakerOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void AudioSession.getAudioOutputs()
      .then((list) => {
        if (!cancelled) setOutputs(list ?? []);
      })
      .catch(() => {
        /* Cihaz listelemeyi desteklemiyorsa düğme gizlenir. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = useCallback(
    (candidates: string[]) => outputs.find((id) => candidates.includes(id)),
    [outputs]
  );

  const toggleSpeaker = useCallback(async () => {
    // iOS'ta cihaz seçimini sistem penceresi yönetir — Bluetooth ve AirPlay
    // de orada listelenir, elle "speaker/earpiece" ayrımı eksik kalırdı.
    if (Platform.OS === "ios") {
      await AudioSession.showAudioRoutePicker().catch(() => {});
      return;
    }

    const target = speakerOn ? pick(EARPIECE_IDS) : pick(SPEAKER_IDS);
    if (!target) return;
    try {
      await AudioSession.selectAudioOutput(target);
      setSpeakerOn(!speakerOn);
    } catch {
      /* Seçim başarısızsa durumu değiştirme — düğme yalan söylemesin. */
    }
  }, [speakerOn, pick]);

  const canToggleSpeaker =
    Platform.OS === "ios" || (Boolean(pick(SPEAKER_IDS)) && Boolean(pick(EARPIECE_IDS)));

  return { speakerOn, toggleSpeaker, canToggleSpeaker };
}
