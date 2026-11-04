import type { Translation } from "../../translation";
import type { questsTr } from "../../quests.tr";

/** uk — quests.tr.ts çevirisi (eksik anahtar İngilizceye düşer). */
export const quests = {
  title: "Завдання",
  subtitle: "Грайте, спілкуйтеся, досліджуйте — за виконані завдання ви отримуєте Ciklet і нагороди.",
  balance: "Ваш баланс Ciklet",
  lifetime: "Усього зароблено: {points}",
  unit: "Ciklet",
  disclaimer:
    "Бали Ciklet — це внутрішня валюта, яка використовується лише в застосунку: вони не мають реальної грошової вартості, їх не можна обміняти на турецькі ліри (TL) чи будь-яку іншу валюту, продати або передати комусь іншому. Бали Ciklet можна витрачати лише на предмети профілю в Магазині.",
  goStore: "До Магазину",
  loading: "Завантаження завдань…",
  loadError: "Не вдалося завантажити завдання.",
  empty: "Зараз немає відкритих завдань. Нові скоро з'являться тут.",
  tabs: {
    open: "Відкриті завдання",
    done: "Виконані",
  },
  kind: {
    playGame: "{minutes, plural, one {Пограйте в {game} # хвилину} few {Пограйте в {game} # хвилини} many {Пограйте в {game} # хвилин} other {Пограйте в {game} # хвилини}}",
    voice: "{minutes, plural, one {Проведіть # хвилину в голосовому каналі} few {Проведіть # хвилини в голосовому каналі} many {Проведіть # хвилин у голосовому каналі} other {Проведіть # хвилини в голосовому каналі}}",
    activity: "{minutes, plural, one {Проведіть # хвилину в активності {app}} few {Проведіть # хвилини в активності {app}} many {Проведіть # хвилин в активності {app}} other {Проведіть # хвилини в активності {app}}}",
    activityAny: "{minutes, plural, one {Проведіть # хвилину в застосунку активності} few {Проведіть # хвилини в застосунку активності} many {Проведіть # хвилин у застосунку активності} other {Проведіть # хвилини в застосунку активності}}",
    createServer: "Створіть свій перший сервер",
    inviteFriend: "{count, plural, one {Приведіть # людину на свій сервер за посиланням-запрошенням} few {Приведіть # людини на свій сервер за посиланням-запрошенням} many {Приведіть # людей на свій сервер за посиланням-запрошенням} other {Приведіть # людини на свій сервер за посиланням-запрошенням}}",
    streakDay: "{count, plural, one {# день поспіль} few {# дні поспіль} many {# днів поспіль} other {# дня поспіль}}: {source} щодня по {minutes} хв",
    streakWeek: "{count, plural, one {# тиждень поспіль} few {# тижні поспіль} many {# тижнів поспіль} other {# тижня поспіль}}: {source} щотижня по {minutes} хв",
  },
  source: {
    voice: "спілкуйтеся в голосовому каналі",
    game: "грайте в {game}",
    activity: "користуйтеся застосунком активності",
  },
  progress: {
    minutes: "{value} / {target} хв",
    count: "{value} / {target}",
    days: "{value} / {target} дн.",
    weeks: "{value} / {target} тиж.",
  },
  action: {
    enroll: "Прийняти завдання",
    claim: "Отримати нагороду",
    claimed: "Отримано",
    inProgress: "Виконується",
    expired: "Строк минув",
  },
  reward: {
    points: "{points} Ciklet",
    mentol: "{days, plural, one {# день Mentol {plan}} few {# дні Mentol {plan}} many {# днів Mentol {plan}} other {# дня Mentol {plan}}}",
    item: "{name}",
  },
  sponsor: "Представляє {name}",
  endsAt: "Закінчується: {date}",
  noEnd: "Без дати завершення",
  claimUntil: "Отримайте до {date}",
  toast: {
    enrolled: "Завдання прийнято — прогрес рахується з цього моменту.",
    claimed: "Нагороду отримано!",
    alreadyClaimed: "Ви вже отримали цю нагороду.",
    itemOwned: "Предмет-нагорода у вас уже був; Ciklet та інші нагороди додано.",
    failed: "Щось пішло не так.",
  },
  how: {
    title: "Як рахується прогрес?",
    enroll: "Прогрес рахується з моменту, коли ви приймаєте завдання, і ніколи раніше.",
    game: "Час у грі береться з історії активності, яку надсилає застосунок для комп'ютера.",
    voice: "Час у голосовому каналі рахується, лише коли в каналі щонайменше дві людини.",
    once: "Нагороду за кожне завдання можна отримати один раз на обліковий запис.",
  },
  store: {
    buyWithPoints: "Отримати за {points} Ciklet",
    notEnough: "Потрібно {points} Ciklet",
    bought: "{name} отримано за Ciklet",
    earn: "Заробляйте Ciklet за завдання",
  },
} satisfies Translation<typeof questsTr>;
