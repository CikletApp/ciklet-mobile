import type { liveCaptionsTr, translationTr } from "../../live-language.tr";
import type { Translation } from "../../translation";

export const translation = {
  menu: {
    translate: "Tərcümə et",
    translating: "Tərcümə olunur…",
    unsupported: "Bu brauzer tərcüməni dəstəkləmir",
    unsupportedDevice: "Bu cihaz tərcüməni dəstəkləmir",
    remove: "Tərcüməni sil",
  },
  footer: {
    translatedFrom: "{language} dilindən tərcümə olunub",
    showOriginal: "Orijinalı göstər",
    showTranslation: "Tərcüməni göstər",
    dismiss: "Tərcüməni bağla",
    translating: "Tərcümə olunur…",
    downloading: "Dil modeli cihazına endirilir… {percent}%",
  },
  errors: {
    same: "Bu mesaj artıq {language} dilindədir.",
    unavailable: "Bu dil cütü üçün cihazda tərcümə mövcud deyil.",
    undetected: "Mesajın dili müəyyən edilmədi.",
    empty: "Tərcümə ediləcək mətn yoxdur.",
    failed: "Tərcümə alınmadı.",
  },
  settings: {
    title: "Tərcümə dili",
    description: "“Tərcümə et” mesajları bu dilə tərcümə edir. Tərcümə sənin cihazında aparılır; mesajların məzmunu heç vaxt Ciklet serverlərinə göndərilmir.",
    auto: "İnterfeys dili ({language})",
    unsupported: "Bu brauzer cihazda tərcüməni dəstəkləmir; Chrome və ya Edge-in yeni versiyasından istifadə et.",
    unsupportedDevice: "Bu cihaz cihazda tərcüməni dəstəkləmir.",
  },
} satisfies Translation<typeof translationTr>;

export const liveCaptions = {
  button: "Altyazılar",
  title: "Canlı altyazılar",
  publish: {
    label: "Danışığımı altyazıya çevir",
    description: "Danışığın cihazında mətnə çevrilir və yalnız bu zəngdəki insanlara göndərilir. Səs yazılmır.",
  },
  show: {
    label: "Altyazıları göstər",
    description: "Altyazını açan iştirakçıların danışığı ekranın aşağısında görünür.",
  },
  language: "Danışıq dili",
  languageAuto: "İnterfeys dili",
  indicator: "Altyazılar açıqdır",
  indicatorHelp: "Bu şəxs danışığını altyazı kimi yayımlayır.",
  status: {
    listening: "Dinlənilir…",
    muted: "Mikrofonun bağlıdır — altyazılar dayandırılıb.",
    unsupported: "Bu cihaz nitqin tanınmasını dəstəkləmir.",
    denied: "Mikrofon və ya nitqin tanınması icazəsi verilməyib.",
    e2eeBlocked: "Bu cihaz uçdan-uca şifrələnmiş zəngdə altyazıları şifrələyə bilmir; altyazı yayımı bağlıdır.",
    e2ee: "Altyazılar uçdan-uca şifrələnərək göndərilir.",
    cloud: "Brauzerin danışığını tanımaq üçün öz nitq xidmətindən istifadə edə bilər; səs heç vaxt Ciklet serverlərinə getmir.",
    onDevice: "Nitqin tanınması sənin cihazında işləyir.",
    error: "Nitqin tanınması dayandı.",
  },
  empty: "Hələ altyazı yoxdur.",
} satisfies Translation<typeof liveCaptionsTr>;
