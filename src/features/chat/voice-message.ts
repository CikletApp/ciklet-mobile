import { setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { forgetSoundMode } from "@/lib/sounds";
import { VOICE_WAVEFORM_BARS } from "@/lib/message-extras";
import { useCall } from "@/stores/call";
import { useVoice } from "@/stores/voice";

/**
 * Sesli mesaj (web lib/voice-message) — kayıt ve oynatmanın ses kipi,
 * aynı anda tek oynatma kuralı ve dalga formu.
 *
 * Mobil kayıt AAC/M4A (`audio/mp4`): iki platformda da yerel kodlayıcı
 * var, web tarayıcıları da çalıyor. Dalga formu kayıt sırasında okunan
 * seviye ölçümlerinden (dBFS) çıkarılır; web'deki gibi PCM'i yeniden
 * çözmek mobilde ayrı bir çözücü gerektirirdi.
 */

/** Sesli kanalda ya da bağlı aramada LiveKit ses oturumu açık — kipe dokunulmaz (bkz. lib/sounds). */
export function inLiveAudio(): boolean {
  return Boolean(useVoice.getState().active) || useCall.getState().session?.status === "connected";
}

let active: AudioPlayer | null = null;

/** Bu oynatıcı çalmaya başlıyor: çalan başka sesli mesaj varsa durur. */
export function claimPlayback(player: AudioPlayer): void {
  if (active && active !== player) {
    try {
      active.pause();
    } catch {
      /* oynatıcı çoktan serbest bırakılmış */
    }
  }
  active = player;
}

export function releasePlayback(player: AudioPlayer): void {
  if (active === player) active = null;
}

/**
 * Sesli mesajı kullanıcı kendisi başlattı: telefon sessizde de duyulsun,
 * müzik dursun (WhatsApp gibi).
 */
export async function preparePlaybackMode(): Promise<void> {
  if (inLiveAudio()) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
      allowsRecording: false,
    });
  } catch {
    /* kip kurulamazsa varsayılanla çalar */
  } finally {
    forgetSoundMode();
  }
}

export async function prepareRecordingMode(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
    shouldPlayInBackground: false,
    interruptionMode: "doNotMix",
  });
  forgetSoundMode();
}

export async function endRecordingMode(): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: false });
  } catch {
    /* bir sonraki ses kipi yeniden kurar */
  } finally {
    forgetSoundMode();
  }
}

/** dBFS (−160…0) → 0–1 genlik; −50 dB altı sessizlik sayılır. */
export function levelFromMetering(db: number | undefined): number {
  if (typeof db !== "number" || !Number.isFinite(db)) return 0;
  const clamped = Math.max(-50, Math.min(0, db));
  return (clamped + 50) / 50;
}

/** Kayıt boyunca toplanan seviyelerden `bars` çubuk; en yükseği 1 (web `computeWaveform`). */
export function waveformFromLevels(levels: number[], bars = VOICE_WAVEFORM_BARS): number[] {
  if (levels.length === 0) return [];
  const out: number[] = [];
  for (let b = 0; b < bars; b += 1) {
    const start = Math.floor((b * levels.length) / bars);
    const end = Math.max(start + 1, Math.floor(((b + 1) * levels.length) / bars));
    let sum = 0;
    for (let i = start; i < end && i < levels.length; i += 1) sum += levels[i];
    out.push(sum / Math.max(1, Math.min(end, levels.length) - start));
  }
  const peak = Math.max(...out, 1e-6);
  return out.map((v) => Number((v / peak).toFixed(3)));
}

export function voiceFileName(): string {
  return `sesli-mesaj-${new Date().toISOString().replace(/[:.]/g, "-")}.m4a`;
}
