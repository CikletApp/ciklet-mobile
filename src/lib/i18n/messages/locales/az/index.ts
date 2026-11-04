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

/** az sözlüğü — şekil tr.ts'ten; eksik anahtar İngilizceye düşer. */
export const messages = {
  common: {
    cancel: "Ləğv et",
    save: "Yadda saxla",
    close: "Bağla",
    system: "Sistem",
    on: "Aktiv",
    off: "Deaktiv",
  },
  tabs: {
    chats: "Söhbətlər",
    servers: "Serverlər",
    notifications: "Bildirişlər",
    me: "Sən",
    unread: "{label}, {count} oxunmamış",
  },
  messagePreview: {
    voice: "🎤 Səsli mesaj",
    voiceWithDuration: "🎤 Səsli mesaj ({duration})",
    activity: "🎮 Fəaliyyət: {name}",
    activityUnnamed: "🎮 Fəaliyyət dəvəti",
    image: "📷 Şəkil",
    video: "🎥 Video",
    gif: "GIF",
    sticker: "Stiker",
    clip: "🎬 Klip",
    file: "📎 {name}",
    attachment: "📎 Əlavə",
  },
  activity: {
    broadcast: {
      live: "Canlı",
      game: "{game} yayımlayır",
      liveOn: "{platform} üzərində canlı",
      title: "Canlı yayın",
      watch: "Yayına Bax",
    },
  },
  appCommands: {
    commands: "Əmrlər",
    apps: "Tətbiqlər",
    optional: "İstəyə bağlı",
    required: "Məcburi",
    true: "Doğru",
    false: "Yanlış",
    chooseFile: "Fayl seç",
    loading: "Yüklənir…",
    noSuggestions: "Təklif yoxdur",
    timedOut: "Tətbiq vaxtında cavab vermədi",
    selectUser: "İstifadəçi seç",
    selectRole: "Rol seç",
    selectChannel: "Kanal seç",
    selectMentionable: "İstifadəçi və ya rol seç",
    enterValue: "Dəyər daxil et",
    enterNumber: "Rəqəm daxil et",
    runFailed: "Əmri icra etmək mümkün olmadı.",
  },
  messageComponents: {
    choose: "Seçim et",
    chooseOption: "Variant seç",
    search: "Axtar",
    noResults: "Nəticə tapılmadı",
    loading: "Yüklənir…",
    confirm: "Seç",
    clear: "Təmizlə",
    selectedCount: "{count} seçilib",
    selectRange: "{min}–{max} seçim",
    unknown: "Naməlum",
    botNoResponse: "{name} cavab vermədi.",
    interactionFailed: "Qarşılıqlı əlaqəni başlatmaq mümkün olmadı.",
    formNoResponse: "Bot formaya cavab vermədi.",
    formFailed: "Formanı göndərmək mümkün olmadı.",
    formLabel: "Bot forması",
    submit: "Göndər",
    cancel: "Ləğv et",
    requiredMark: "Məcburi",
    uploadFile: "Fayl yüklə",
    uploading: "Yüklənir…",
    uploadFailed: "Faylı yükləmək mümkün olmadı.",
    removeFile: "Sil",
    fileLimit: "Ən çox {max} fayl",
    allowedTypes: "İcazə verilən: {types}",
    fileTypeRejected: "Bu fayl tipi qəbul edilmir.",
    download: "Endir",
    spoiler: "Spoyler",
    show: "Göstər",
    openImage: "Şəkli böyüt",
    attachment: "Əlavə",
  },
  settings: {
    title: "Ayarlar",
    editProfile: "Profilini redaktə et",
    sections: {
      account: "HESAB AYARLARI",
      app: "TƏTBİQ AYARLARI",
      support: "DƏSTƏK",
      session: "SESSİYA",
    },
    rows: {
      account: "Hesab",
      mentol: "Mentol",
      privacy: "Məxfilik, Məlumat və Sosial",
      friendRequests: "Dostluq Sorğuları",
      authorizedApps: "İcazə Verilmiş Tətbiqlər",
      voice: "Səs və Video",
      appearance: "Görünüş",
      chat: "Söhbət",
      notifications: "Bildirişlər",
      activity: "Fəaliyyət Statusu",
      help: "Kömək",
      helpSubtitle: "Dəstək, rəy, şərtlər",
      scanLogin: "Kodu skan et",
      scanLoginSubtitle: "Telefonunla masaüstündə daxil ol",
    },
    scanLogin: {
      title: "Kodu skan et",
      hint: "Masaüstü giriş ekranındakı fırlanan halqanı kadra sal.",
      permissionTitle: "Kamera girişi lazımdır",
      permissionBody: "Masaüstündəki kodu oxumaq üçün kamera lazımdır.",
      permissionAction: "İcazə ver",
      openSettings: "Ayarları aç",
      searching: "Kod axtarılır…",
      checking: "Kod yoxlanılır…",
      gone: "Bu kodun vaxtı bitib. Masaüstünün onu yeniləməsini gözlə və yenidən skan et.",
      confirmTitle: "Masaüstündə daxil olunsun?",
      confirmBody: "Bunu sən başlatmamısansa, rədd et. Kodu heç vaxt paylaşma.",
      device: "Cihaz",
      location: "Məkan",
      ip: "IP ünvanı",
      time: "Vaxt",
      justNow: "İndicə",
      approve: "Bəli, daxil ol",
      reject: "Xeyr, bu mən deyiləm",
      approved: "Təsdiqləndi. Masaüstündə daxil olunur.",
      rejected: "Rədd edildi. Masaüstü kodu yenilənəcək.",
      failed: "Təsdiqi göndərmək mümkün olmadı. Yenidən cəhd et.",
      unknownLocation: "Naməlum",
    },
    logout: {
      action: "Çıxış Et",
      title: "Çıxış et",
      message: "Bu cihazda hesabından çıxış ediləcək.",
    },
    memberSince: "{date} tarixindən Ciklet-də",
    appearance: {
      title: "Görünüş",
      motion: {
        title: "HƏRƏKƏTİ AZALT",
        description:
          "Keçidləri, sürüşən panelləri və döyünən animasiyaları azaldır. Sistem seçimi telefonunun əlçatanlıq ayarını izləyir.",
      },
      language: {
        title: "DİL",
        description: "İnterfeys dili. Tərcümə davam edir; tərcümə olunmamış mətnlər ingilis və ya türk dilində görünür.",
        system: "Cihaz dili ({name})",
        restartRtl: "Yeni yazı istiqamətinin tətbiq olunması üçün tətbiqi bağlayıb yenidən aç.",
      },
    },
    voice: {
      title: "Səs və Video",
      inputMode: "GİRİŞ REJİMİ",
      vad: "Səs aktivliyi",
      ptt: "Bas və danış",
      pttHint:
        "Bas və danış aktiv olduqda səs kanallarında mikrofonun səssiz başlayır; danışmaq üçün ekrandakı düyməni basılı saxla.",
      noise: "SƏS-KÜYÜN AZALDILMASI",
      noiseOff: "Deaktiv",
      noiseStandard: "Standart",
      noiseOffHint: "Səsin emal olunmadan göndərilir (alətlər, studiya mikrofonları).",
      noiseStandardHint: "Cihazının daxili səs-küy azaldılması.",
      noiseAdvancedNote: "Təkmil səs-küy azaldılması (RNNoise) hələlik yalnız veb və masaüstündə var.",
      inputVolume: "GİRİŞ SƏSİ",
      outputVolume: "ÇIXIŞ SƏSİ",
      deviceNote:
        "Telefonun giriş və çıxış cihazlarını avtomatik idarə edir. Bluetooth və ya simli cihazları sistemin səs panelindən seç.",
    },
    notifications: {
      title: "Bildirişlər",
      permission: "BİLDİRİŞ İCAZƏSİ",
      master: "Ciklet bildirişləri",
      masterDescription: "Bu cihazda bildirişlərə icazə ver.",
      permissionDenied: "Bildirişlər sistem ayarlarında söndürülüb.",
      types: "BİLDİRİŞ NÖVLƏRİ",
      messages: "Mesajlar və qeyd etmələr",
      calls: "Gələn zənglər",
      friends: "Dostluq sorğuları",
      sounds: "Bildiriş səsləri",
      lockScreen: "KİLİD EKRANINDA ZƏNGLƏR",
      fullScreenOff: "Tam ekran zəng icazəsi söndürülüb",
      fullScreenBody:
        "Tətbiq bağlı olarkən kilid ekranında tam ekran zəng çalması üçün Android ayrıca icazə tələb edir. Bu icazə olmadan zənglər yalnız bildiriş kimi görünür.",
      openSettings: "Ayarları aç",
      overrides: "SERVER, KANAL VƏ SÖHBƏT İSTİSNALARI",
      overridesEmpty:
        "Hələ istisna yoxdur. Əlavə etmək üçün server, kanal və ya söhbətə uzun bas və Bildirişlər seç.",
      reset: "Defolta qaytar",
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
