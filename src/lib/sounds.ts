import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { SOUNDS, VOLUME_SCALE, type SoundId } from "@/lib/sound-catalog";
import { useCall } from "@/stores/call";
import { usePreferences } from "@/stores/preferences";
import { usePresenceStore } from "@/stores/presence";
import { useSoundSettings } from "@/stores/sound-settings";
import { useVoice } from "@/stores/voice";

/**
 * Uygulama sesleri — web `lib/sounds/engine.ts` karşılığı.
 *
 * Sesler kataloğdan (lib/sound-catalog) adıyla istenir: `playSound("mention")`.
 * Dosyalar web'in sentez tariflerinden üretildi (scripts/generate-sounds.mjs).
 *
 * Oynatıcılar ilk kullanımda kurulur ve yaşatılır: her çalışta yeniden
 * yüklemek, gelen aramada zilin yarım saniye geç başlamasına yol açıyordu.
 * `ringtone.wav` ve `message.wav` aynı zamanda Android bildirim kanallarının
 * sesi (app.json → expo-notifications `sounds`).
 */

let ringtone: AudioPlayer | null = null;
let ringback: AudioPlayer | null = null;
let busyTone: AudioPlayer | null = null;
let busyTimer: ReturnType<typeof setTimeout> | null = null;
/** Tek seferlik sesler; canlı ses oturumundakiler ayrı anahtarla (`id:live`). */
const players = new Map<string, AudioPlayer>();
/** Aynı sesin en son ne zaman çalındığı (kısıtlama için). */
const lastPlayedAt = new Map<SoundId, number>();
/** Geçici olarak bastırılan sesler (referans sayımlı, bkz. suppressSounds). */
const suppressed = new Map<SoundId, number>();

/**
 * Ses kipi türe göre ayrı. Zil ses odağını TAMAMEN alır ("doNotMix");
 * kısa tonlar "mixWithOthers" — Android'de odak istemez, kullanıcının
 * müziğini durdurmaz. Tonlar telefonun sessiz kipine uyar (iOS sessiz
 * anahtarı; Android'de zil kipi normal değilse çalmaz).
 */
type SoundMode = "ring" | "tone";
let currentMode: SoundMode | null = null;

/**
 * Sesli kanalda ya da bağlı aramada LiveKit ses oturumu açık. Kipi
 * değiştirmek iOS'ta oturumu `.playback`'e çevirip mikrofonu keser, Android'de
 * ses yönlendirmesini (hoparlör/kulaklık) sıfırlar; o sırada kipe dokunulmaz.
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

/* ── Kapılar (web engine.ts isAllowed / passesThrottle) ────────────────── */

function isAllowed(id: SoundId): boolean {
  const def = SOUNDS[id];
  const settings = useSoundSettings.getState();
  if ((suppressed.get(id) ?? 0) > 0) return false;
  if (!settings.enabled) return false;
  if (settings.mutedCategories.includes(def.category)) return false;
  if (def.category === "notification" && usePresenceStore.getState().selfStatus === "DND") return false;
  return true;
}

function passesThrottle(id: SoundId): boolean {
  const throttleMs = SOUNDS[id].throttleMs;
  if (throttleMs <= 0) return true;
  const now = Date.now();
  const last = lastPlayedAt.get(id);
  if (last !== undefined && now - last < throttleMs) return false;
  lastPlayedAt.set(id, now);
  return true;
}

function resolveVolume(id: SoundId, scale = 1): number {
  return Math.min(1, SOUNDS[id].volume * useSoundSettings.getState().masterVolume * VOLUME_SCALE * scale);
}

function playerFor(id: SoundId, live: boolean): AudioPlayer {
  const key = live ? `${id}:live` : id;
  let player = players.get(key);
  if (!player) {
    // Canlı ses oturumunda oynatıcı bitince iOS oturumunu KAPATMAMALI
    // (keepAudioSessionActive): kapatmak görüşmenin sesini keserdi.
    player = createAudioPlayer(SOUNDS[id].source, { keepAudioSessionActive: live });
    players.set(key, player);
  }
  return player;
}

export interface PlayOptions {
  /** Kataloğdaki seviyeyi ölçekler (0..1). */
  volume?: number;
  /** Kapıları atlar (ayarlar kapalı, DND, kısıtlama) — ayarlardaki "dinle". */
  force?: boolean;
}

