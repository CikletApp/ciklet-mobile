import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** ar — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "إنشاء مجلد",
    settingsTitle: "إعدادات المجلد",
    nameLabel: "اسم المجلد",
    defaultName: "مجلد الخوادم",
    colorLabel: "لون المجلد",
    currentColor: "اللون المحدد",
    customColor: "لون مخصص",
    pickServers: "الخوادم",
    pickHint: "اختر خادمين على الأقل لوضعهما في المجلد.",
    inFolder: "الخوادم في المجلد ({count})",
    removeServer: "إزالة {name} من المجلد",
    removeHint: "يُحذف المجلد عندما يبقى فيه خادم واحد فقط.",
    addServers: "إضافة خوادم",
    addServer: "إضافة {name} إلى المجلد",
    create: "إنشاء المجلد",
    done: "تم",
    createFailed: "تعذّر إنشاء المجلد",
    saveFailed: "تعذّر حفظ المجلد",
    removeFailed: "تعذّرت إزالة الخادم من المجلد",
    addFailed: "تعذّرت إضافة الخادم إلى المجلد",
    newFolder: "إنشاء مجلد",
    openSettings: "إعدادات مجلد {name}",
  },
  channelInvites: {
    title: "الدعوات",
    subtitle: "روابط الدعوة إلى هذه القناة",
    intro: "روابط الدعوة إلى #{channel}. من ينضم يصل مباشرةً إلى هذه القناة.",
  },
} satisfies Translation<typeof parityScreensTr>;
