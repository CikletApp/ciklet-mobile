import { useRef, useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Giriş hatasını kullanıcıya gösterilecek metne çevirir. Sunucu makine
 * okunur kod ve İngilizce metin döndürüyor (bkz. ciklet-web
 * /api/mobile/auth); ham metin gösterilmez.
 */
function loginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Giriş yapılamadı.";
  if (err.isUnauthorized && err.code !== "totp_required" && err.code !== "totp_invalid") {
    return "Kullanıcı adı veya şifre hatalı.";
  }
  switch (err.code) {
    case "email_not_verified":
      return "E-posta adresini doğrulamadan giriş yapamazsın. Doğrulama bağlantısı için e-postanı kontrol et.";
    case "phone_verification_required":
      return "Hesabını kullanmaya başlamadan önce telefon numaranı doğrulaman gerekiyor. Bunu ciklet.xyz üzerinden yapabilirsin.";
    case "totp_required":
    case "totp_invalid":
      return "Bu hesapta iki adımlı doğrulama açık. Şimdilik ciklet.xyz üzerinden giriş yapabilirsin.";
  }
  if (err.status === 429) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if (err.status >= 500) return "Sunucuda geçici bir sorun var. Biraz sonra tekrar dene.";
  if (err.isNetwork) return "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
  return err.message;
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ username?: string; verified?: string }>();
  const login = useAuth((s) => s.login);
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState(params.username ?? "");
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
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Tekrar hoş geldin!"
      subtitle="Seni yeniden gördüğümüze sevindik."
      onBack={() => router.back()}
    >
      {params.verified === "1" ? (
        <Text style={{ ...typography.caption, color: colors.success }}>
          E-postan doğrulandı. Şimdi giriş yapabilirsin.
        </Text>
      ) : null}
      <AuthField
        label="KULLANICI ADI"
        value={username}
        onChangeText={setUsername}
        placeholder="kullaniciadi"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="ŞİFRE"
        value={password}
        onChangeText={setPassword}
        placeholder="Şifren"
        secureTextEntry
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
      <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8}>
        <Text style={{ ...typography.caption, color: colors.accent }}>Şifreni mi unuttun?</Text>
      </Pressable>
      <Button label="Giriş Yap" size="lg" fullWidth onPress={onSubmit} loading={busy} disabled={!canSubmit} />
      <Pressable onPress={() => router.push("/(auth)/register")} style={{ paddingTop: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
          Hesabın yok mu? <Text style={{ color: colors.accent }}>Kaydol</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
