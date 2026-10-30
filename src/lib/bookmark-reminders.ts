/**
 * Yer imi hatırlatıcısı ("Bana hatırlat") — ciklet-web
 * `lib/bookmark-reminders.ts` ile BİREBİR aynı seçenekler ve sınırlar.
 * Yarın 09:00 telefonun yerel saatidir; uca mutlak an (ISO) gider.
 */

export type ReminderPreset = "30m" | "1h" | "3h" | "tomorrow";

export const REMINDER_PRESETS: readonly { key: ReminderPreset; label: string }[] = [
  { key: "30m", label: "30 dakika sonra" },
  { key: "1h", label: "1 saat sonra" },
  { key: "3h", label: "3 saat sonra" },
  { key: "tomorrow", label: "Yarın 09:00" },
];

/** Hatırlatıcı en erken bu kadar sonrası için kurulabilir. */
export const REMINDER_MIN_LEAD_MS = 30_000;
/** En geç bir yıl sonrası (web ile aynı). */
export const REMINDER_MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

export function presetRemindAt(preset: ReminderPreset, now: Date = new Date()): Date {
  switch (preset) {
    case "30m":
      return new Date(now.getTime() + 30 * 60_000);
    case "1h":
      return new Date(now.getTime() + 60 * 60_000);
    case "3h":
      return new Date(now.getTime() + 3 * 60 * 60_000);
    case "tomorrow": {
      const at = new Date(now);
      at.setDate(at.getDate() + 1);
      at.setHours(9, 0, 0, 0);
      return at;
    }
  }
}

export function isValidRemindAt(at: Date, now: number = Date.now()): boolean {
  const ms = at.getTime();
  return Number.isFinite(ms) && ms >= now + REMINDER_MIN_LEAD_MS && ms <= now + REMINDER_MAX_AHEAD_MS;
}

/** "14:30" · "yarın 09:00" · "31 Eki 09:00" (web formatReminderWhen ile aynı). */
export function formatReminderWhen(at: Date, now: Date = new Date()): string {
  const time = at.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(at, now)) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(at, tomorrow)) return `yarın ${time}`;
  const date = at.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    ...(at.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${date} ${time}`;
}
