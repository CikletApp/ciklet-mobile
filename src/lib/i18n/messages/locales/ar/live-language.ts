import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "ترجمة",
    translating: "جارٍ الترجمة…",
    unsupported: "الترجمة غير مدعومة في هذا المتصفح",
    unsupportedDevice: "الترجمة غير مدعومة على هذا الجهاز",
    remove: "إزالة الترجمة",
  },
  footer: {
    translatedFrom: "مترجمة من {language}",
    showOriginal: "عرض الأصل",
    showTranslation: "عرض الترجمة",
    dismiss: "إغلاق الترجمة",
    translating: "جارٍ الترجمة…",
    downloading: "جارٍ تنزيل نموذج اللغة على جهازك… {percent}%",
  },
  errors: {
    same: "هذه الرسالة مكتوبة بالفعل بـ{language}.",
    unavailable: "الترجمة على الجهاز غير متاحة لهذا الزوج من اللغات.",
    undetected: "تعذّر اكتشاف لغة الرسالة.",
    empty: "لا يوجد نص لترجمته.",
    failed: "تعذّرت الترجمة.",
  },
  settings: {
    title: "اللغة الهدف للترجمة",
    description: "يترجم زر «ترجمة» الرسائل إلى هذه اللغة. تتم الترجمة على جهازك، ولا يُرسل محتوى الرسائل أبدًا إلى خوادم Ciklet.",
    auto: "لغة الواجهة ({language})",
    unsupported: "لا يدعم هذا المتصفح الترجمة على الجهاز؛ استخدم إصدارًا حديثًا من Chrome أو Edge.",
    unsupportedDevice: "لا يدعم هذا الجهاز الترجمة على الجهاز.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "الترجمة النصية",
  title: "ترجمة نصية مباشرة",
  publish: {
    label: "تحويل كلامي إلى نص",
    description: "يُحوَّل كلامك إلى نص على جهازك ويُرسل فقط إلى الأشخاص في هذه المكالمة. لا يُسجَّل أي صوت.",
  },
  show: {
    label: "عرض الترجمة النصية",
    description: "يظهر كلام المشاركين الذين فعّلوا الترجمة النصية أسفل الشاشة.",
  },
  language: "لغة الكلام",
  languageAuto: "لغة الواجهة",
  indicator: "الترجمة النصية مفعّلة",
  indicatorHelp: "يبث هذا الشخص كلامه كترجمة نصية.",
  status: {
    listening: "جارٍ الاستماع…",
    muted: "الميكروفون مغلق — الترجمة النصية متوقفة مؤقتًا.",
    unsupported: "التعرّف على الكلام غير مدعوم على هذا الجهاز.",
    denied: "لم يُمنح إذن الميكروفون أو التعرّف على الكلام.",
    e2eeBlocked: "لا يستطيع هذا الجهاز تشفير الترجمة النصية في مكالمة مشفّرة تشفيرًا تامًّا بين الطرفين؛ بث الترجمة النصية متوقف.",
    e2ee: "تُرسل الترجمة النصية مشفّرة تشفيرًا تامًّا بين الطرفين.",
    cloud: "قد يستخدم متصفحك خدمة كلام خاصة به للتعرّف على كلامك؛ لا يصل الصوت أبدًا إلى خوادم Ciklet.",
    onDevice: "يعمل التعرّف على الكلام على جهازك.",
    error: "توقّف التعرّف على الكلام.",
  },
  empty: "لا توجد ترجمة نصية بعد.",
} satisfies Translation<typeof liveCaptionsTr>;
