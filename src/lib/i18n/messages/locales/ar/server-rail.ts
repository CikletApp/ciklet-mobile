import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** ar — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "الخوادم",
  home: "الرسائل المباشرة",
  addServer: "إضافة خادم",
  discover: "استكشاف الخوادم",
  download: "تنزيل التطبيقات",
  newActivity: "نشاط جديد في #{channel}",
  voiceCount: "{count} في الصوت",
  unread: "{count} غير مقروءة",
  keyboardHint: "Alt+Shift+أعلى/أسفل للنقل",
  folder: {
    defaultName: "مجلد خوادم",
    aria: "مجلد {name}، {count} خوادم",
    markRead: "وضع علامة مقروء على المجلد",
    moveTo: "نقل إلى:",
    settings: "إعدادات المجلد",
    closeAll: "إغلاق كل المجلدات",
  },
  move: {
    top: "إلى الأعلى",
    up: "للأعلى خطوة",
    down: "للأسفل خطوة",
    bottom: "إلى الأسفل",
  },
  server: {
    markRead: "وضع علامة كمقروء",
    removeFromFolder: "إزالة من المجلد",
    addToFolder: "إضافة إلى المجلد: {name}",
  },
  settings: {
    title: "إعدادات المجلد",
    name: "اسم المجلد",
    color: "لون المجلد",
    customColor: "لون مخصص",
    done: "تم",
  },
  toast: {
    saveFailed: "تعذّر حفظ ترتيب الخوادم؛ أُعيد الترتيب السابق.",
    folderSaveFailed: "تعذّر حفظ إعدادات المجلد.",
  },
} satisfies Translation<typeof serverRailTr>;
