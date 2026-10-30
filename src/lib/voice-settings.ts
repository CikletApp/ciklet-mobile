/**
 * Ses kanalı ayarları — ciklet-web `src/lib/voice/channel-settings.ts`
 * kopyası (ortak paket yok). Seçenekler ve metinler web ile BİREBİR aynı
 * olmalı: biri değişirse diğeri de değişir.
 */

export const VOICE_USER_LIMIT_MAX = 99;
export const VOICE_BITRATE_MIN = 8_000;
export const VOICE_BITRATE_MAX = 96_000;
export const VOICE_BITRATE_DEFAULT = 64_000;

/** Bit hızı adımları (kbps) — web Kanal Ayarları ile aynı liste. */
export const VOICE_BITRATE_OPTIONS_KBPS = [8, 16, 24, 32, 48, 64, 80, 96] as const;

/** "auto" plana göre, "full" kamera en az 720p ve çözünürlük korunur. */
export type VideoQualityMode = "auto" | "full";

export const VIDEO_QUALITY_OPTIONS: readonly { value: VideoQualityMode; label: string }[] = [
  { value: "auto", label: "Otomatik" },
  { value: "full", label: "720p" },
];

export const AFK_TIMEOUT_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 60, label: "1 dakika" },
  { value: 300, label: "5 dakika" },
  { value: 900, label: "15 dakika" },
  { value: 1800, label: "30 dakika" },
  { value: 3600, label: "1 saat" },
];

export const AFK_TIMEOUT_DEFAULT = 300;

/** Token ucunun dolu kanal kodu ve kenar çubuğu/ekran metni. */
export const CHANNEL_FULL_CODE = "channel_full";
export const CHANNEL_FULL_MESSAGE = "Kanal dolu.";

/** AFK süpürmesinin taşıdığı kullanıcıya gösterilen bildirim. */
export const AFK_MOVED_MESSAGE = "Uzun süre boşta kaldığın için AFK kanalına taşındın.";

function asInteger(value: unknown): number | null {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) ? number : null;
}

/** Kullanıcı sınırı girdisi: 0-99 tam sayı, değilse `null`. */
export function parseUserLimit(value: unknown): number | null {
  const limit = asInteger(value);
  return limit !== null && limit >= 0 && limit <= VOICE_USER_LIMIT_MAX ? limit : null;
}

/** Kayıtlı bit hızını güvenli aralığa oturtur. */
export function readBitrate(value: unknown): number {
  const bitrate = asInteger(value);
  if (bitrate === null) return VOICE_BITRATE_DEFAULT;
  return Math.min(VOICE_BITRATE_MAX, Math.max(VOICE_BITRATE_MIN, bitrate));
}

export function readVideoQualityMode(value: unknown): VideoQualityMode {
  return value === "full" ? "full" : "auto";
}

export function isVoiceChannelFull(count: number, limit: number): boolean {
  return limit > 0 && count >= limit;
}

/** Kanal listesi rozeti: "3/5"; sınır yoksa `null`. */
export function formatUserLimit(count: number, limit: number): string | null {
  if (!(limit > 0)) return null;
  return `${count}/${limit}`;
}

/** Bit hızı seçeneğinin etiketi: "64 kbps (varsayılan)". */
export function bitrateLabel(kbps: number): string {
  return kbps * 1000 === VOICE_BITRATE_DEFAULT ? `${kbps} kbps (varsayılan)` : `${kbps} kbps`;
}

export function afkTimeoutLabel(seconds: number): string {
  return AFK_TIMEOUT_OPTIONS.find((option) => option.value === seconds)?.label ?? `${Math.round(seconds / 60)} dakika`;
}
