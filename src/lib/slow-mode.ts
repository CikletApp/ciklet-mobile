/** Yavaş mod seçenekleri — ciklet-web `lib/slow-mode-options.ts` ile aynı. */
export const SLOW_MODE_MAX_SECONDS = 6 * 60 * 60;

export const SLOW_MODE_OPTIONS: { label: string; value: number }[] = [
  { label: "Kapalı", value: 0 },
  { label: "5 saniye", value: 5 },
  { label: "10 saniye", value: 10 },
  { label: "15 saniye", value: 15 },
  { label: "30 saniye", value: 30 },
  { label: "1 dakika", value: 60 },
  { label: "2 dakika", value: 120 },
  { label: "5 dakika", value: 300 },
  { label: "10 dakika", value: 600 },
  { label: "15 dakika", value: 900 },
  { label: "30 dakika", value: 1800 },
  { label: "1 saat", value: 3600 },
  { label: "2 saat", value: 7200 },
  { label: "6 saat", value: SLOW_MODE_MAX_SECONDS },
];

export function slowModeLabel(seconds: number | undefined | null): string {
  return SLOW_MODE_OPTIONS.find((option) => option.value === (seconds ?? 0))?.label ?? `${seconds} saniye`;
}
