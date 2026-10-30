/**
 * Sunucu etiketi (web lib/server-tag; Discord "Server Tag") — web
 * `ns/server-tag.tr.ts` ile aynı anahtarlar ve metinler.
 */
export const serverTagTr = {
  pill: {
    tooltip: "{server} sunucusunun etiketi",
    generic: "Sunucu etiketi",
  },
  settings: {
    title: "Sunucu Etiketi",
    description: "Üyeler bu etiketi adlarının yanında gösterebilir. 2–4 harf ya da rakam ve bir emoji rozet seç.",
    tagLabel: "Etiket",
    tagPlaceholder: "ÖRN",
    tagHint: "2–4 harf veya rakam",
    badgeLabel: "Rozet",
    badgeHint: "Tek bir emoji",
    badgeClear: "Rozeti kaldır",
    badgePick: "Emoji seç",
    preview: "Önizleme",
    previewName: "Kullanıcı",
    enabledLabel: "Üyeler etiketi kullanabilsin",
    enabledDesc: "Kapalıyken etiket hiçbir yerde görünmez.",
    needTag: "Etiketi açmak için önce bir etiket belirle.",
    invalidTag: "Etiket 2–4 harf veya rakam olmalı.",
    save: "Kaydet",
    saved: "Sunucu etiketi kaydedildi.",
    saveFailed: "Sunucu etiketi kaydedilemedi.",
  },
  profile: {
    title: "Sunucu Etiketi",
    description: "Adının yanında gösterilecek sunucu etiketini seç. Yalnızca etiketi açık olan sunucuların listelenir.",
    none: "Yok",
    empty: "Etiketini kullanabileceğin bir sunucu yok.",
    selected: "Seçili",
    updated: "Sunucu etiketin güncellendi.",
    removed: "Sunucu etiketin kaldırıldı.",
    failed: "Sunucu etiketi değiştirilemedi.",
  },
  menu: {
    adopt: "Etiketi Kullan",
    remove: "Etiketi Bırak",
  },
} as const;
