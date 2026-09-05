import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ALPHANUMERIC_CODE_LENGTH } from "@ciklet/embedded-activities-sdk/types";

import { describeAuthError, requestPasswordReset, resetPassword } from "@/api/auth";
import { Button, Icon } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { OtpField } from "@/features/auth/otp-field";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Şifre sıfırlama — iki adım, TEK ekran.
 *
 * Web'de de böyle (`components/auth/forgot-password-form.tsx`): adım durumu
 * tek bir bileşende yaşar, `/forgot-password` ve `/reset-password` rotaları
 * aynı akışı render eder. Adımları ayrı rotalara bölmek, kod gönderildikten
 * sonra geri tuşuna basan kullanıcıyı "kod gönderildi ama şifre
 * belirlenmedi" arasında bırakırdı.
 *
 * Kod istemcide tutulur ve yeni şifreyle TEK istekte gider: sunucuda kodun
 * harcandığı ama şifrenin değişmediği bir ara durum hiç oluşmaz.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECS = 60;

type Step = "identity" | "verify";

interface PasswordResetFlowProps {
  title: string;
  subtitle: string;
  /** `/login` ekranından gelindiğinde kullanıcı adını hazır doldurur. */
  initialUsername?: string;
}

export function PasswordResetFlow({
  title,
  subtitle,
  initialUsername,
}: PasswordResetFlowProps) {
  const emailRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>("identity");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const identityValid = username.trim().length > 0 && EMAIL_RE.test(email.trim());

  const requestCode = async (isResend = false) => {
    if (!identityValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset({ username, email });
      setCooldown(RESEND_SECS);
      setStep("verify");
      if (isResend) setError(null);
    } catch (err) {
      setError(describeAuthError(err, "Kod gönderilemedi."));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (code.length !== ALPHANUMERIC_CODE_LENGTH) {
      setCodeInvalid(true);
      setError(`Lütfen ${ALPHANUMERIC_CODE_LENGTH} karakterlik kodu gir.`);
      return;
    }
    if (newPassword.length < 6 || busy) return;

    setBusy(true);
    setError(null);
    try {
      await resetPassword({ username, email, code, newPassword });
      // Sıfırlama hesabın TÜM oturumlarını düşürür; tek doğru varış girişdir.
      router.replace({ pathname: "/(auth)/login", params: { username: username.trim() } });
    } catch (err) {
      setCodeInvalid(true);
      setCode("");
      setError(describeAuthError(err, "Şifre güncellenemedi."));
    } finally {
      setBusy(false);
    }
  };

  if (step === "identity") {
    return (
      <AuthShell title={title} subtitle={subtitle} onBack={() => router.back()}>
        <AuthField
          label="KULLANICI ADI"
          value={username}
          onChangeText={setUsername}
          placeholder="kullaniciadi"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <AuthField
          ref={emailRef}
          label="E-POSTA"
          value={email}
          onChangeText={setEmail}
          placeholder="ornek@eposta.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="go"
          onSubmitEditing={() => requestCode()}
        />

        {error ? (
          <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
        ) : null}

        <Button
          label="Doğrulama kodu gönder"
          size="lg"
          fullWidth
          onPress={() => requestCode()}
          loading={busy}
          disabled={!identityValid || busy}
        />

        <Pressable onPress={() => router.replace("/(auth)/login")} style={{ paddingTop: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
            Şifreni hatırladın mı? <Text style={{ color: colors.accent }}>Giriş Yap</Text>
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Yeni şifre belirle"
      subtitle={`${email.trim()} adresine gönderdiğimiz kodu gir ve yeni şifreni oluştur.`}
      onBack={() => {
        setStep("identity");
        setCode("");
        setError(null);
        setCodeInvalid(false);
      }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.accent,
          backgroundColor: colors.deep,
        }}
      >
        <Icon name="shield" size={18} color={colors.accent} />
        {/*
          "Bilgiler doğruysa" ifadesi bilinçli: sunucu hesabın var olup
          olmadığını SÖYLEMİYOR (kullanıcı adı taramasını engellemek için her
          durumda aynı yanıtı veriyor). Arayüzün "kod gönderildi" demesi bu
          gizlemeyi bozardı.
        */}
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
          Bilgiler doğruysa <Text style={{ color: colors.bright }}>{email.trim()}</Text> adresine{" "}
          {ALPHANUMERIC_CODE_LENGTH} karakterlik bir kod gönderdik. Büyük/küçük harf farkı
          gözetilmez, kod 10 dakika geçerli.
        </Text>
      </View>

      <OtpField
        label="DOĞRULAMA KODU"
        value={code}
        onChange={(value) => {
          setCode(value);
          setCodeInvalid(false);
          setError(null);
        }}
        length={ALPHANUMERIC_CODE_LENGTH}
        mode="alphanumeric"
        disabled={busy}
        invalid={codeInvalid}
        autoFocus
      />

      <AuthField
        label="YENİ ŞİFRE"
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="En az 6 karakter"
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submitReset}
        error={
          newPassword.length > 0 && newPassword.length < 6
            ? "Şifre en az 6 karakter olmalı."
            : undefined
        }
      />

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <Button
        label="Şifreyi güncelle"
        size="lg"
        fullWidth
        onPress={submitReset}
        loading={busy}
        disabled={code.length !== ALPHANUMERIC_CODE_LENGTH || newPassword.length < 6 || busy}
      />

      <Pressable onPress={() => requestCode(true)} disabled={cooldown > 0 || busy}>
        <Text
          style={{
            ...typography.caption,
            color: cooldown > 0 ? colors.muted : colors.accent,
            textAlign: "center",
          }}
        >
          {cooldown > 0 ? `Kodu tekrar gönder (${cooldown}s)` : "Kodu tekrar gönder"}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
