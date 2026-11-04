import type { Translation } from "../../translation";
import type { voiceE2eeTr } from "../../voice-e2ee.tr";


/** Uçtan uca şifreli ses — İngilizce; web `ns/voice-e2ee.en.ts` ile AYNI. */
export const voiceE2ee = {
  status: {
    encrypted: "Uçdan-uca şifrələnib",
    connecting: "Şifrələmə qurulur…",
    mixed: "Şifrələnməmiş iştirakçı var",
    unsupported: "Şifrələnməmiş bağlantı",
  },
  title: "Uçdan-uca şifrələmə",
  body: {
    encrypted:
      "Səsin, videon və ekran paylaşımın yalnız bu zəngdəki insanların cihazlarında deşifrə olunur. Başqa heç kim, hətta Ciklet serverləri belə məzmunu görə bilməz.",
    connecting: "İştirakçılarla şifrələmə açarları mübadilə olunur.",
    mixed:
      "Bəzi iştirakçılar uçdan-uca şifrələməsi olmayan versiyadan istifadə edir. Onların səsi şifrələnmədən göndərilir və onlar şifrələnmiş iştirakçıları eşidə bilmir.",
    unsupported:
      "Bu cihaz və ya brauzer uçdan-uca şifrələməni dəstəkləmir: səsin şifrələnmədən göndərilir və şifrələnmiş iştirakçıları eşidə bilmirsən. Ciklet-i yenilə və ya güncəl Chrome, Edge, Firefox ya da Safari istifadə et.",
  },
  code: {
    title: "Səs məxfiliyi kodu",
    help: "Bu kodu digər iştirakçılarla müqayisə et (məsələn, ucadan oxu). Hamı eyni kodu görürsə, zəng uçdan-uca şifrələnib və arada heç kim qulaq asmır. Kimsə qoşulanda və ya ayrılanda kod dəyişir.",
    copy: "Kodu kopyala",
    copied: "Kod kopyalandı",
    waiting: "Açarlar hazır olduqda kod görünəcək.",
  },
  unencrypted: {
    title: "Şifrələnməmiş iştirakçılar",
    badge: "Şifrələnməmiş iştirakçı",
  },
  pending: "Şifrələmə gözlənilir",
} satisfies Translation<typeof voiceE2eeTr>;
