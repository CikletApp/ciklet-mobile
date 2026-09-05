import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, TextInput, View } from "react-native";
import {
  ALPHANUMERIC_INPUT_FILTER,
  NUMERIC_CODE_LENGTH,
} from "@ciklet/embedded-activities-sdk/types";

import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Tek kullanımlık kod girişi — kutu kutu.
 *
 * ── Neden TEK gizli girdi, N tane değil ─────────────────────────────
 * Web tarafı her kutuyu ayrı `<input>` yapıyor ve odağı elle taşıyor
 * (`components/auth/otp-input.tsx`). Bu, mobilde iki nedenle çalışmaz:
 *
 *  1. **Otomatik doldurma.** iOS kodu e-postadan/SMS'ten yakalayıp
 *     `textContentType="oneTimeCode"` olan girdiye TEK SEFERDE yazar,
 *     Android da `autoComplete="sms-otp"` ile aynısını yapar. Altı ayrı
 *     girdide bu tamamen kaybolur — kullanıcı kodu elle yazmak zorunda kalır.
 *  2. **Silme.** Boş bir kutuda geri silme tuşunu yakalayıp bir önceki
 *     kutuya atlamak, yazılım klavyelerinde `onKeyPress` güvenilir
 *     olmadığı için Android'de tutarsız davranır.
 *
 * Bu yüzden GÖRÜNEN kutular yalnızca çizimdir; değeri tutan tek bir şeffaf
 * `TextInput` üstlerine serilir. Klavye, seçim ve otomatik doldurma tek bir
 * yerel girdiyle konuşur.
 *
 * Kabul edilen karakterler ve uzunluk SDK'dan gelir; sunucunun alfabesiyle
 * (`ciklet-web/src/lib/otp.ts`) birebir aynıdır.
 */

const NUMERIC_FILTER = /\D/g;

export type OtpMode = "numeric" | "alphanumeric";

interface OtpFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Son kutu dolduğunda tetiklenir — form kendiliğinden gönderebilsin diye. */
  onComplete?: (value: string) => void;
  length?: number;
  mode?: OtpMode;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  error?: string;
}

export function OtpField({
  label,
  value,
  onChange,
  onComplete,
  length = NUMERIC_CODE_LENGTH,
  mode = "numeric",
  disabled,
  invalid,
  autoFocus,
  error,
}: OtpFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // `useState` başlatıcısı, `useRef(...).current` yerine bilerek: React
  // Compiler ref'in `.current` değerini render sırasında okumayı hata
  // sayıyor. Depoda kullanılan biçim de bu (bkz. components/ui/badge.tsx).
  const [shake] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!autoFocus) return;
    // Ekran geçiş animasyonu bitmeden odaklanmak Android'de klavyeyi
    // açmıyor; bir kare beklemek yeterli.
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    if (!invalid) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [invalid, shake]);

  const sanitize = (raw: string) =>
    mode === "alphanumeric"
      ? raw.toUpperCase().replace(ALPHANUMERIC_INPUT_FILTER, "")
      : raw.replace(NUMERIC_FILTER, "");

  const handleChange = (raw: string) => {
    const next = sanitize(raw).slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const boxBorder = (index: number) => {
    if (invalid) return colors.danger;
    // İmleç kutusu: dolu karakterlerin hemen sonrası. Son kutu doluyken
    // "sonraki" diye bir kutu yok, o yüzden sonuncuda kalır.
    const cursorAt = Math.min(value.length, length - 1);
    if (focused && index === cursorAt) return colors.brand;
    // Dolu kutu biraz daha belirgin: kaç karakter girildiği tek bakışta
    // okunur, kod uzunken (8 karakter) bu fark işe yarıyor.
    return value[index] ? colors.muted : colors.border;
  };

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ ...typography.overline, color: invalid ? colors.danger : colors.muted }}>
          {label}
        </Text>
      ) : null}

      <Animated.View
        style={{
          transform: [
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
          ],
        }}
      >
        <Pressable
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="none"
          style={{ flexDirection: "row", gap: spacing.sm }}
        >
          {Array.from({ length }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: length > 6 ? 52 : 58,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.lg,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: boxBorder(index),
                backgroundColor: colors.deep,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  ...typography.display,
                  // Sekiz kutu dar ekrana da sığmak zorunda.
                  fontSize: length > 6 ? 19 : 24,
                  color: colors.bright,
                }}
              >
                {value[index] ?? ""}
              </Text>
            </View>
          ))}

          {/*
            Değeri tutan gerçek girdi. Görünmez ama DOKUNULABİLİR olmalı:
            `opacity: 0` yeterli, `display: none` olsaydı klavye hiç açılmaz
            ve otomatik doldurma da tetiklenmezdi.
          */}
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
            maxLength={length}
            keyboardType={mode === "alphanumeric" ? "default" : "number-pad"}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            // iOS e-postadaki/SMS'teki kodu buradan doldurur.
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
            accessibilityLabel={label ?? "Doğrulama kodu"}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0,
              // Android'de sıfır boyutlu girdi odak almaz; kutuların tamamını
              // kaplaması hem odağı hem dokunmayı garantiler.
              color: "transparent",
            }}
          />
        </Pressable>
      </Animated.View>

      {error ? (
        <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
      ) : null}
    </View>
  );
}
