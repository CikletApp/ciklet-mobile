/**
 * AutoMod ayarları ve yayın bağlantıları / bağlantılı roller metinleri —
 * web `lib/i18n/messages/ns/automod.en.ts` (timeout, settings) ve
 * `streaming.en.ts` (settings, linkedRoles) kopyası; web değişirse burası da.
 */
import type { Translation } from "../../translation";
import type { automodTr, streamingTr } from "../../automod.tr";


export const automod = {
  timeout: {
    none: "بلا تعليق",
    s60: "60 ثانية",
    m5: "5 دقائق",
    m10: "10 دقائق",
    h1: "ساعة واحدة",
    d1: "يوم واحد",
    w1: "أسبوع واحد",
  },
  settings: {
    words: {
      title: "AutoMod — الكلمات المحظورة",
      description: "افصل بينها بفواصل أو أسطر جديدة؛ تتم مطابقة الكلمات الكاملة، وأنهِ الكلمة بـ * لمطابقة البادئة. تُكتشف حيل الكتابة أيضًا (الأحرف المكررة، الأرقام/الرموز، الفواصل). لا يمكن إرسال الرسائل المطابقة (وتُزال إن وصلت عبر البوابة). حتى {max, plural, zero {# كلمة} one {كلمة واحدة} two {كلمتين} few {# كلمات} many {# كلمة} other {# كلمة}}.",
      placeholder: "كلمة1، كلمة2، بادئة*",
      count: "{count, plural, zero {لا كلمات} one {كلمة واحدة} two {كلمتان} few {# كلمات} many {# كلمة} other {# كلمة}}",
    },
    mentions: {
      title: "AutoMod — الإشارات المزعجة",
      description: "يحظر الرسالة التي تشير إلى أشخاص أو أدوار مختلفة أكثر من هذا العدد. اتركه فارغًا لإيقافه (الحد الأقصى {max}).",
      off: "معطّل",
    },
    linkFilter: {
      title: "AutoMod — مرشح الروابط",
      description: "عند التفعيل، يُسمح فقط بالروابط إلى النطاقات أدناه (ونطاقاتها الفرعية)؛ المرفقات مسموحة دائمًا. حتى {max, plural, zero {# نطاق} one {نطاق واحد} two {نطاقين} few {# نطاقات} many {# نطاقًا} other {# نطاق}}.",
      emptyWarning: "لا توجد نطاقات مسموحة: كل الروابط محظورة.",
    },
    actionsSection: {
      title: "AutoMod — الإجراءات",
      description: "تُحظر دائمًا الرسالة التي تخالف قاعدة. ويمكن اختياريًا تعليق كاتبها ونشر الحدث في قناة الإشراف وفي قناة الرسالة.",
      timeout: "التعليق",
      alertChannel: "قناة الإشراف",
      noAlert: "بلا تنبيهات",
    },
    preset: {
      title: "AutoMod — مرشح الألفاظ النابية التركية",
      description: "قائمة جاهزة وشاملة بالألفاظ النابية والإهانات التركية. تكتشف أيضًا حيل الكتابة (الأحرف المكررة، 4→a، 1→ı، 0→o، $→s، التقسيم بالنقاط أو المسافات) وتتجاهل الكلمات البريئة مثل \"sıkıntı\" أو \"amaç\" أو \"piknik\".",
      enable: "تفعيل بنقرة واحدة",
      enabled: "مفعّل",
      allowTitle: "الكلمات المسموحة",
      allowDescription: "كلمات يجب ألا تُكتشف أبدًا (افصل بينها بفواصل أو أسطر جديدة؛ أنهِها بـ * للبادئة). تنطبق على القائمة الجاهزة وقائمة الكلمات المحظورة معًا.",
      allowPlaceholder: "amina، كلمة*",
    },
    spam: {
      title: "AutoMod — اكتشاف الرسائل المزعجة",
      description: "يحظر رسائل الأعضاء الذين يرسلون رسائل كثيرة في وقت قصير أو يكررون المحتوى نفسه.",
      maxMessages: "الحد الأقصى للرسائل",
      window: "المدة (بالثواني)",
      duplicates: "تكرار الرسالة نفسها (60 ث)",
    },
    caps: {
      title: "AutoMod — الأحرف الكبيرة المفرطة",
      description: "يحظر الرسائل التي تتجاوز فيها نسبة الأحرف الكبيرة الحد المحدد (باستثناء الرسائل القصيرة).",
      percent: "نسبة الأحرف الكبيرة (%)",
      minLetters: "الحد الأدنى للأحرف",
    },
    links: {
      inviteTitle: "حظر روابط الدعوة",
      inviteDescription: "لا يمكن مشاركة دعوات خوادم Ciklet وDiscord.",
      blockedTitle: "النطاقات المحظورة",
      blockedDescription: "تُحظر الروابط إلى هذه النطاقات (ونطاقاتها الفرعية) حتى عندما يكون مرشح الروابط متوقفًا.",
    },
    profile: {
      title: "AutoMod — مرشح اسم المستخدم والملف الشخصي",
      description: "يجب أن يجتاز الاسم المعروض واسم المستخدم ولقب الخادم والنبذة قائمة الكلمات المحظورة و(إن كان مفعّلًا) مرشح الألفاظ النابية. لا يمكن للعضو الذي لا يجتازها إرسال الرسائل حتى يصلحها؛ ولا تُحفظ مثل هذه الألقاب ونبذات الخادم.",
    },
    actions: {
      warnTitle: "سطر تحذير في القناة",
      warnDescription: "يُنشر إشعار AutoMod قصير في قناة الرسالة المحظورة (دون إظهار المحتوى).",
      blockMessageTitle: "الرسالة المعروضة للمرسل",
      blockMessageDescription: "اتركها فارغة لعرض شرح القاعدة نفسها.",
      blockMessagePlaceholder: "تخالف هذه الرسالة قواعد الخادم.",
    },
    exempt: {
      title: "AutoMod — الاستثناءات",
      description: "الأعضاء الذين لديهم صلاحية إدارة الرسائل مستثنون دائمًا. ولا تُفحص أيضًا هذه الأدوار والقنوات (بما فيها سلاسلها).",
      roles: "الأدوار المستثناة",
      channels: "القنوات المستثناة",
      none: "لم يُحدَّد شيء",
    },
  },

} satisfies Translation<typeof automodTr>;

