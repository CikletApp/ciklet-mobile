import type { Translation } from "../../translation";
import type { parityScreensTr } from "../../parity-screens.tr";

/** az — parity-screens.tr.ts çevirisi. */
export const parityScreens = {
  folders: {
    createTitle: "Qovluq yarat",
    settingsTitle: "Qovluq parametrləri",
    nameLabel: "QOVLUQ ADI",
    defaultName: "Server qovluğu",
    colorLabel: "QOVLUQ RƏNGİ",
    currentColor: "Seçilmiş rəng",
    customColor: "Xüsusi rəng",
    pickServers: "SERVERLƏR",
    pickHint: "Qovluğa qoymaq üçün ən azı iki server seç.",
    inFolder: "QOVLUQDAKI SERVERLƏR ({count})",
    removeServer: "{name} serverini qovluqdan çıxar",
    removeHint: "Qovluqda tək server qalanda qovluq silinir.",
    addServers: "SERVER ƏLAVƏ ET",
    addServer: "{name} serverini qovluğa əlavə et",
    create: "Qovluq yarat",
    done: "Hazırdır",
    createFailed: "Qovluq yaradılmadı",
    saveFailed: "Qovluq yadda saxlanmadı",
    removeFailed: "Server qovluqdan çıxarılmadı",
    addFailed: "Server qovluğa əlavə edilmədi",
    newFolder: "Qovluq yarat",
    openSettings: "{name} qovluq parametrləri",
  },
} satisfies Translation<typeof parityScreensTr>;
