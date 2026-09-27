import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { fw } from "@/theme/fonts";
import { authBrand, colors, radii, spacing } from "@/theme/tokens";

/**
 * Tek kullanımlık kod girişi — kutu kutu. ciklet-web
 * `components/auth/otp-input.tsx`'in mobil karşılığı.
 *
 * İki biçim (web `lib/otp.ts` ile aynı):
 *  • numeric      → 6 hane, e-posta doğrulama. Sayısal tuş takımı açılır.
 *  • alphanumeric → 8 karakter, şifre sıfırlama. Girdi BÜYÜK HARFE katlanır
 *    ve alfabede olmayan (karışan) glifler hiç kabul edilmez.
 *
 * Tek bir görünmez TextInput tüm kutuların üstünde duruyor: kutu başına ayrı
 * girdi olsaydı yapıştırma, geri silme ve klavyenin kod önerisi (autofill)
 * her kutuda ayrı ele alınmak zorunda kalırdı.
 */

export type OtpMode = "numeric" | "alphanumeric";

/** Web `ALPHANUMERIC_ALPHABET`: 0/O, 1/I, L gibi karışan glifler yok. */
const ALPHANUMERIC_REJECT = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;
const NUMERIC_REJECT = /\D/g;

export function OtpField({
  value,
  onChange,
  onComplete,
  length = 6,
  mode = "numeric",
  invalid = false,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Son kutu dolduğunda — form kendiliğinden gönderebilsin diye. */
  onComplete?: (value: string) => void;
  length?: number;
  mode?: OtpMode;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const next = (mode === "alphanumeric" ? raw.toUpperCase().replace(ALPHANUMERIC_REJECT, "") : raw.replace(NUMERIC_REJECT, ""))
      .slice(0, length);
    onChange(next);
    if (next.length === length && next !== value) onComplete?.(next);
  };

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      disabled={disabled}
      accessibilityLabel={`${length} karakterlik doğrulama kodu`}
      style={{ flexDirection: "row", gap: length > 6 ? 6 : spacing.sm }}
    >
      {Array.from({ length }, (_, index) => {
        const char = value[index] ?? "";
        // İmleç, dolu son kutudan sonraki kutuda; kod tamsa son kutuda kalır.
        const active = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={{
              flex: 1,
              maxWidth: 52,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.lg,
              borderCurve: "continuous",
              borderWidth: active ? 2 : 1,
              borderColor: invalid ? colors.danger : active ? authBrand.lime : colors.border,
              backgroundColor: colors.deep,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Text style={{ ...fw(700), fontSize: 22, color: colors.bright }}>{char}</Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType={mode === "numeric" ? "number-pad" : "default"}
        autoCapitalize={mode === "numeric" ? "none" : "characters"}
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        // Kutuların üstünü kaplıyor ama görünmüyor: dokunma, yapıştırma ve
        // uzun basma menüsü doğrudan bu girdiye düşer.
        style={{ position: "absolute", inset: 0, opacity: 0.02, color: "transparent" }}
      />
    </Pressable>
  );
}
