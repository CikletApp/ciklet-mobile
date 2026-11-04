import type { Translation } from "../../translation";
import type { gameStatsTr } from "../../game-stats.tr";

/** ar: game-stats.tr.ts (web locales/ar/game-stats.ts kopyası). */
export const gameStats = {
  card: {
    title: "إحصاءات اللعب",
    updated: "تم التحديث {time}",
    by: "بواسطة {app}",
  },
  verified: {
    label: "موثّق",
    tooltip: "لعبة موثّقة — تحقّقت Ciklet من مطوّرها",
  },
  privacy: {
    title: "إحصاءات اللعب",
    description: "إحصاءات تكتبها الألعاب والتطبيقات في قسم الألعاب في ملفك الشخصي. لا يرى أحد البطاقات المخفية.",
    empty: "لم تكتب أي لعبة إحصاءات في ملفك الشخصي بعد.",
    show: "عرض في ملفي الشخصي",
    remove: "إزالة",
    hidden: "مخفية",
  },
} satisfies Translation<typeof gameStatsTr>;
