import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** ru — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Задания",
  subtitle: "Играйте, общайтесь, исследуйте — за выполненные задания вы получаете Ciklet и награды.",
  balance: "Ваш баланс Ciklet",
  lifetime: "Всего заработано: {points}",
  unit: "Ciklet",
  disclaimer:
    "Очки Ciklet — это внутренняя валюта, которая используется только в приложении: они не имеют денежной ценности, не обмениваются на турецкие лиры (TL) или другую валюту, не продаются и не передаются другим людям. Очки Ciklet можно потратить только на предметы для профиля в магазине.",
  goStore: "В магазин",
  loading: "Загрузка заданий…",
  loadError: "Не удалось загрузить задания.",
  empty: "Сейчас нет открытых заданий. Скоро здесь появятся новые.",
  tabs: {
    open: "Открытые задания",
    done: "Выполненные",
  },
  kind: {
    playGame: "Поиграйте в {game} {minutes} мин",
    voice: "Проведите {minutes} мин в голосовом канале",
    activity: "Проведите {minutes} мин в активности {app}",
    activityAny: "Проведите {minutes} мин в приложении-активности",
    createServer: "Создайте свой первый сервер",
    inviteFriend: "{count, plural, one {Пригласите # человека на свой сервер по ссылке-приглашению} few {Пригласите # человек на свой сервер по ссылке-приглашению} many {Пригласите # человек на свой сервер по ссылке-приглашению} other {Пригласите # человека на свой сервер по ссылке-приглашению}}",
    streakDay: "{count, plural, one {# день подряд} few {# дня подряд} many {# дней подряд} other {# дня подряд}}: {source} по {minutes} мин в день",
    streakWeek: "{count, plural, one {# неделю подряд} few {# недели подряд} many {# недель подряд} other {# недели подряд}}: {source} по {minutes} мин в неделю",
  },
  source: {
    voice: "общайтесь в голосовом канале",
    game: "играйте в {game}",
    activity: "используйте приложение-активность",
  },
  progress: {
    minutes: "{value} / {target} мин",
    count: "{value} / {target}",
    days: "{value} / {target} дн.",
    weeks: "{value} / {target} нед.",
  },
  action: {
    enroll: "Принять задание",
    claim: "Получить награду",
    claimed: "Получено",
    inProgress: "В процессе",
    expired: "Истекло",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# день Mentol {plan}} few {# дня Mentol {plan}} many {# дней Mentol {plan}} other {# дня Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "При поддержке {name}",
  endsAt: "Завершается: {date}",
  noEnd: "Без даты окончания",
  claimUntil: "Получить до {date}",
  toast: {
    enrolled: "Задание принято — прогресс начинает засчитываться.",
    claimed: "Награда получена!",
    alreadyClaimed: "Вы уже получили эту награду.",
    itemOwned: "Предмет из награды у вас уже был; Ciklet и другие награды начислены.",
    failed: "Что-то пошло не так.",
  },
  how: {
    title: "Как засчитывается прогресс?",
    enroll: "Прогресс засчитывается с момента принятия задания, но не раньше.",
    game: "Игровое время берётся из истории активности, которую передаёт приложение для компьютера.",
    voice: "Время в голосовом канале засчитывается, только когда в канале минимум два человека.",
    once: "Награду за каждое задание можно получить один раз на аккаунт.",
  },
  store: {
    buyWithPoints: "Получить за {points} Ciklet",
    notEnough: "Нужно {points} Ciklet",
    bought: "{name} получено за Ciklet",
    earn: "Зарабатывайте Ciklet в заданиях",
  },
} satisfies Translation<typeof questsTr>;
