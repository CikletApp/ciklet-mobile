import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MobileAuthErrorCode } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Giriş.
 *
 * Web'deki `components/auth/login-form.tsx` ile AYNI hata dallanmasını
 * uygular; bu bir üslup tercihi değil, işlevsel bir zorunluluk. Sunucu
 * girişi reddetmenin dört ayrı sebebini ayrı kodlarla söylüyor
 * (`email_not_verified`, `totp_required`, `totp_invalid`, hız sınırı) ve
 * bunların üçünde ŞİFRE DOĞRUDUR. Hepsini "kullanıcı adı veya şifre hatalı"
 * diye göstermek — mobilin daha önce yaptığı buydu — doğrulanmamış ya da
 * 2FA açık bir hesabı telefondan tamamen erişilemez yapıyordu: kullanıcının
 * doğru şifreyi tekrar tekrar denemekten başka yapabileceği bir şey yoktu.
 */
export default function LoginScreen() {
  const params = useLocalSearchParams<{ username?: string; verified?: string }>();
  const login = useAuth((s) => s.login);
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState(params.username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * İkinci faktör adımı. Şifre DOĞRU olduğunda ve hesapta 2FA açıkken sunucu
   * `totp_required` döner; form bu adıma geçer ve aynı bilgileri kodla
   * birlikte yeniden gönderir.
   */
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totp, setTotp] = useState("");

  const canSubmit =
    username.trim().length > 0 &&
    password.length > 0 &&
    (!needsTotp || totp.trim().length > 0) &&
    !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password, needsTotp ? totp : undefined);
    } catch (err) {
      handleLoginError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleLoginError = (err: unknown) => {
    if (!(err instanceof ApiError)) {
      setError("Giriş yapılamadı.");
      return;
    }

    if (err.isNetwork) {
      setError(err.message);
      return;
    }

    switch (err.code) {
      case MobileAuthErrorCode.EMAIL_NOT_VERIFIED:
        // Şifre DOĞRUYDU; hesap yalnızca doğrulanmamış. Kullanıcıyı hata
        // metniyle baş başa bırakmak yerine doğrudan kod ekranına al —
        // oradaki "yeniden gönder" tıkanan tek yolu açar.
        router.push({ pathname: "/(auth)/verify-email", params: { username: username.trim() } });
        return;

      case MobileAuthErrorCode.TOTP_REQUIRED:
        setNeedsTotp(true);
        return;

      case MobileAuthErrorCode.TOTP_INVALID:
        setNeedsTotp(true);
        setTotp("");
        setError("Kod hatalı. Uygulamandaki güncel kodu ya da bir kurtarma kodu gir.");
        return;
    }

    if (err.status === 429) {
      setError("Çok fazla deneme yaptın. Lütfen bir süre sonra tekrar dene.");
      return;
    }

    // Donanım banı: hesaptan bağımsız, cihaz düzeyinde reddedilir.
    if (err.status === 403) {
      setError(err.message || "Bu cihazdan giriş yapılamıyor.");
      return;
    }

    setError("Kullanıcı adı veya şifre hatalı.");
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
        editable={!needsTotp}
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
        editable={!needsTotp}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      {needsTotp ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>
            İKİ ADIMLI DOĞRULAMA KODU
          </Text>
          {/*
            Kutu kutu OTP kullanılmıyor: bu alan 6 haneli TOTP kodunun yanı
            sıra KURTARMA KODUNU da kabul etmek zorunda ve kurtarma kodu ne 6
            karakter ne de yalnızca rakam. Sabit uzunluklu bir kutu dizisi,
            telefonunu kaybetmiş kullanıcının tek çıkış yolunu kapatırdı.
          */}
          <TextInput
            value={totp}
            onChangeText={(value) => {
              setTotp(value);
              setError(null);
            }}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            textContentType="oneTimeCode"
            placeholder="000000"
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            accessibilityLabel="İki adımlı doğrulama kodu"
            style={{
              minHeight: 52,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.lg,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.deep,
              color: colors.bright,
              textAlign: "center",
              letterSpacing: 6,
              ...typography.display,
            }}
          />
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Uygulamandaki 6 haneli kodu gir. Telefonuna erişemiyorsan kurtarma
            kodlarından birini kullanabilirsin.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      {needsTotp ? null : (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(auth)/forgot-password",
              params: username.trim() ? { username: username.trim() } : undefined,
            })
          }
          hitSlop={8}
        >
          <Text style={{ ...typography.caption, color: colors.accent }}>Şifreni mi unuttun?</Text>
        </Pressable>
      )}

      <Button
        label={needsTotp ? "Doğrula ve Gir" : "Giriş Yap"}
        size="lg"
        fullWidth
        onPress={onSubmit}
        loading={busy}
        disabled={!canSubmit}
      />

      {needsTotp ? (
        <Pressable
          onPress={() => {
            setNeedsTotp(false);
            setTotp("");
            setError(null);
          }}
          style={{ paddingTop: spacing.xs }}
        >
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
            Bilgileri düzenle
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push("/(auth)/register")} style={{ paddingTop: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
            Hesabın yok mu? <Text style={{ color: colors.accent }}>Kaydol</Text>
          </Text>
        </Pressable>
      )}
    </AuthShell>
  );
}
