import type { Translation } from "../../translation";
import type { accountSwitcherTr } from "../../account-switcher.tr";


/** English for account-switcher.tr.ts. */
export const accountSwitcher = {
  menuItem: "تبديل الحسابات",
  manage: "إدارة الحسابات",
  add: "إضافة حساب",
  title: "إدارة الحسابات",
  description: "بدّل بين {max, plural, zero {# حساب} one {حساب واحد} two {حسابين} few {# حسابات} many {# حسابًا} other {# حساب}} كحد أقصى على هذا الجهاز دون تسجيل الدخول من جديد.",
  current: "الحساب النشط",
  switch: "تبديل",
  switching: "جارٍ التبديل…",
  remove: "إزالة",
  removeConfirm: "هل تريد إزالة {name} من قائمة الحسابات على هذا الجهاز؟ ستحتاج إلى تسجيل الدخول مجددًا للعودة إليه.",
  needsLogin: "سجّل الدخول مجددًا",
  limitReached: "يمكنك إضافة {max, plural, zero {# حساب} one {حساب واحد} two {حسابين} few {# حسابات} many {# حسابًا} other {# حساب}} كحد أقصى. أزل حسابًا لإضافة آخر.",
  failed: "تعذّر تبديل الحسابات. حاول مرة أخرى.",
  notFound: "لم يعد هذا الحساب موجودًا في القائمة.",
  removed: "أُزيل الحساب من القائمة.",
  addTitle: "إضافة حساب",
  addDescription: "سجّل الدخول بالحساب الذي تريد إضافته. سيبقى حسابك الحالي في القائمة.",
  addCancel: "إلغاء",
  savedTitle: "الحسابات المحفوظة",
  savedDescription: "بدّل إلى حساب استخدمته على هذا الجهاز.",
  orSignIn: "أو سجّل الدخول بحساب آخر",
  inCallWarning: "سيؤدي تبديل الحسابات إلى قطع اتصالك الصوتي.",
} satisfies Translation<typeof accountSwitcherTr>;
