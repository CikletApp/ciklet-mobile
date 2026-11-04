/**
 * Oyun istatistikleri ve onaylı oyun rozeti — ciklet-web
 * `lib/i18n/messages/ns/game-stats.tr.ts` ile birebir (web–mobil eşitliği).
 */
export const gameStatsTr = {
  card: {
    title: "Oyun İstatistikleri",
    updated: "{time} güncellendi",
    by: "{app} tarafından",
  },
  verified: {
    label: "Onaylı",
    tooltip: "Onaylı oyun — geliştiricisi Ciklet tarafından doğrulandı",
  },
  privacy: {
    title: "Oyun İstatistikleri",
    description: "Oyunların ve uygulamaların profilinin Oyunlar bölümüne yazdığı istatistikler. Gizlediğin kart kimseye görünmez.",
    empty: "Henüz profiline istatistik yazan bir oyun yok.",
    show: "Profilimde göster",
    remove: "Kaldır",
    hidden: "Gizli",
  },
} as const;