export const streaming = {
  live: "مباشر",
  settings: {
    hint: "اربط حسابك لإظهار \"مباشر\" على ملفك الشخصي أثناء البث",
    broadcaster: "أذونات صاحب البث",
    broadcasterHint: "تتيح للأدوار المرتبطة قراءة مشتركيك",
    grantBroadcaster: "الربط كصاحب بث",
    connect: "ربط",
    reconnect: "إعادة الربط",
    disconnect: "إزالة",
    disconnected: "أُزيل ربط {platform}.",
    disconnectFailed: "تعذّرت إزالة ربط {platform}.",
    liveNow: "مباشر الآن",
  },
  linkedRoles: {
    title: "الأدوار المرتبطة",
    description: "اربط دورًا بالاشتراك في قناتك على Twitch أو Kick. عندما يربط الأعضاء حساباتهم، يُمنح الدور تلقائيًا إن استوفوا الشرط، ويُزال عند انتهاء الاشتراك (يُعاد التحقق كل نصف ساعة). لا يمكن إعداد هذا إلا لمالك الخادم، ولقناته الخاصة.",
    ownerOnly: "لا يمكن إلا لمالك الخادم إدارة الأدوار المرتبطة.",
    role: "الدور",
    platform: "المنصة",
    requirement: "الشرط",
    subscriber: "مشترك في قناتي",
    follower: "يتابع قناتي",
    followerTwitchOnly: "شرط المتابعة خاص بـ Twitch فقط (Kick لا يبلّغ عن إلغاء المتابعة).",
    add: "ربط",
    remove: "إزالة",
    empty: "لا توجد أدوار مرتبطة بعد.",
    loading: "جارٍ التحميل…",
    needsBroadcaster: "اربط أولًا حسابك على {platform} عبر \"الربط كصاحب بث\" في الإعدادات ← الملف الشخصي ← الروابط.",
    created: "أُنشئ الدور المرتبط.",
    createFailed: "تعذّر إنشاء الدور المرتبط.",
    removeFailed: "تعذّرت إزالة الدور المرتبط.",
    granted: "{count, plural, zero {# عضو} one {عضو واحد} two {عضوان} few {# أعضاء} many {# عضوًا} other {# عضو}}",
    lastSynced: "آخر تحقق: {time}",
    selectRole: "اختر دورًا",
  },

} satisfies Translation<typeof streamingTr>;
