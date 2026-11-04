/**
 * Sunucu şeridi v2 (sol ray: Ana Sayfa, sunucular, klasörler, alt eylemler).
 * Türkçe kaynak; İngilizcesi server-rail.en.ts (aynı şekil zorunlu).
 * Web `ns/server-rail.tr.ts` kopyası (web ile aynı metinler).
 */
export const serverRailTr = {
  label: "Sunucular",
  home: "Direkt Mesajlar",
  addServer: "Bir Sunucu Ekle",
  discover: "Sunucuları Keşfet",
  download: "Uygulamayı İndir",
  newActivity: "#{channel} kanalında yeni etkinlik",
  voiceCount: "Seste {count} kişi",
  unread: "{count} okunmamış",
  keyboardHint: "Taşımak için Alt+Shift+Yukarı/Aşağı",
  folder: {
    defaultName: "Sunucu Klasörü",
    aria: "{name} klasörü, {count} sunucu",
    markRead: "Klasörü Okundu Olarak İşaretle",
    moveTo: "Şuraya taşı:",
    settings: "Klasör Ayarları",
    closeAll: "Tüm Klasörleri Kapat",
  },
  move: {
    top: "En üste",
    up: "Bir yukarı",
    down: "Bir aşağı",
    bottom: "En alta",
  },
  server: {
    markRead: "Okunmuş Olarak İşaretle",
    removeFromFolder: "Klasörden Çıkar",
    addToFolder: "Klasöre ekle: {name}",
  },
  settings: {
    title: "Klasör Ayarları",
    name: "Klasör Adı",
    color: "Klasör Rengi",
    customColor: "Özel renk",
    done: "Bitti",
  },
  toast: {
    saveFailed: "Sunucu sıralaması kaydedilemedi; önceki düzene dönüldü.",
    folderSaveFailed: "Klasör ayarları kaydedilemedi.",
  },
} as const;
