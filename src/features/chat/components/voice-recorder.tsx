import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";
import * as Haptics from "expo-haptics";

import { Icon, Pressable, showToast } from "@/components/ui";
import { VOICE_MAX_SECONDS, formatVoiceDuration, type VoiceMeta } from "@/lib/message-extras";
import type { PickedAsset } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";
import {
  endRecordingMode,
  inLiveAudio,
  levelFromMetering,
  prepareRecordingMode,
  voiceFileName,
  waveformFromLevels,
} from "../voice-message";

/**
 * Sesli mesaj kaydı — ciklet-web `voice-recorder.tsx` karşılığı.
 *
 * Mikrofon düğmesi iki türlü kullanılır (WhatsApp/Telegram gibi):
 *  • basılı tut → bırakınca gönderilir;
 *  • kısa dokun → kayıt kilitli sürer; çubukta İptal, düğmeye yeniden
 *    dokununca gönderilir.
 * 5 dakikada kendiliğinden biter ve gönderilir. Kayıt bitince dosya
 * çağırana verilir; yükleme ve gönderim onun işi (metadata.voice ile).
 */

const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};

/** Bundan kısa basış "dokunma" sayılır ve kayıt kilitlenir. */
const HOLD_MS = 450;
/** Bundan kısa kayıt gönderilmez (yanlışlıkla dokunma). */
const MIN_MS = 600;

export type RecorderPhase = "idle" | "starting" | "recording";

export function useVoiceRecorder(onRecorded: (asset: PickedAsset, meta: VoiceMeta) => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  // Süre ve canlı seviye 100 ms'de bir birlikte değişir: tek state, tek çizim.
  const [meter, setMeter] = useState({ elapsedMs: 0, level: 0 });
  const { elapsedMs, level } = meter;
  const levels = useRef<number[]>([]);
  const lastDuration = useRef(0);
  const pressedAt = useRef(0);
  const stopping = useRef(false);
  const callback = useRef(onRecorded);
  useEffect(() => {
    callback.current = onRecorded;
  }, [onRecorded]);

  // Durum yalnızca kayıt sürerken okunur (expo-audio'nun durum kancası boştayken
  // de sürekli yokluyor): süre, canlı seviye ve dalga formu örnekleri.
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      const current = levelFromMetering(status.metering);
      levels.current.push(current);
      lastDuration.current = status.durationMillis;
      setMeter({ elapsedMs: status.durationMillis, level: current });
    }, 100);
    return () => clearInterval(timer);
  }, [phase, recorder]);

  const finish = useCallback(
    async (send: boolean) => {
      if (stopping.current) return;
      stopping.current = true;
      const durationMs = recorder.getStatus().durationMillis || lastDuration.current;
      try {
        await recorder.stop();
      } catch {
        /* zaten durmuş */
      }
      await endRecordingMode();
      setPhase("idle");
      setMeter({ elapsedMs: 0, level: 0 });
      stopping.current = false;
      const uri = recorder.uri;
      if (!send || !uri || durationMs < MIN_MS) return;
      callback.current(
        { uri, name: voiceFileName(), mimeType: "audio/mp4", size: null },
        { durationMs: Math.round(Math.min(durationMs, VOICE_MAX_SECONDS * 1000)), waveform: waveformFromLevels(levels.current) }
      );
    },
    [recorder]
  );

  // 5 dk sınırı: kayıt kendiliğinden biter ve gönderilir.
  useEffect(() => {
    if (phase === "recording" && elapsedMs >= VOICE_MAX_SECONDS * 1000) void finish(true);
  }, [finish, phase, elapsedMs]);

  const start = useCallback(async () => {
    if (phase !== "idle") return;
    if (inLiveAudio()) {
      showToast("Sesli görüşmedeyken sesli mesaj kaydedilemez.");
      return;
    }
    setPhase("starting");
    pressedAt.current = Date.now();
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPhase("idle");
        showToast("Mikrofon izni verilmedi. Sistem ayarlarından Ciklet için mikrofonu açabilirsin.", "error");
        return;
      }
      await prepareRecordingMode();
      await recorder.prepareToRecordAsync();
      levels.current = [];
      lastDuration.current = 0;
      recorder.record();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setPhase("recording");
    } catch {
      setPhase("idle");
      await endRecordingMode();
      showToast("Kayıt başlatılamadı.", "error");
    }
  }, [phase, recorder]);

  /**
   * Mikrofon bırakıldı: uzun basışsa gönder, kısa dokunuşsa kilitli kayıt
   * sürsün. Kilitliyken düğmeye yeniden dokunmak da buraya düşer (basış
   * kaydın başından sayılır) ve gönderir. İzin sorusu sürerken bırakıldıysa
   * kayıt kilitli kalır — basılı tutma bitmiş, otomatik göndermek şaşırtırdı.
   */
  const release = useCallback(() => {
    const held = Date.now() - pressedAt.current;
    if (held >= HOLD_MS && phase === "recording") void finish(true);
  }, [finish, phase]);

  // Uygulama arka plana düşerse kayıt durur ve atılır: kullanıcı görmeden
  // mikrofon açık kalmasın, onaysız da gönderilmesin.
  useEffect(() => {
    // "starting" hariç: iOS izin sorusu uygulamayı kısa süre "inactive" yapar.
    if (phase !== "recording") return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "background") return;
      void finish(false);
      showToast("Uygulama arka plana geçtiği için kayıt iptal edildi.");
    });
    return () => subscription.remove();
  }, [finish, phase]);

  // Ekrandan çıkılırsa yarım kayıt atılır.
  useEffect(
    () => () => {
      try {
        if (recorder.isRecording) {
          void recorder.stop().catch(() => {});
          void endRecordingMode();
        }
      } catch {
        // Kayıtçı kancanın kendi temizliğinde serbest bırakılmış olabilir.
      }
    },
    [recorder]
  );

  return {
    phase,
    elapsedMs,
    level,
    start,
    release,
    cancel: () => void finish(false),
    send: () => void finish(true),
  };
}

/**
 * Kayıt sürerken yazı satırının yerini alan çubuk: iptal, süre, seviye.
 * Gönder, yerinde kalan mikrofon düğmesidir (bkz. composer).
 */
export function RecordingBar({
  elapsedMs,
  level,
  onCancel,
}: {
  elapsedMs: number;
  level: number;
  onCancel: () => void;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Sesli mesaj kaydediliyor, ${formatVoiceDuration(elapsedMs)}`}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 40,
        paddingHorizontal: spacing.xs,
        borderRadius: radii.xl,
        backgroundColor: colors.panel,
      }}
    >
      <Pressable
        onPress={onCancel}
        haptic="warning"
        accessibilityRole="button"
        accessibilityLabel="Kaydı iptal et"
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="trash" size={18} color={colors.danger} />
      </Pressable>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
      <Text style={{ width: 44, fontSize: 13, lineHeight: 18, ...fw(700), color: colors.danger, fontVariant: ["tabular-nums"] }}>
        {formatVoiceDuration(elapsedMs)}
      </Text>
      <View style={{ flex: 1, height: 22, flexDirection: "row", alignItems: "center", gap: 3 }} accessibilityElementsHidden>
        {Array.from({ length: 14 }, (_, index) => (
          <View
            key={index}
            style={{
              width: 3,
              height: `${Math.max(15, Math.min(100, level * 100 * (0.55 + ((index * 7) % 5) / 8)))}%`,
              borderRadius: 2,
              backgroundColor: colors.danger,
              opacity: 0.8,
            }}
          />
        ))}
      </View>
    </View>
  );
}
