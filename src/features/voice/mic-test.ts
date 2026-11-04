import { useCallback, useEffect, useRef, useState } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";

import { showToast } from "@/components/ui";
import { endRecordingMode, inLiveAudio, levelFromMetering, prepareRecordingMode } from "@/features/chat/voice-message";

/**
 * Mikrofon Testi — web `hooks/use-mic-test` karşılığı: test açıkken
 * mikrofon seviyesi canlı ölçülür (0–1). Mobilde kendi sesini geri
 * dinletmek hoparlörde yankı/uğultu yapacağı için yalnızca seviye
 * gösterilir; kayıt diske yazılsa da hiçbir yere gönderilmez ve test
 * bitince atılır. Görüşmedeyken mikrofon LiveKit'te, test açılmaz.
 */
const OPTIONS = { ...RecordingPresets.LOW_QUALITY, numberOfChannels: 1, isMeteringEnabled: true };

export function useMicTest() {
  const recorder = useAudioRecorder(OPTIONS);
  const [isTesting, setTesting] = useState(false);
  const [volumeLevel, setLevel] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (!isTesting) return;
    const timer = setInterval(() => setLevel(levelFromMetering(recorder.getStatus().metering)), 80);
    return () => clearInterval(timer);
  }, [isTesting, recorder]);

  const stopTest = useCallback(async () => {
    if (!running.current) return;
    running.current = false;
    setTesting(false);
    setLevel(0);
    try {
      await recorder.stop();
    } catch {
      /* zaten durmuş */
    }
    await endRecordingMode();
  }, [recorder]);

  const startTest = useCallback(async () => {
    if (running.current) return;
    if (inLiveAudio()) {
      showToast("Görüşmedeyken mikrofon testi yapılamaz.");
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      showToast("Mikrofon izni verilmedi. Sistem ayarlarından Ciklet için mikrofonu açabilirsin.", "error");
      return;
    }
    try {
      running.current = true;
      await prepareRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setTesting(true);
    } catch {
      running.current = false;
      await endRecordingMode();
      showToast("Mikrofon açılamadı.", "error");
    }
  }, [recorder]);

  const toggleTest = useCallback(() => {
    void (running.current ? stopTest() : startTest());
  }, [startTest, stopTest]);

  // Ekrandan çıkınca test açık kalmasın — mikrofon serbest bırakılır.
  useEffect(() => () => void stopTest(), [stopTest]);

  return { isTesting, volumeLevel, toggleTest, stopTest };
}
