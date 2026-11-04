import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "وسم خادم {server}",
    generic: "وسم الخادم",
  },
  settings: {
    title: "وسم الخادم",
    description: "يمكن للأعضاء عرض هذا الوسم بجانب أسمائهم. اختر من 2 إلى 4 أحرف أو أرقام وشارة رمز تعبيري.",
    tagLabel: "الوسم",
    tagPlaceholder: "TAG",
    tagHint: "من 2 إلى 4 أحرف أو أرقام",
    badgeLabel: "الشارة",
    badgeHint: "رمز تعبيري واحد",
    badgeClear: "إزالة الشارة",
    badgePick: "اختيار رمز تعبيري",
    preview: "معاينة",
    previewName: "مستخدم",
    enabledLabel: "السماح للأعضاء باستخدام الوسم",
    enabledDesc: "أثناء الإيقاف، لا يظهر الوسم في أي مكان.",
    needTag: "حدّد وسمًا قبل تفعيله.",
    invalidTag: "يجب أن يتكون الوسم من 2 إلى 4 أحرف أو أرقام.",
    save: "حفظ",
    saved: "حُفظ وسم الخادم.",
    saveFailed: "تعذّر حفظ وسم الخادم.",
  },
  profile: {
    title: "وسم الخادم",
    description: "اختر وسم الخادم الذي يظهر بجانب اسمك. لا تُدرج إلا الخوادم التي فعّلت وسمها.",
    none: "لا شيء",
    empty: "لست في أي خادم يمكنك استخدام وسمه.",
    selected: "محدد",
    updated: "حُدّث وسم الخادم الخاص بك.",
    removed: "أُزيل وسم الخادم الخاص بك.",
    failed: "تعذّر تغيير وسم الخادم الخاص بك.",
  },
  menu: {
    adopt: "اعتماد الوسم",
    remove: "إزالة الوسم",
  },
} satisfies Translation<typeof serverTagTr>;
