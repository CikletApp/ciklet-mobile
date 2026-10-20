import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { useCall } from "@/stores/call";
import { usePreferences } from "@/stores/preferences";
import { useVoice } from "@/stores/voice";

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
let ringback: AudioPlayer | null = null;
let busyTone: AudioPlayer | null = null;
let busyTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Ses kipi türe göre ayrı. Zil ses odağını TAMAMEN alır ("doNotMix");
 * kısa mesaj tonu ise "mixWithOthers" — Android'de odak istemez, yani
 * kullanıcının müziğini durdurmaz ve odağı elinde tutmaz. Tek ortak
 * "doNotMix" kipi her mesajda müziği kesiyordu.
 */
type SoundMode = "ring" | "tone";
let currentMode: SoundMode | null = null;
let lastToneAt = 0;
/** Web ile aynı (`lib/sounds/registry.ts` message.throttleMs). */
const TONE_THROTTLE_MS = 350;

/**
 * Sesli kanalda ya da bağlı aramada LiveKit ses oturumu açık. iOS'ta kipi
 * değiştirmek oturumu `.playback`'e çevirip mikrofonu keser; o sırada kipe
 * dokunulmaz.
 */
const inLiveAudio = () =>
  Boolean(useVoice.getState().active) || useCall.getState().session?.status === "connected";

// Görüşme bitince LiveKit kategoriyi değiştirmiş olabilir: kip yeniden kurulsun.
useVoice.subscribe((state, prev) => {
  if (prev.active && !state.active) currentMode = null;
});
useCall.subscribe((state, prev) => {
  if (prev.session?.status === "connected" && state.session?.status !== "connected") currentMode = null;
  // Giden arama çalarken çalma sesi; açılınca, reddedilince ya da düşünce susar.
  const calling = state.session?.direction === "outgoing" && state.session.status === "calling";
  const wasCalling = prev.session?.direction === "outgoing" && prev.session.status === "calling";
  if (calling && !wasCalling) void startRingback();
  else if (!calling && wasCalling) stopRingback();
  if (!state.session && prev.session) stopBusyTone();
});

async function applyMode(kind: SoundMode): Promise<void> {
  if (currentMode === kind) return;
  currentMode = kind;
  try {
    await setAudioModeAsync(
      kind === "ring"
        ? {
            // Telefon sessizdeyken de zil duyulsun: gelen arama uygulamanın
            // en acil olayı ve kullanıcı sessiz modda da aranmayı bilmek ister.
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: "doNotMix",
          }
        : {
            // Mesaj tonu telefonun sessiz kipine uyar: iOS'ta sessiz anahtarı
            // (`.ambient`), Android'de zil kipi normal değilse (titreşim/sessiz)
            // çalınmaz.
            playsInSilentMode: false,
            shouldPlayInBackground: false,
            interruptionMode: "mixWithOthers",
          }
    );
  } catch (error) {
    // Reddedilen kip önbelleğe alınmaz; bir sonraki ses yeniden dener.
    if (currentMode === kind) currentMode = null;
    if (__DEV__) console.warn("[ses] ses kipi kurulamadı", error);
  }
}

/** Oynatıcıları önceden kur — ilk mesajın tonu hazırlık sırasında kaybolmasın. */
export function primeSounds(): void {
  try {
    messageTone ??= createAudioPlayer(require("../../assets/sounds/message.wav"));
  } catch (error) {
    if (__DEV__) console.warn("[ses] mesaj tonu yüklenemedi", error);
  }
}

/** Gelen arama zili — kapatılana kadar döner. */
export async function startRingtone(): Promise<void> {
  try {
    if (!inLiveAudio()) await applyMode("ring");
    ringtone ??= createAudioPlayer(require("../../assets/sounds/ringtone.wav"));
    ringtone.loop = true;
    ringtone.volume = 1;
    await ringtone.seekTo(0);
    ringtone.play();
  } catch (error) {
    // Ses çalınamıyorsa titreşim yine de var; zil sessiz kalır, çağrı düşmez.
    if (__DEV__) console.warn("[ses] zil çalınamadı", error);
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

/**
 * Giden aramada çalma sesi ("dıt… dıt…"): karşı taraf açana, reddedene ya
 * da arama düşene kadar döner. Türkiye çalma tonu: 450 Hz, 1 sn açık, 4 sn
 * kapalı (assets/sounds/ringback.wav). Eskiden arayan hiçbir şey duymuyor,
 * aramanın gerçekten çalıp çalmadığını anlamıyordu.
 */
export async function startRingback(): Promise<void> {
  try {
    if (!inLiveAudio()) await applyMode("ring");
    ringback ??= createAudioPlayer(require("../../assets/sounds/ringback.wav"));
    ringback.loop = true;
    ringback.volume = 0.8;
    await ringback.seekTo(0);
    ringback.play();
  } catch (error) {
    if (__DEV__) console.warn("[ses] çalma sesi çalınamadı", error);
  }
}

export function stopRingback(): void {
  try {
    ringback?.pause();
    void ringback?.seekTo(0);
  } catch {
    /* oynatıcı çoktan serbest bırakılmış */
  }
}

/** Meşgul sesi (karşı taraf reddetti): 450 Hz, 0,5 sn açık/kapalı, 3 kez. */
export async function playBusyTone(): Promise<void> {
  stopRingback();
  try {
    if (!inLiveAudio()) await applyMode("ring");
    busyTone ??= createAudioPlayer(require("../../assets/sounds/busy.wav"));
    busyTone.loop = false;
    busyTone.volume = 0.8;
    await busyTone.seekTo(0);
    busyTone.play();
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(stopBusyTone, 3_200);
  } catch (error) {
    if (__DEV__) console.warn("[ses] meşgul sesi çalınamadı", error);
  }
}

export function stopBusyTone(): void {
  if (busyTimer) clearTimeout(busyTimer);
  busyTimer = null;
  try {
    busyTone?.pause();
  } catch {
    /* zaten durmuş */
  }
}

/**
 * Kısa mesaj tonu — yalnızca tercih açıksa. Aynı mesaj için iki olay
 * (kanal mesajı + etiketlenme) iki kez çalmasın diye kısıtlanır. Sesli
 * kanalda / aramada çalınmaz (bkz. `inLiveAudio`); kart yine görünür.
 */
export async function playMessageTone(): Promise<void> {
  if (!usePreferences.getState().notificationSounds) return;
  // Zil çalarken kip değiştirmek zili bozar; arama zaten dikkat çekiyor.
  if (inLiveAudio() || useCall.getState().session?.status === "ringing") return;
  const now = Date.now();
  if (now - lastToneAt < TONE_THROTTLE_MS) return;
  lastToneAt = now;
  try {
    await applyMode("tone");
    messageTone ??= createAudioPlayer(require("../../assets/sounds/message.wav"));
    messageTone.volume = 0.9;
    await messageTone.seekTo(0);
    messageTone.play();
  } catch (error) {
    // Bozulan oynatıcı bir sonraki tonda yeniden kurulur.
    try {
      messageTone?.remove();
    } catch {
      /* zaten serbest */
    }
    messageTone = null;
    if (__DEV__) console.warn("[ses] mesaj tonu çalınamadı", error);
  }
}

/**
 * Ses kipini kendisi kuran özellikler (sohbetteki sesli mesaj kaydı ve
 * oynatması) bittiğinde çağırır: önbellekteki kip artık doğru değil, bir
 * sonraki zil ya da ton kipi yeniden kursun.
 */
export function forgetSoundMode(): void {
  currentMode = null;
}
