import type { Translation } from "../../translation";
import type { gameDetailTr } from "../../game-detail.tr";

/** ar — game-detail.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const gameDetail = {
  fallbackTitle: "لعبة",
  close: "إغلاق",
  openOnSteam: "فتح في Steam",
  viewOnSteam: "عرض في Steam",
  openWebsite: "فتح الموقع الرسمي",
  viewOnIgdb: "عرض في IGDB",
  error: {
    gameNotFound: "معلومات هذه اللعبة غير متاحة.",
    programNotFound: "معلومات هذا التطبيق غير متاحة.",
    gameFailed: "تعذّر تحميل معلومات اللعبة.",
    programFailed: "تعذّر تحميل معلومات التطبيق.",
  },
  about: {
    title: "حول",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",
    source: "المصدر:",
    wikipediaLang: "ويكيبيديا ({lang})",
  },
  details: {
    title: "التفاصيل",
    genre: "النوع",
    category: "الفئة",
    developer: "المطوّر",
    publisher: "الناشر",
    releaseDate: "تاريخ الإصدار",
    firstRelease: "الإصدار الأول",
    platform: "المنصة",
    license: "الترخيص",
    website: "الموقع الرسمي",
    steamStore: "متجر Steam",
  },
  license: {
    openSource: "مفتوح المصدر",
    freeware: "مجاني",
    proprietary: "مملوك",
  },
  sources: "المصدر: {list}",
  credits: {
    title: "الصور: ويكيميديا كومنز",
    logo: "الشعار",
    screenshot: "لقطة شاشة",
    unknownLicense: "الترخيص في صفحة الملف",
  },
} satisfies Translation<typeof gameDetailTr>;
