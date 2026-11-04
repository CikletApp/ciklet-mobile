/**
 * Görevler ve Ödüller (/gorevler) ile mağazadaki Ciklet alımı.
 * Türkçe kaynak; İngilizcesi quests.en.ts (aynı şekil zorunlu).
 */
export const questsTr = {
  title: "Görevler",
  subtitle: "Oyna, sohbet et, keşfet — tamamladığın görevler Ciklet ve ödül kazandırır.",
  balance: "Ciklet bakiyen",
  lifetime: "Toplam kazanılan: {points}",
  unit: "Ciklet",
  disclaimer:
    "Ciklet puanı yalnızca uygulama içinde kullanılan bir puandır: gerçek para değeri yoktur, TL'ye ya da başka bir paraya çevrilemez, satılamaz ve başkasına devredilemez. Ciklet puanını yalnızca mağazada profil ürünleri almak için kullanabilirsin.",
  goStore: "Mağazaya git",
  loading: "Görevler yükleniyor…",
  loadError: "Görevler yüklenemedi.",
  empty: "Şu an açık görev yok. Yenileri yakında burada.",
  tabs: {
    open: "Açık görevler",
    done: "Tamamlananlar",
  },
  kind: {
    playGame: "{game} oyununu {minutes} dakika oyna",
    voice: "Sesli kanalda {minutes} dakika kal",
    activity: "{app} aktivitesinde {minutes} dakika geçir",
    activityAny: "Bir aktivite uygulamasında {minutes} dakika geçir",
    createServer: "İlk sunucunu kur",
    inviteFriend: "Davet bağlantınla {count} kişiyi sunucuna getir",
    streakDay: "{count} gün üst üste, her gün {minutes} dakika {source}",
    streakWeek: "{count} hafta üst üste, her hafta {minutes} dakika {source}",
  },
  source: {
    voice: "sesli kanalda kal",
    game: "{game} oyna",
    activity: "aktivite uygulamasında geçir",
  },
  progress: {
    minutes: "{value} / {target} dk",
    count: "{value} / {target}",
    days: "{value} / {target} gün",
    weeks: "{value} / {target} hafta",
  },
  action: {
    enroll: "Göreve katıl",
    claim: "Ödülü al",
    claimed: "Alındı",
    inProgress: "Devam ediyor",
    expired: "Süresi doldu",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days} gün Mentol {plan}",
    item: "{name}",
  },
  sponsor: "{name} sunar",
  endsAt: "Bitiş: {date}",
  noEnd: "Süresiz",
  claimUntil: "Ödülü {date} tarihine kadar al",
  toast: {
    enrolled: "Göreve katıldın — ilerleme şimdi saymaya başladı.",
    claimed: "Ödül alındı!",
    alreadyClaimed: "Bu ödülü zaten almıştın.",
    itemOwned: "Ödül ürününe zaten sahiptin; Ciklet ve diğer ödüller eklendi.",
    failed: "İşlem tamamlanamadı.",
  },
  how: {
    title: "İlerleme nasıl sayılır?",
    enroll: "İlerleme göreve katıldığın andan itibaren sayılır; öncesi sayılmaz.",
    game: "Oyun süresi masaüstü uygulamasının bildirdiği etkinlik geçmişinden alınır.",
    voice: "Sesli kanal süresi yalnızca kanalda en az iki kişi varken işler.",
    once: "Her görevin ödülü hesap başına bir kez alınır.",
  },
  store: {
    buyWithPoints: "{points} Ciklet ile al",
    notEnough: "{points} Ciklet gerekli",
    bought: "{name} Ciklet ile alındı",
    earn: "Görevlerle Ciklet kazan",
  },
} as const;
