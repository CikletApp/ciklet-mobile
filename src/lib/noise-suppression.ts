/**
 * Gürültü engelleme kipi — ciklet-web `src/lib/noise-suppression.ts` ile aynı
 * kipler ve metinler (Discord: Kapalı / Standart / Krisp).
 *
 * Mobilde YALNIZCA "off" ve "standard" var: "Gelişmiş" web/masaüstünde
 * RNNoise'u bir AudioWorklet'te çalıştırıyor; React Native WebRTC'de
 * mikrofon akışına JS'ten işlemci takılamıyor (AudioWorklet yok, yerel
 * modül gerekir). "standard" WebRTC'nin yerleşik gürültü bastırması
 * (`googNoiseSuppression`; Android/iOS köprüsü `noiseSuppression`
 * kısıtını okuyor) — bugünkü varsayılan.
 */
export type NoiseSuppressionMode = "off" | "standard";

export const NOISE_SUPPRESSION_DEFAULT: NoiseSuppressionMode = "standard";

export function isNoiseSuppressionMode(value: unknown): value is NoiseSuppressionMode {
  return value === "off" || value === "standard";
}

/** Kayıtlı değeri okur; tanınmayan değer (ör. web'den gelen "advanced") varsayılana düşer. */
export function readNoiseSuppressionMode(value: unknown): NoiseSuppressionMode {
  return isNoiseSuppressionMode(value) ? value : NOISE_SUPPRESSION_DEFAULT;
}

/** WebRTC yakalama kısıtı (LiveKit audioCaptureDefaults / restartTrack). */
export function noiseSuppressionConstraints(mode: NoiseSuppressionMode): { noiseSuppression: boolean } {
  return { noiseSuppression: mode !== "off" };
}

/**
 * Mikrofon yakalama kısıtları — gürültü engelleme + Yankı Giderme + Otomatik
 * Kazanç (web Ayarlar → Ses ve Video ile aynı üç anahtar). react-native-webrtc
 * `echoCancellation` / `autoGainControl` kısıtlarını yerel ses işlemcisine iletir.
 */
export interface AudioCaptureSettings {
  noiseSuppressionMode: NoiseSuppressionMode;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export function audioCaptureConstraints(settings: AudioCaptureSettings): {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
} {
  return {
    ...noiseSuppressionConstraints(settings.noiseSuppressionMode),
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
  };
}
