import { PREMIUM_TIERS, SERVER_PERKS } from "@/lib/server-boost";

/**
 * Yayın kalitesi (ekran paylaşımı ve kamera) — ciklet-web `lib/stream-quality.ts`
 * ile aynı seçenekler, sıralama ve plan sınırları (Discord "Stream Quality").
 * Sınır istemcide uygulanır: SFU parçayı yeniden kodlamadığı için çözünürlük
 * sunucuda doğrulanamaz.
 */
export type StreamQuality = "720p30" | "720p60" | "1080p30" | "1080p60" | "source";

export interface StreamQualityOption {
  id: StreamQuality;
  label: string;
  width: number;
  height: number;
  fps: number;
  /** bit/sn; ekran paylaşımı için üst sınır. */
  bitrate: number;
}

export const STREAM_QUALITY_OPTIONS: readonly StreamQualityOption[] = [
  { id: "720p30", label: "720p · 30 fps", width: 1280, height: 720, fps: 30, bitrate: 2_500_000 },
  { id: "720p60", label: "720p · 60 fps", width: 1280, height: 720, fps: 60, bitrate: 3_500_000 },
  { id: "1080p30", label: "1080p · 30 fps", width: 1920, height: 1080, fps: 30, bitrate: 4_000_000 },
  { id: "1080p60", label: "1080p · 60 fps", width: 1920, height: 1080, fps: 60, bitrate: 6_000_000 },
  { id: "source", label: "Kaynak", width: 0, height: 0, fps: 60, bitrate: 8_000_000 },
];

/** Ayarlar ekranındaki ipucu anahtarları (`settingsMedia.voice.streamQuality.hints.*`). */
export const STREAM_QUALITY_HINT_KEYS = {
  "720p30": "hd30",
  "720p60": "hd60",
  "1080p30": "fhd30",
  "1080p60": "fhd60",
  source: "source",
} as const satisfies Record<StreamQuality, string>;

/** Takviyeli sunucuların sunduğu kaliteler: her planda seçilebilir, yayında sunucu seviyesine göre uygulanır. */
export const BOOST_STREAM_QUALITIES: ReadonlySet<StreamQuality> = new Set<StreamQuality>(
  PREMIUM_TIERS.map((tier) => SERVER_PERKS[tier].streamQuality)
);

const ORDER: Record<StreamQuality, number> = { "720p30": 0, "720p60": 1, "1080p30": 2, "1080p60": 3, source: 4 };

export const STREAM_QUALITY_DEFAULT: StreamQuality = "720p30";

export function isStreamQuality(value: unknown): value is StreamQuality {
  return typeof value === "string" && value in ORDER;
}

/** Mentol planının izin verdiği en yüksek kalite (web `PLAN_MAX_STREAM_QUALITY`). */
export const PLAN_MAX_STREAM_QUALITY: Record<"FREE" | "PLUS" | "PRO", StreamQuality> = {
  FREE: "720p30",
  PLUS: "1080p30",
  PRO: "source",
};

export function qualityAllowed(quality: StreamQuality, max: StreamQuality): boolean {
  return ORDER[quality] <= ORDER[max];
}

/** İki tavandan yüksek olanı (Mentol planı ile sunucunun Takviye seviyesi). */
export function maxStreamQuality(a: StreamQuality, b: StreamQuality): StreamQuality {
  return ORDER[a] >= ORDER[b] ? a : b;
}

export function clampStreamQuality(quality: StreamQuality, max: StreamQuality): StreamQuality {
  return qualityAllowed(quality, max) ? quality : max;
}

export function streamQualityOption(quality: StreamQuality): StreamQualityOption {
  return STREAM_QUALITY_OPTIONS.find((o) => o.id === quality) ?? STREAM_QUALITY_OPTIONS[0];
}

/** Yayında geçerli kalite: seçim, plan tavanı ile (varsa) sunucunun Takviye tavanının büyüğüne kırpılır. */
export function effectiveStreamQuality(
  quality: StreamQuality,
  plan: "FREE" | "PLUS" | "PRO",
  boostMax: StreamQuality | null | undefined
): StreamQuality {
  const planMax = PLAN_MAX_STREAM_QUALITY[plan];
  return clampStreamQuality(quality, boostMax ? maxStreamQuality(planMax, boostMax) : planMax);
}
