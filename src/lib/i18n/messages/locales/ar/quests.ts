import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** ar — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "المهام",
  subtitle: "العب، ودردش، واستكشف — المهام المكتملة تمنحك Ciklet ومكافآت.",
  balance: "رصيدك من Ciklet",
  lifetime: "إجمالي المكتسب: {points}",
  unit: "Ciklet",
  disclaimer:
    "نقاط Ciklet عملة داخل التطبيق تُستخدم فيه فقط: ليست لها قيمة نقدية حقيقية، ولا يمكن تحويلها إلى الليرة التركية أو أي عملة أخرى، ولا يمكن بيعها أو نقلها إلى أي شخص آخر. لا يمكن إنفاق نقاط Ciklet إلا على عناصر الملف الشخصي في المتجر.",
  goStore: "الذهاب إلى المتجر",
  loading: "جارٍ تحميل المهام…",
  loadError: "تعذّر تحميل المهام.",
  empty: "لا توجد مهام متاحة الآن. ستظهر مهام جديدة هنا قريبًا.",
  tabs: {
    open: "المهام المتاحة",
    done: "المكتملة",
  },
  kind: {
    playGame: "العب {game} لمدة {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}}",
    voice: "اقضِ {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}} في قناة صوتية",
    activity: "اقضِ {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}} في نشاط {app}",
    activityAny: "اقضِ {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}} في تطبيق نشاط",
    createServer: "أنشئ خادمك الأول",
    inviteFriend: "أحضر {count, plural, zero {# شخص} one {شخصًا واحدًا} two {شخصين} few {# أشخاص} many {# شخصًا} other {# شخص}} إلى خادمك عبر رابط دعوتك",
    streakDay: "{count, plural, zero {# يوم} one {يوم واحد} two {يومان} few {# أيام} many {# يومًا} other {# يوم}} متتالية: {source} لمدة {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}} كل يوم",
    streakWeek: "{count, plural, zero {# أسبوع} one {أسبوع واحد} two {أسبوعان} few {# أسابيع} many {# أسبوعًا} other {# أسبوع}} متتالية: {source} لمدة {minutes, plural, zero {# دقيقة} one {دقيقة واحدة} two {دقيقتين} few {# دقائق} many {# دقيقة} other {# دقيقة}} كل أسبوع",
  },
  source: {
    voice: "اقضِ وقتًا في الصوت",
    game: "العب {game}",
    activity: "استخدم تطبيق نشاط",
  },
  progress: {
    minutes: "{value} / {target} د",
    count: "{value} / {target}",
    days: "{value} / {target} يوم",
    weeks: "{value} / {target} أسبوع",
  },
  action: {
    enroll: "قبول المهمة",
    claim: "استلام المكافأة",
    claimed: "تم الاستلام",
    inProgress: "قيد التقدم",
    expired: "منتهية",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "Mentol {plan} لمدة {days, plural, zero {# يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}",
    item: "{name}",
  },
  sponsor: "مقدَّمة من {name}",
  endsAt: "تنتهي: {date}",
  noEnd: "بلا تاريخ انتهاء",
  claimUntil: "استلم قبل {date}",
  toast: {
    enrolled: "قُبلت المهمة — يبدأ احتساب التقدم الآن.",
    claimed: "تم استلام المكافأة!",
    alreadyClaimed: "لقد استلمت هذه المكافأة بالفعل.",
    itemOwned: "كنت تملك عنصر المكافأة بالفعل؛ أُضيفت Ciklet والمكافآت الأخرى.",
    failed: "حدث خطأ ما.",
  },
  how: {
    title: "كيف يُحتسب التقدم؟",
    enroll: "يُحتسب التقدم من لحظة قبولك المهمة، وليس قبلها أبدًا.",
    game: "يأتي وقت اللعب من سجل النشاط الذي يرسله تطبيق سطح المكتب.",
    voice: "لا يُحتسب وقت الصوت إلا عند وجود شخصين على الأقل في القناة.",
    once: "يمكن استلام مكافأة كل مهمة مرة واحدة لكل حساب.",
  },
  store: {
    buyWithPoints: "احصل عليه مقابل {points} Ciklet",
    notEnough: "يتطلب {points} Ciklet",
    bought: "حصلت على {name} مقابل Ciklet",
    earn: "اكسب Ciklet من خلال المهام",
  },
} satisfies Translation<typeof questsTr>;
