import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { usePreferences } from "@/stores/preferences";

/**
 * Uygulama sesleri — zil ve mesaj tonu (web: `lib/sounds/engine.ts`).
 *
 * Oynatıcılar ilk kullanımda kurulur ve yaşatılır: her çalışta yeniden
 * yüklemek, gelen aramada zilin yarım saniye geç başlamasına yol açıyordu.
 * Ses dosyaları `assets/sounds` altında; aynı dosyalar Android bildirim
 * kanalının (`ciklet-calls-v2`) zil sesi olarak da kullanılıyor.
 */

let ringtone: AudioPlayer | null = null;
let messageTone: AudioPlayer | null = null;
let modeReady: Promise<void> | null = null;

function ensureMode(): Promise<void> {
  modeReady ??= setAudioModeAsync({
    // Telefon sessizdeyken de zil duyulsun: gelen arama uygulamanın en
    // acil olayı ve kullanıcı sessiz modda da aranmayı bilmek ister.
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "doNotMix",
  }).catch(() => {});
  return modeReady;
}

/** Gelen arama zili — kapatılana kadar döner. */
export async function startRingtone(): Promise<void> {
  try {
    await ensureMode();
    ringtone ??= createAudioPlayer(require("../../assets/sounds/ringtone.wav"));
    ringtone.loop = true;
    ringtone.volume = 1;
    await ringtone.seekTo(0);
    ringtone.play();
  } catch {
    // Ses çalınamıyorsa titreşim yine de var; zil sessiz kalır, çağrı düşmez.
  }
}

export function stopRingtone(): void {
  try {
    ringtone?.pause();
    void ringtone?.seekTo(0);
  } catch {
    /* oynatıcı çoktan serbest bırakılmış */
  }
}

/** Kısa mesaj tonu — yalnızca tercih açıksa. */
export async function playMessageTone(): Promise<void> {
  if (!usePreferences.getState().notificationSounds) return;
  try {
    await ensureMode();
    messageTone ??= createAudioPlayer(require("../../assets/sounds/message.wav"));
    messageTone.volume = 0.9;
    await messageTone.seekTo(0);
    messageTone.play();
  } catch {
    /* sessiz geç */
  }
}
