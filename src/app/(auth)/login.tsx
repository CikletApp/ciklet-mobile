import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "@/api/client";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Giriş ekranı.
 *
 * Başarılı girişten sonra yönlendirme YAPILMAZ: kök düzendeki
 * `Stack.Protected` guard'ı `status` değişince kabuğa geçer. Elle
 * `router.replace` çağırmak ikisinin yarışmasına ve bir kare titremeye
 * yol açar.
 */
export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const passwordRef = useRef<TextInput>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? // 401'de sunucu "Invalid credentials" döner; kullanıcıya Türkçe
            // ve hangi alanın yanlış olduğunu SIZDIRMAYAN bir mesaj göster.
            err.isUnauthorized
            ? "Kullanıcı adı veya şifre hatalı."
            : err.message
          : "Giriş yapılamadı."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: spacing["3xl"],
          gap: spacing.md,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xl, gap: spacing.xs }}>
          <Text style={{ ...typography.displayLg, color: colors.brand }}>Ciklet</Text>
          <Text style={{ ...typography.body, color: colors.muted }}>
            Hesabınla giriş yap
          </Text>
        </View>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Kullanıcı adı"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={inputStyle}
          accessibilityLabel="Kullanıcı adı"
        />

        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          style={inputStyle}
          accessibilityLabel="Şifre"
        />

        {error ? (
          <Text
            style={{ ...typography.caption, color: colors.danger }}
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            marginTop: spacing.sm,
            borderRadius: radii.full,
            backgroundColor: canSubmit ? colors.brand : colors.raised,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text
              style={{
                ...typography.bodyStrong,
                color: canSubmit ? colors.onBrand : colors.muted,
              }}
            >
              Giriş Yap
            </Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: spacing.lg,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.panel,
  color: colors.bright,
  ...typography.body,
} as const;