/**
 * Tek seferlik ses. Hiçbir zaman fırlatmaz ve beklenmesi gerekmez.
 *
 * Bildirim sesleri (mesaj, etiketlenme, istek) sesli kanalda / aramada ve
 * zil çalarken çalınmaz — kart yine görünür. Ses/aktivite geri bildirimleri
 * görüşme sürerken de çalar; o sırada ses kipine dokunulmaz.
 */
export async function playSound(id: SoundId, options: PlayOptions = {}): Promise<void> {
  const def = SOUNDS[id];
  if (!def || def.loop) return;
  if (!options.force && !isAllowed(id)) return;
  const live = inLiveAudio();
  if (def.category === "notification" && !options.force) {
    // Bildirim sesleri ayrıca bildirim ayarındaki "Sesler" anahtarına uyar.
    if (!usePreferences.getState().notificationSounds) return;
    // Zil çalarken kip değiştirmek zili bozar; arama zaten dikkat çekiyor.
    if (live || useCall.getState().session?.status === "ringing") return;
  }
  if (!options.force && !passesThrottle(id)) return;
  const volume = resolveVolume(id, options.volume);
  if (volume <= 0) return;

  try {
    if (!live) await applyMode("tone");
    const player = playerFor(id, live);
    player.volume = volume;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    // Bozulan oynatıcı bir sonraki çalışta yeniden kurulur.
    const key = live ? `${id}:live` : id;
    try {
      players.get(key)?.remove();
    } catch {
      /* zaten serbest */
    }
    players.delete(key);
    if (__DEV__) console.warn(`[ses] ${id} çalınamadı`, error);
  }
}

/** Ayarlar ekranı: kapıları atlayarak sesi dinletir. */
export function previewSound(id: SoundId): void {
  void playSound(id, { force: true });
}

/**
 * Verilen sesleri geçici olarak susturur; dönen fonksiyon bastırmayı kaldırır
 * (referans sayımlı — web `suppressSounds`).
 */
export function suppressSounds(ids: SoundId[]): () => void {
  for (const id of ids) suppressed.set(id, (suppressed.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const id of ids) {
      const next = (suppressed.get(id) ?? 1) - 1;
      if (next > 0) suppressed.set(id, next);
      else suppressed.delete(id);
    }
  };
}

/** Oynatıcıları önceden kur — ilk mesajın tonu hazırlık sırasında kaybolmasın. */
export function primeSounds(): void {
  void useSoundSettings.getState().hydrate();
  try {
    playerFor("message", false);
  } catch (error) {
    if (__DEV__) console.warn("[ses] mesaj tonu yüklenemedi", error);
  }
}

/* ── Ziller ────────────────────────────────────────────────────────────── */

/** Gelen arama zili (web ringIncoming) — kapatılana kadar döner. */
export async function startRingtone(): Promise<void> {
  if (!isAllowed("ringIncoming")) return;
  try {
    if (!inLiveAudio()) await applyMode("ring");
    ringtone ??= createAudioPlayer(SOUNDS.ringIncoming.source);
    ringtone.loop = true;
    ringtone.volume = resolveVolume("ringIncoming");
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
 * Giden aramada çalma tonu (web ringOutgoing): karşı taraf açana, reddedene
 * ya da arama düşene kadar döner.
 */
export async function startRingback(): Promise<void> {
  if (!isAllowed("ringOutgoing")) return;
  try {
    if (!inLiveAudio()) await applyMode("ring");
    ringback ??= createAudioPlayer(SOUNDS.ringOutgoing.source);
    ringback.loop = true;
    ringback.volume = resolveVolume("ringOutgoing");
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

/** Meşgul sesi (karşı taraf reddetti): 450 Hz, 0,5 sn açık/kapalı, 3 kez. Web'de karşılığı yok. */
export async function playBusyTone(): Promise<void> {
  stopRingback();
  if (!useSoundSettings.getState().enabled) return;
  try {
    if (!inLiveAudio()) await applyMode("ring");
    busyTone ??= createAudioPlayer(require("../../assets/sounds/busy.wav"));
    busyTone.loop = false;
    busyTone.volume = 0.8 * useSoundSettings.getState().masterVolume;
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

/** Gelen mesaj tonu — `playSound("message")` kısayolu (bildirim görevi kullanıyor). */
export function playMessageTone(): Promise<void> {
  return playSound("message");
}

/**
 * Ses kipini kendisi kuran özellikler (sohbetteki sesli mesaj kaydı ve
 * oynatması) bittiğinde çağırır: önbellekteki kip artık doğru değil, bir
 * sonraki zil ya da ton kipi yeniden kursun.
 */
export function forgetSoundMode(): void {
  currentMode = null;
}
