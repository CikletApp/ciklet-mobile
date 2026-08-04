import { forwardRef, useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";

/**
 * Metin girdisi.
 *
 * Odak halkası, hata durumu ve karakter sayacı burada; ekranlarda
 * tekrarlanmaz. `maxLength` verildiğinde sayaç sınırın %80'inden sonra
 * görünür — sürekli görünen sayaç yazarken dikkat dağıtır.
 */

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  /** Alanın üstünde küçük açıklama. */
  hint?: string;
  error?: string | null;
  icon?: IconName;
  /** Girdi başına sabit önek (ör. kullanıcı adı için "@"). */
  prefix?: string;
  multiline?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, icon, prefix, multiline, maxLength, value, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);

  const length = value?.length ?? 0;
  const showCounter = Boolean(maxLength) && length > maxLength! * 0.8;

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.brand
      : colors.border;

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Text style={{ ...typography.overline, color: colors.muted }}>{label}</Text>
      ) : null}

      {hint ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{hint}</Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: multiline ? spacing.md : 0,
          minHeight: multiline ? 96 : MIN_TOUCH_TARGET + 4,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.bg,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={colors.muted} /> : null}
        {prefix ? (
          <Text style={{ ...typography.body, color: colors.muted }}>{prefix}</Text>
        ) : null}

        <TextInput
          ref={ref}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={{
            flex: 1,
            paddingVertical: multiline ? 0 : spacing.md,
            color: colors.bright,
            textAlignVertical: multiline ? "top" : "center",
            ...typography.body,
          }}
          accessibilityLabel={label ?? rest.placeholder}
          {...rest}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {error ? (
          <Text
            style={{ ...typography.caption, color: colors.danger, flex: 1 }}
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {showCounter ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
});
