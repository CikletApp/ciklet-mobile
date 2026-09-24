import { Text, TextInput } from "react-native";

export type AppFontId = "inter" | "poppins" | "plus-jakarta-sans" | "figtree" | "dm-sans";

const PREFIX: Record<AppFontId, string> = {
  inter: "CikletInter",
  poppins: "CikletPoppins",
  "plus-jakarta-sans": "CikletPlusJakartaSans",
  figtree: "CikletFigtree",
  "dm-sans": "CikletDMSans",
};

let currentFont: AppFontId | null = null;

export function parseAppFontId(value: unknown): AppFontId {
  return typeof value === "string" && value in PREFIX ? value as AppFontId : "inter";
}

export function setAppFont(value: unknown) {
  currentFont = parseAppFontId(value);
  const family = fontFamily(400);
  // Native Text bir üst View'dan font miras almaz. Varsayılan yüz,
  // typography yaymayan küçük rozetleri de kapsar; adlandırılmış stiller
  // aşağıda doğru ağırlıkla bunu geçersiz kılar.
  const NativeText = Text as typeof Text & { defaultProps?: { style?: unknown } };
  const NativeInput = TextInput as typeof TextInput & { defaultProps?: { style?: unknown } };
  NativeText.defaultProps = {
    ...(NativeText.defaultProps ?? {}),
    style: [NativeText.defaultProps?.style, { fontFamily: family }],
  };
  NativeInput.defaultProps = {
    ...(NativeInput.defaultProps ?? {}),
    style: [NativeInput.defaultProps?.style, { fontFamily: family }],
  };
}

export function fontFamily(weight: 400 | 500 | 600 | 700 = 400, italic = false) {
  if (!currentFont) return undefined;
  return `${PREFIX[currentFont]}-${weight}${italic ? "Italic" : ""}`;
}

type WeightInput = 400 | 500 | 600 | 700 | 800 | 900 | "400" | "500" | "600" | "700" | "800" | "900" | "normal" | "bold";

function faceWeight(weight: WeightInput): 400 | 500 | 600 | 700 {
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const numeric = Number(weight);
  if (numeric >= 700) return 700;
  if (numeric >= 600) return 600;
  if (numeric >= 500) return 500;
  return 400;
}

/**
 * Kalınlık — `fontWeight` YERİNE kullanılır.
 *
 * Android'de expo-font her yüzü ("CikletInter-700") yalnızca NORMAL stil
 * için kaydediyor. Özel bir aileyle birlikte `fontWeight: "700"` verilince
 * RN o ailenin kalın varyantını arıyor, bulamıyor ve SİSTEM fontuna
 * (Roboto) düşüyordu: başlıklar ve kalın etiketler web fontuyla değil
 * Roboto ile çiziliyordu. Doğrusu kalınlığı doğru yüze çevirmek ve
 * `fontWeight`'ı normal bırakmak. Özel font yüklenmediyse sistem fontu
 * kalınlığıyla çalışır.
 */
export function fw(weight: WeightInput): { fontFamily?: string; fontWeight: "normal" | "400" | "500" | "600" | "700" | "800" | "900" | "bold" } {
  const family = fontFamily(faceWeight(weight));
  if (family) return { fontFamily: family, fontWeight: "normal" };
  return { fontWeight: typeof weight === "number" ? (String(weight) as "700") : weight };
}
