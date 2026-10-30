/**
 * Tekrarlayan etkinlikler — web `lib/server-events/recurrence` arayüz
 * yardımcılarının mobil eşi (hazır seçenekler + okunur metin). Doğrulama
 * ve tekrar hesabı sunucuda; burada yalnızca seçenek üretilir.
 *
 * Gün numaraları Discord'daki gibi: 0 = Pazartesi … 6 = Pazar. Kural
 * cihazın saat diliminde kurulur (web tarayıcının dilimini gönderiyor);
 * dilim okunamazsa sunucu Europe/Istanbul varsayar.
 */
import type { RecurrencePresetId, RecurrenceRule } from "@/api/types";

const WEEKDAYS_MON_FRI = [0, 1, 2, 3, 4];
const WEEKDAY_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MONTH_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** Cihazın IANA saat dilimi; okunamazsa undefined (sunucu varsayılanı). */
export function deviceTimeZone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === "string" && tz ? tz : undefined;
  } catch {
    return undefined;
  }
}

/** Web `describeRecurrence` (TR) ile aynı metinler. */
export function describeRecurrence(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  switch (rule.frequency) {
    case "daily":
      if (rule.byWeekday && rule.byWeekday.join() === WEEKDAYS_MON_FRI.join()) return "Hafta içi her gün";
      if (rule.byWeekday?.length) return `Her ${rule.byWeekday.map((d) => WEEKDAY_TR[d]).join(", ")}`;
      return "Her gün";
    case "weekly": {
      const day = WEEKDAY_TR[rule.byWeekday?.[0] ?? 0];
      return rule.interval === 2 ? `İki haftada bir ${day}` : `Her hafta ${day}`;
    }
    case "monthly":
      if (rule.byNWeekday?.length) {
        const [{ n, day }] = rule.byNWeekday;
        return `Her ay ${n}. ${WEEKDAY_TR[day]}`;
      }
      return `Her ayın ${rule.byMonthDay?.[0]}. günü`;
    case "yearly":
      return `Her yıl ${rule.byMonthDay?.[0]} ${MONTH_TR[(rule.byMonth?.[0] ?? 1) - 1]}`;
    default:
      return null;
  }
}

/**
 * Başlangıca (cihazın yerel saati) göre sunulan seçenekler — web
 * `recurrencePresets` ile aynı sıra. "Hafta içi her gün" yalnızca başlangıç
 * hafta içindeyse.
 */
export function recurrencePresets(startsAt: Date): { id: RecurrencePresetId; label: string; rule: RecurrenceRule | null }[] {
  const timeZone = deviceTimeZone();
  const tz = timeZone ? { timeZone } : {};
  const weekday = (startsAt.getDay() + 6) % 7;
  const day = startsAt.getDate();
  const month = startsAt.getMonth() + 1;
  const rules: { id: RecurrencePresetId; rule: RecurrenceRule | null }[] = [
    { id: "none", rule: null },
    { id: "daily", rule: { frequency: "daily", interval: 1, ...tz } },
  ];
  if (weekday <= 4) rules.push({ id: "weekdays", rule: { frequency: "daily", interval: 1, byWeekday: WEEKDAYS_MON_FRI, ...tz } });
  rules.push(
    { id: "weekly", rule: { frequency: "weekly", interval: 1, byWeekday: [weekday], ...tz } },
    { id: "biweekly", rule: { frequency: "weekly", interval: 2, byWeekday: [weekday], ...tz } },
    { id: "monthlyNth", rule: { frequency: "monthly", interval: 1, byNWeekday: [{ n: Math.ceil(day / 7), day: weekday }], ...tz } },
    { id: "monthlyDate", rule: { frequency: "monthly", interval: 1, byMonthDay: [day], ...tz } },
    { id: "yearly", rule: { frequency: "yearly", interval: 1, byMonth: [month], byMonthDay: [day], ...tz } },
  );
  return rules.map((item) => ({ ...item, label: item.rule ? describeRecurrence(item.rule) ?? "" : "Tekrarlanmaz" }));
}

/** Hangi hazır seçenek bu kural? (Düzenleme formu; web `presetIdOf`.) */
export function presetIdOf(rule: RecurrenceRule | null | undefined): RecurrencePresetId {
  if (!rule) return "none";
  switch (rule.frequency) {
    case "daily":
      return rule.byWeekday ? "weekdays" : "daily";
    case "weekly":
      return rule.interval === 2 ? "biweekly" : "weekly";
    case "monthly":
      return rule.byNWeekday?.length ? "monthlyNth" : "monthlyDate";
    case "yearly":
      return "yearly";
  }
}

/**
 * Tekrarlayan etkinliği bitirirken/iptal ederken/silerken Discord'un sorduğu
 * kapsam (web `RecurrenceScope`): "occurrence" yalnızca bu tekrarı etkiler —
 * etkinlik sıradaki tekrara kayar; "series" tüm seriyi.
 */
export type RecurrenceScope = "occurrence" | "series";

/** "Bu etkinlik / Tüm seri" metinleri — web `RECURRENCE_SCOPE_TEXT` ile AYNI. */
export const RECURRENCE_SCOPE_TEXT = {
  complete: {
    title: "Etkinliği bitir",
    description: "Bu tekrarlayan bir etkinlik. Yalnızca bu etkinliği mi, yoksa serinin tamamını mı bitirmek istiyorsun? Yalnızca bu etkinliği bitirirsen sıradaki tekrar planlanır.",
  },
  cancel: {
    title: "Etkinliği iptal et",
    description: "Bu tekrarlayan bir etkinlik. Yalnızca bu etkinliği mi, yoksa serinin tamamını mı iptal etmek istiyorsun? Yalnızca bu etkinliği iptal edersen sıradaki tekrar planlanır.",
  },
  delete: {
    title: "Etkinliği sil",
    description: "Bu tekrarlayan bir etkinlik. Yalnızca bu etkinliği mi, yoksa serinin tamamını mı silmek istiyorsun? Serinin tamamı kalıcı olarak silinir.",
  },
  occurrence: "Bu etkinlik",
  series: "Tüm seri",
  cancelButton: "Vazgeç",
  rolled: "Bu tekrar atlandı; sıradaki tekrar planlandı.",
} as const;
