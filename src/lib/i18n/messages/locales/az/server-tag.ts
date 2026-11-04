import type { Translation } from "../../translation";
import type { serverTagTr } from "../../server-tag.tr";


/** English for server-tag.tr.ts (web `ns/server-tag.en.ts` kopyası). */
export const serverTag = {
  pill: {
    tooltip: "{server} server teqi",
    generic: "Server teqi",
  },
  settings: {
    title: "Server Teqi",
    description: "Üzvlər bu teqi adlarının yanında göstərə bilər. 2–4 hərf və ya rəqəm və emoji nişanı seç.",
    tagLabel: "Teq",
    tagPlaceholder: "TEQ",
    tagHint: "2–4 hərf və ya rəqəm",
    badgeLabel: "Nişan",
    badgeHint: "Tək bir emoji",
    badgeClear: "Nişanı sil",
    badgePick: "Emoji seç",
    preview: "Önizləmə",
    previewName: "İstifadəçi",
    enabledLabel: "Üzvlər teqdən istifadə etsin",
    enabledDesc: "Söndürülü olduqda teq heç yerdə göstərilmir.",
    needTag: "Aktivləşdirməzdən əvvəl teq təyin et.",
    invalidTag: "Teq 2–4 hərf və ya rəqəmdən ibarət olmalıdır.",
    save: "Yadda saxla",
    saved: "Server teqi yadda saxlanıldı.",
    saveFailed: "Server teqini yadda saxlamaq mümkün olmadı.",
  },
  profile: {
    title: "Server Teqi",
    description: "Adının yanında göstəriləcək server teqini seç. Yalnız teqi aktiv olan serverlər siyahıda görünür.",
    none: "Heç biri",
    empty: "Teqindən istifadə edə biləcəyin heç bir serverdə deyilsən.",
    selected: "Seçilib",
    updated: "Server teqin yeniləndi.",
    removed: "Server teqin silindi.",
    failed: "Server teqini dəyişmək mümkün olmadı.",
  },
  menu: {
    adopt: "Teqi Götür",
    remove: "Teqi Sil",
  },
} satisfies Translation<typeof serverTagTr>;
