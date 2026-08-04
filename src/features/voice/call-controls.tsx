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
}: {
  onHangUp: () => void;
  hangUpLabel?: string;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
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
        icon={isMicrophoneEnabled ? "volume" : "bell-off"}
        label={isMicrophoneEnabled ? "Mikrofonu kapat" : "Mikrofonu aç"}
        onPress={toggleMic}
        size={56}
        background={isMicrophoneEnabled ? colors.panel : colors.danger}
        tint={isMicrophoneEnabled ? colors.text : colors.bright}
        haptic="light"
      />

      {canToggleSpeaker ? (
        <IconButton
          icon={speakerOn ? "volume" : "phone"}
          label={speakerOn ? "Hoparlörü kapat" : "Hoparlöre al"}
          onPress={toggleSpeaker}
          size={56}
          background={speakerOn ? colors.brand : colors.panel}
          tint={speakerOn ? colors.onBrand : colors.text}
          haptic="light"
        />
      ) : null}

      <IconButton
        icon="close"
        label={hangUpLabel}
        onPress={onHangUp}
        size={56}
        background={colors.danger}
        tint={colors.bright}
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
