import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalParticipant, useRemoteParticipants } from "@livekit/react-native";
import { create } from "zustand";

import { usePreferences } from "@/stores/preferences";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Yerel ses denetimi — yalnızca BU cihazda duyulanı değiştirir, kimseye
 * bildirilmez (web `use-media-settings` speakerEnabled + participant tile
 * ses menüsü ile aynı davranış):
 *
 * - **Sağırlaştır:** kimseyi duymazsın; mikrofon da kapanır. Sesi açınca
 *   mikrofon, sağırlaştırma onu kapattıysa (sen elle kapatmadıysan) geri açılır.
 * - **Kişi başı ses:** 0–200 (100 normal, 200 en yüksek yükseltme) ve
 *   "Sustur" / "Sesi Aç". Kimlik LiveKit `identity` (kullanıcı adı).
 *
 * Uygulama `RemoteParticipant.setVolume` ile; LiveKit sonradan gelen ses
 * parçalarına da aynı değeri uygular.
 */
interface LocalAudioState {
  deafened: boolean;
  /** Sağırlaştırma mikrofonu kapattı mı (açılınca geri açılsın). */
  micDisabledByDeafen: boolean;
  volumes: Record<string, number>;
  muted: Record<string, boolean>;
}

export const useLocalAudio = create<LocalAudioState>(() => ({
  deafened: false,
  micDisabledByDeafen: false,
  volumes: {},
  muted: {},
}));

export function setParticipantVolume(identity: string, volume: number) {
  const clamped = Math.max(0, Math.min(200, Math.round(volume)));
  useLocalAudio.setState((s) => ({
    volumes: { ...s.volumes, [identity]: clamped },
    // Kaydırıcı sıfırdan yukarı çekilince susturma da kalkar (web ile aynı).
    muted: clamped > 0 ? { ...s.muted, [identity]: false } : s.muted,
  }));
}

export function toggleParticipantMuted(identity: string) {
  useLocalAudio.setState((s) => {
    const volume = s.volumes[identity] ?? 100;
    const muted = s.muted[identity] === true || volume === 0;
    return {
      muted: { ...s.muted, [identity]: !muted },
      volumes: muted && volume === 0 ? { ...s.volumes, [identity]: 100 } : s.volumes,
    };
  });
}

/** Sağırlaştır / sesi aç — mikrofonla birlikte (oda içinden çağrılır). */
export function useSelfDeafen() {
  const deafened = useLocalAudio((s) => s.deafened);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const toggle = async () => {
    if (!deafened) {
      useLocalAudio.setState({ deafened: true, micDisabledByDeafen: isMicrophoneEnabled });
      if (isMicrophoneEnabled) await localParticipant?.setMicrophoneEnabled(false).catch(() => undefined);
      return;
    }
    const restore = useLocalAudio.getState().micDisabledByDeafen;
    useLocalAudio.setState({ deafened: false, micDisabledByDeafen: false });
    if (restore) await localParticipant?.setMicrophoneEnabled(true).catch(() => undefined);
  };
  return { deafened, toggle };
}

/**
 * Odadaki uzak katılımcılara etkin sesi uygular: sağır ya da susturulmuşsa
 * 0, değilse (kişi sesi × çıkış sesi). Oda bileşeninin içinde bir kez çizilir.
 */
export function LocalAudioSync() {
  const participants = useRemoteParticipants();
  const { deafened, volumes, muted } = useLocalAudio();
  const outputVolume = usePreferences((s) => s.outputVolume);
  useEffect(() => {
    for (const participant of participants) {
      const id = participant.identity;
      const volume = volumes[id] ?? 100;
      const effective = deafened || muted[id] ? 0 : (volume / 100) * ((outputVolume ?? 100) / 100);
      try {
        participant.setVolume(effective);
      } catch {
        // Parça bu arada kalktıysa yok sayılır.
      }
    }
  }, [participants, deafened, volumes, muted, outputVolume]);

  // Odadan çıkınca sağırlaştırma kalksın (sonraki görüşme sessiz başlamasın).
  useEffect(() => () => useLocalAudio.setState({ deafened: false, micDisabledByDeafen: false }), []);
  return null;
}

/** Katılımcı sayfasının başlığı: ad + "Ses Seviyesi" kaydırıcısı (0–200). */
export function ParticipantVolumeHeader({ identity, name }: { identity: string; name: string }) {
  const volume = useLocalAudio((s) => s.volumes[identity] ?? 100);
  const isMuted = useLocalAudio((s) => s.muted[identity] === true);
  const shown = isMuted ? 0 : volume;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
        {name}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>Ses Seviyesi</Text>
        <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>{shown}%</Text>
      </View>
      <VolumeSlider value={shown} max={200} onChange={(next) => setParticipantVolume(identity, next)} label={`${name} ses seviyesi`} />
      <Text style={{ fontSize: 11, color: colors.muted }}>100 normal ses, 200 maksimum boost sağlar.</Text>
    </View>
  );
}

/** Bağımlılıksız kaydırıcı: dokun ya da sürükle; erişilebilirlikte ±10 adım. */
function VolumeSlider({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const fromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    onChange((Math.max(0, Math.min(w, x)) / w) * max);
  };
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <View
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => fromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => fromX(e.nativeEvent.locationX)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.round(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => onChange(value + (e.nativeEvent.actionName === "increment" ? 10 : -10))}
      style={{ height: 32, justifyContent: "center" }}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: radii.full, backgroundColor: colors.raised }}>
        <View
          style={{ width: `${ratio * 100}%`, height: 6, borderRadius: radii.full, backgroundColor: colors.brand }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: Math.max(0, ratio * width - 10),
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.bright,
          borderWidth: 2,
          borderColor: colors.brand,
        }}
      />
    </View>
  );
}
