import { automod, streaming } from "./automod";
import { safety } from "./safety";
import { voiceE2ee } from "./voice-e2ee";
import { serverGuide } from "./server-guide";
import { serverTag } from "./server-tag";
import { serverBoost } from "./server-boost";
import { accountSwitcher } from "./account-switcher";
import { familyCenter } from "./family-center";
import { gameStats } from "./game-stats";
import { gameDetail } from "./game-detail";
import { compliance } from "./compliance";
import { quests } from "./quests";
import { settingsAccount } from "./settings-account";
import { settingsGeneral } from "./settings-general";
import { settingsMedia } from "./settings-media";
import { liveCaptions, translation } from "./live-language";
import { moreScreens } from "./more-screens";
import { parityScreens } from "./parity-screens";
import type { Messages } from "../../tr";
import type { Translation } from "../../translation";

/** uk sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "Скасувати",
    save: "Зберегти",
    close: "Закрити",
    system: "Як у системі",
    on: "Увімкнено",
    off: "Вимкнено",
  },
  tabs: {
    chats: "Чати",
    servers: "Сервери",
    notifications: "Сповіщення",
    me: "Ви",
    unread: "{label}, непрочитаних: {count}",
  },
  messagePreview: {
    voice: "🎤 Голосове повідомлення",
    voiceWithDuration: "🎤 Голосове повідомлення ({duration})",
    activity: "🎮 Активність: {name}",
    activityUnnamed: "🎮 Запрошення до активності",
    image: "📷 Фото",
    video: "🎥 Відео",
    gif: "GIF",
    sticker: "Наліпка",
    clip: "🎬 Кліп",
    file: "📎 {name}",
    attachment: "📎 Вкладення",
  },
  activity: {
    broadcast: {
      live: "Наживо",
      game: "Транслює {game}",
      liveOn: "Наживо на {platform}",
      title: "Пряма трансляція",
      watch: "Дивитися трансляцію",
    },
  },
  appCommands: {
    commands: "Команди",
    apps: "Застосунки",
    optional: "Необов'язково",
    required: "Обов'язково",
    true: "Так",
    false: "Ні",
    chooseFile: "Вибрати файл",
    loading: "Завантаження…",
    noSuggestions: "Немає пропозицій",
    timedOut: "Застосунок не відповів вчасно",
    selectUser: "Виберіть користувача",
    selectRole: "Виберіть роль",
    selectChannel: "Виберіть канал",
    selectMentionable: "Виберіть користувача або роль",
    enterValue: "Введіть значення",
    enterNumber: "Введіть число",
    runFailed: "Не вдалося виконати команду.",
  },
  messageComponents: {
    choose: "Зробіть вибір",
    chooseOption: "Виберіть варіант",
    search: "Пошук",
    noResults: "Нічого не знайдено",
    loading: "Завантаження…",
    confirm: "Вибрати",
    clear: "Очистити",
    selectedCount: "Вибрано: {count}",
    selectRange: "Вибір: {min}–{max}",
    unknown: "Невідомо",
    botNoResponse: "{name} не відповів.",
    interactionFailed: "Не вдалося почати взаємодію.",
    formNoResponse: "Бот не відповів на форму.",
    formFailed: "Не вдалося надіслати форму.",
    formLabel: "Форма бота",
    submit: "Надіслати",
    cancel: "Скасувати",
    requiredMark: "Обов'язково",
    uploadFile: "Вивантажити файл",
    uploading: "Вивантаження…",
    uploadFailed: "Не вдалося вивантажити файл.",
    removeFile: "Видалити",
    fileLimit: "{max, plural, one {До # файлу} few {До # файлів} many {До # файлів} other {До # файлу}}",
    allowedTypes: "Дозволено: {types}",
    fileTypeRejected: "Цей тип файлу не приймається.",
    download: "Завантажити",
    spoiler: "Спойлер",
    show: "Показати",
    openImage: "Збільшити зображення",
    attachment: "Вкладення",
  },
  settings: {
    title: "Налаштування",
    editProfile: "Редагувати профіль",
    sections: {
      account: "НАЛАШТУВАННЯ ОБЛІКОВОГО ЗАПИСУ",
      app: "НАЛАШТУВАННЯ ЗАСТОСУНКУ",
      support: "ПІДТРИМКА",
      session: "СЕАНС",
    },
    rows: {
      account: "Обліковий запис",
      mentol: "Mentol",
      privacy: "Конфіденційність, дані й соціальне",
      friendRequests: "Запити в друзі",
      authorizedApps: "Авторизовані застосунки",
      voice: "Голос і відео",
      appearance: "Вигляд",
      chat: "Чат",
      notifications: "Сповіщення",
      activity: "Статус активності",
      help: "Допомога",
      helpSubtitle: "Підтримка, відгуки, умови",
      scanLogin: "Сканувати код",
      scanLoginSubtitle: "Увійдіть на комп'ютері за допомогою телефона",
    },
    scanLogin: {
      title: "Сканувати код",
      hint: "Наведіть камеру на кільце, що обертається, на екрані входу на комп'ютері.",
      permissionTitle: "Потрібен доступ до камери",
      permissionBody: "Камера потрібна, щоб зчитати код на вашому комп'ютері.",
      permissionAction: "Дозволити",
      openSettings: "Відкрити налаштування",
      searching: "Пошук коду…",
      checking: "Перевірка коду…",
      gone: "Строк дії цього коду минув. Зачекайте, поки комп'ютер оновить його, і скануйте знову.",
      confirmTitle: "Увійти на комп'ютері?",
      confirmBody: "Якщо це не ви почали вхід, відхиліть його. Нікому не показуйте код.",
      device: "Пристрій",
      location: "Місцезнаходження",
      ip: "IP-адреса",
      time: "Час",
      justNow: "Щойно",
      approve: "Так, увійти",
      reject: "Ні, це не я",
      approved: "Схвалено. Виконується вхід на комп'ютері.",
      rejected: "Відхилено. Код на комп'ютері оновиться.",
      failed: "Не вдалося надіслати схвалення. Спробуйте ще раз.",
      unknownLocation: "Невідомо",
    },
    logout: {
      action: "Вийти",
      title: "Вийти",
      message: "Ви вийдете з облікового запису на цьому пристрої.",
    },
    memberSince: "У Ciklet з {date}",
    appearance: {
      title: "Вигляд",
      motion: {
        title: "ЗМЕНШЕННЯ РУХУ",
        description:
          "Пом'якшує переходи, висувні панелі й пульсуючі анімації. «Як у системі» дотримується налаштувань доступності вашого телефона.",
      },
      language: {
        title: "МОВА",
        description: "Мова інтерфейсу. Переклад триває; неперекладений текст показується англійською або турецькою.",
        system: "Мова пристрою ({name})",
        restartRtl: "Закрийте й знову відкрийте застосунок, щоб застосувати новий напрямок тексту.",
      },
    },
    voice: {
      title: "Голос і відео",
      inputMode: "РЕЖИМ ВВОДУ",
      vad: "Голосова активність",
      ptt: "Натисни й говори",
      pttHint:
        "Коли ввімкнено «Натисни й говори», у голосових каналах мікрофон спочатку вимкнений; щоб говорити, утримуйте кнопку на екрані.",
      noise: "ШУМОЗАГЛУШЕННЯ",
      noiseOff: "Вимкнено",
      noiseStandard: "Стандартне",
      noiseOffHint: "Ваш голос передається без обробки (інструменти, студійні мікрофони).",
      noiseStandardHint: "Вбудоване шумозаглушення вашого пристрою.",
      noiseAdvancedNote: "Розширене шумозаглушення (RNNoise) поки що доступне лише у вебверсії та на комп'ютері.",
      inputVolume: "ГУЧНІСТЬ ВВОДУ",
      outputVolume: "ГУЧНІСТЬ ВИВОДУ",
      deviceNote:
        "Телефон керує пристроями вводу й виводу автоматично. Вибирайте Bluetooth- або дротові пристрої на системній аудіопанелі.",
    },
    notifications: {
      title: "Сповіщення",
      permission: "ДОЗВІЛ НА СПОВІЩЕННЯ",
      master: "Сповіщення Ciklet",
      masterDescription: "Дозволити сповіщення на цьому пристрої.",
      permissionDenied: "Сповіщення вимкнено в системних налаштуваннях.",
      types: "ТИПИ СПОВІЩЕНЬ",
      messages: "Повідомлення та згадки",
      calls: "Вхідні дзвінки",
      friends: "Запити в друзі",
      sounds: "Звуки сповіщень",
      lockScreen: "ДЗВІНКИ НА ЗАБЛОКОВАНОМУ ЕКРАНІ",
      fullScreenOff: "Дозвіл на повноекранні дзвінки вимкнено",
      fullScreenBody:
        "Android потребує окремого дозволу, щоб показувати дзвінок на весь заблокований екран, коли застосунок закрито. Без нього дзвінки показуються лише як сповіщення.",
      openSettings: "Відкрити налаштування",
      overrides: "ПЕРЕВИЗНАЧЕННЯ ДЛЯ СЕРВЕРІВ, КАНАЛІВ І ЧАТІВ",
      overridesEmpty:
        "Перевизначень ще немає. Утримуйте сервер, канал чи чат і виберіть «Сповіщення», щоб додати.",
      reset: "Скинути до типового",
    },
  },
  automod: automod,
  safety: safety,
  voiceE2ee: voiceE2ee,
  streaming: streaming,
  serverGuide: serverGuide,
  serverTag: serverTag,
  serverBoost: serverBoost,
  /** Hesap değiştirici (web ile aynı anahtarlar) — account-switcher.en.ts. */
  accountSwitcher: accountSwitcher,
  /** Aile Merkezi (web ile aynı anahtarlar) — family-center.en.ts. */
  familyCenter: familyCenter,
  gameStats: gameStats,
  gameDetail: gameDetail,
  compliance: compliance,
  quests: quests,
  settingsAccount: settingsAccount,
  settingsGeneral: settingsGeneral,
  settingsMedia: settingsMedia,
  translation: translation,
  liveCaptions: liveCaptions,
  moreScreens: moreScreens,
  parityScreens: parityScreens,
} satisfies Translation<Messages>;
