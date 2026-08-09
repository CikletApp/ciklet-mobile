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
