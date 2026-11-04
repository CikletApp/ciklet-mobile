import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** az — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Tapşırıqlar",
  subtitle: "Oyna, söhbət et, kəşf et — tamamladığın tapşırıqlar sənə Ciklet və mükafatlar qazandırır.",
  balance: "Ciklet balansın",
  lifetime: "Cəmi qazanılan: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet xalları yalnız tətbiq daxilində istifadə olunan virtual valyutadır: real pul dəyəri yoxdur, türk lirəsinə (TL) və ya başqa valyutaya çevrilə bilməz, satıla və başqasına ötürülə bilməz. Ciklet xalları yalnız Mağazadakı profil əşyalarına xərclənə bilər.",
  goStore: "Mağazaya keç",
  loading: "Tapşırıqlar yüklənir…",
  loadError: "Tapşırıqları yükləmək mümkün olmadı.",
  empty: "Hazırda açıq tapşırıq yoxdur. Yeniləri tezliklə burada görünəcək.",
  tabs: {
    open: "Açıq tapşırıqlar",
    done: "Tamamlananlar",
  },
  kind: {
    playGame: "{game} oyununu {minutes} dəqiqə oyna",
    voice: "Səs kanalında {minutes} dəqiqə vaxt keçir",
    activity: "{app} fəaliyyətində {minutes} dəqiqə vaxt keçir",
    activityAny: "Bir fəaliyyət tətbiqində {minutes} dəqiqə vaxt keçir",
    createServer: "İlk serverini yarat",
    inviteFriend: "Dəvət linkinlə serverinə {count} nəfər gətir",
    streakDay: "Ardıcıl {count} gün: hər gün {minutes} dəqiqə {source}",
    streakWeek: "Ardıcıl {count} həftə: hər həftə {minutes} dəqiqə {source}",
  },
  source: {
    voice: "səsli söhbətdə ol",
    game: "{game} oyna",
    activity: "fəaliyyət tətbiqindən istifadə et",
  },
  progress: {
    minutes: "{value} / {target} dəq",
    count: "{value} / {target}",
    days: "{value} / {target} gün",
    weeks: "{value} / {target} həftə",
  },
  action: {
    enroll: "Tapşırığı qəbul et",
    claim: "Mükafatı al",
    claimed: "Alındı",
    inProgress: "Davam edir",
    expired: "Vaxtı bitib",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days} günlük Mentol {plan}",
    item: "{name}",
  },
  sponsor: "Təqdim edir: {name}",
  endsAt: "Bitir: {date}",
  noEnd: "Bitmə tarixi yoxdur",
  claimUntil: "Son alma tarixi: {date}",
  toast: {
    enrolled: "Tapşırıq qəbul edildi — irəliləyiş indidən sayılır.",
    claimed: "Mükafat alındı!",
    alreadyClaimed: "Bu mükafatı artıq almısan.",
    itemOwned: "Mükafat əşyası artıq səndə idi; Ciklet və digər mükafatlar əlavə edildi.",
    failed: "Nəsə xəta baş verdi.",
  },
  how: {
    title: "İrəliləyiş necə sayılır?",
    enroll: "İrəliləyiş tapşırığı qəbul etdiyin andan sayılır, əvvəlindən yox.",
    game: "Oyun vaxtı masaüstü tətbiqin bildirdiyi fəaliyyət tarixçəsindən götürülür.",
    voice: "Səs vaxtı yalnız kanalda ən azı iki nəfər olduqda sayılır.",
    once: "Hər tapşırığın mükafatı hər hesab üçün bir dəfə alına bilər.",
  },
  store: {
    buyWithPoints: "{points} Ciklet-ə al",
    notEnough: "{points} Ciklet lazımdır",
    bought: "{name} Ciklet ilə alındı",
    earn: "Tapşırıqlarla Ciklet qazan",
  },
} satisfies Translation<typeof questsTr>;
