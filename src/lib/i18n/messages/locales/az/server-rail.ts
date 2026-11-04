import type { Translation } from "../../translation";
import type { serverRailTr } from "../../server-rail.tr";

/** az — server-rail çevirisi (eksik anahtar İngilizceye düşer). */
export const serverRail = {
  label: "Serverlər",
  home: "Birbaşa mesajlar",
  addServer: "Server əlavə et",
  discover: "Serverləri kəşf et",
  download: "Tətbiqi yüklə",
  newActivity: "#{channel} kanalında yeni fəaliyyət",
  voiceCount: "Səsdə {count} nəfər",
  unread: "{count} oxunmamış",
  keyboardHint: "Daşımaq üçün Alt+Shift+Yuxarı/Aşağı",
  folder: {
    defaultName: "Server qovluğu",
    aria: "{name} qovluğu, {count} server",
    markRead: "Qovluğu oxunmuş kimi işarələ",
    moveTo: "Bura daşı:",
    settings: "Qovluq ayarları",
    closeAll: "Bütün qovluqları bağla",
  },
  move: {
    top: "Ən yuxarı",
    up: "Bir yuxarı",
    down: "Bir aşağı",
    bottom: "Ən aşağı",
  },
  server: {
    markRead: "Oxunmuş Kimi İşarələ",
    removeFromFolder: "Qovluqdan çıxar",
    addToFolder: "Qovluğa əlavə et: {name}",
  },
  settings: {
    title: "Qovluq ayarları",
    name: "Qovluq adı",
    color: "Qovluq rəngi",
    customColor: "Xüsusi rəng",
    done: "Hazır",
  },
  toast: {
    saveFailed: "Server sırası yadda saxlanmadı; əvvəlki düzən bərpa edildi.",
    folderSaveFailed: "Qovluq ayarları yadda saxlanmadı.",
  },
} satisfies Translation<typeof serverRailTr>;
