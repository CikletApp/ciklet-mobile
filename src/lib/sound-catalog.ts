/**
 * Ses kataloğu — web `lib/sounds/registry.ts` ile aynı kimlikler, kategoriler,
 * seviyeler ve kısıtlama aralıkları.
 *
 * Web sesleri Web Audio ile sentezliyor; mobilde aynı tarifler
 * `scripts/generate-sounds.mjs` ile WAV'a dökülüp `assets/sounds` altına
 * kondu. Bileşenler sesi adıyla ister (`playSound("mention")`); tarif burada.
 */

export type SoundId =
  | "message"
  | "mention"
  | "friendRequest"
  | "micOn"
  | "micOff"
  | "deafen"
  | "undeafen"
  | "voiceJoin"
  | "voiceLeave"
  | "activityJoin"
  | "activityLeave"
  | "ringIncoming"
  | "ringOutgoing";

/**
 * DND yalnızca `notification` grubunu susturur: mikrofonu kapattığında tıkı
 * duymamak "rahatsız edilmemek" değil, arayüzün bozulması olurdu (web ile aynı).
 */
export type SoundCategory = "notification" | "voice" | "activity";

export interface SoundDefinition {
  label: string;
  category: SoundCategory;
  /** Taban seviye (0..1) — web kataloğundaki değer; ana seviyeyle çarpılır. */
  volume: number;
  /** Aynı sesin art arda çalınabileceği en kısa aralık (ms). */
  throttleMs: number;
  /** Döngülü ses (zil); `playSound` ile değil `startLoop` ile çalınır. */
  loop?: boolean;
  source: number;
}

export const SOUNDS: Record<SoundId, SoundDefinition> = {
  message: {
    label: "Yeni mesaj",
    category: "notification",
    volume: 0.4,
    throttleMs: 350,
    source: require("../../assets/sounds/message.wav"),
  },
  mention: {
    label: "Etiketlenme",
    category: "notification",
    volume: 0.45,
    throttleMs: 350,
    source: require("../../assets/sounds/mention.wav"),
  },
  friendRequest: {
    label: "Arkadaşlık isteği",
    category: "notification",
    volume: 0.4,
    throttleMs: 500,
    source: require("../../assets/sounds/friend-request.wav"),
  },
  micOn: {
    label: "Mikrofon açık",
    category: "voice",
    volume: 0.3,
    throttleMs: 60,
    source: require("../../assets/sounds/mic-on.wav"),
  },
  micOff: {
    label: "Mikrofon kapalı",
    category: "voice",
    volume: 0.3,
    throttleMs: 60,
    source: require("../../assets/sounds/mic-off.wav"),
  },
  deafen: {
    label: "Hoparlör kapalı",
    category: "voice",
    volume: 0.3,
    throttleMs: 60,
    source: require("../../assets/sounds/deafen.wav"),
  },
  undeafen: {
    label: "Hoparlör açık",
    category: "voice",
    volume: 0.3,
    throttleMs: 60,
    source: require("../../assets/sounds/undeafen.wav"),
  },
  voiceJoin: {
    label: "Sesli kanala giriş",
    category: "voice",
    volume: 0.25,
    throttleMs: 200,
    source: require("../../assets/sounds/voice-join.wav"),
  },
  voiceLeave: {
    label: "Sesli kanaldan çıkış",
    category: "voice",
    volume: 0.25,
    throttleMs: 200,
    source: require("../../assets/sounds/voice-leave.wav"),
  },
  activityJoin: {
    label: "Aktiviteye katılma",
    category: "activity",
    volume: 0.28,
    throttleMs: 200,
    source: require("../../assets/sounds/activity-join.wav"),
  },
  activityLeave: {
    label: "Aktiviteden ayrılma",
    category: "activity",
    volume: 0.28,
    throttleMs: 200,
    source: require("../../assets/sounds/activity-leave.wav"),
  },
  ringIncoming: {
    label: "Gelen arama zili",
    category: "notification",
    volume: 0.42,
    throttleMs: 0,
    loop: true,
    source: require("../../assets/sounds/ringtone.wav"),
  },
  ringOutgoing: {
    label: "Giden arama tonu",
    category: "notification",
    volume: 0.2,
    throttleMs: 0,
    loop: true,
    source: require("../../assets/sounds/ringback.wav"),
  },
};

/**
 * Web taban seviyeleri Web Audio kazancı (tepe 1 olan bir osilatörün
 * çarpanı). Mobil dosyalar tepe 0,9'a normalize; oynatıcı seviyesi bu
 * çarpanla ölçeklenir — mesaj tonu (0,4) eski mobil seviyesine (0,9) denk
 * gelir, sesler arasındaki oran web'deki gibi kalır.
 */
export const VOLUME_SCALE = 2.25;

/** Ayarlarda dinlenebilen sesler — döngülü ziller hariç (web PREVIEWABLE_SOUNDS). */
export const PREVIEWABLE_SOUNDS = (Object.keys(SOUNDS) as SoundId[]).filter((id) => !SOUNDS[id].loop);

export const SOUND_CATEGORY_ORDER: SoundCategory[] = ["notification", "voice", "activity"];

export const SOUND_CATEGORY_LABELS: Record<SoundCategory, { label: string; hint: string }> = {
  notification: {
    label: "Bildirimler",
    hint: "Mesaj, etiketlenme, arkadaşlık isteği ve arama zilleri. Durumun “Rahatsız Etmeyin” iken bunlar çalmaz.",
  },
  voice: {
    label: "Ses ve mikrofon",
    hint: "Mikrofon, hoparlör ve sesli kanala giriş/çıkış sesleri.",
  },
  activity: {
    label: "Aktiviteler",
    hint: "Bir aktiviteye katıldığında ve ayrıldığında çalar.",
  },
};
