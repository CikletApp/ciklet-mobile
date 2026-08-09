import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { colors, typography } from "@/theme/tokens";

type Step = "identity" | "verify";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("identity");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async () => {
    if (!username.trim() || !/.+@.+\..+/.test(email) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot-password", { method: "POST", skipAuth: true, body: { username: username.trim(), email: email.trim() } });
      setStep("verify");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.length !== 8 || newPassword.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset-password", { method: "POST", skipAuth: true, body: { username: username.trim(), email: email.trim(), code, newPassword } });
      router.replace({ pathname: "/(auth)/login", params: { username } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre güncellenemedi.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={step === "identity" ? "Hesabını bul" : "Yeni şifre oluştur"} subtitle={step === "identity" ? "Kullanıcı adını ve hesabına bağlı e-postayı gir." : `${email} adresine gönderilen 8 karakterlik kodu gir.`} onBack={() => step === "verify" ? setStep("identity") : router.back()}>
      {step === "identity" ? (
        <>
          <AuthField label="KULLANICI ADI" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="kullaniciadi" />
          <AuthField label="E-POSTA" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="ornek@eposta.com" onSubmitEditing={requestCode} />
          {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
          <Button label="Kod Gönder" size="lg" fullWidth onPress={requestCode} loading={busy} disabled={!username.trim() || !/.+@.+\..+/.test(email) || busy} />
        </>
      ) : (
        <>
          <AuthField label="DOĞRULAMA KODU" value={code} onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, "").slice(0, 8))} autoCapitalize="characters" placeholder="ABCD2345" autoFocus />
          <AuthField label="YENİ ŞİFRE" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" placeholder="En az 6 karakter" onSubmitEditing={reset} />
          {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
          <Button label="Şifreyi Güncelle" size="lg" fullWidth onPress={reset} loading={busy} disabled={code.length !== 8 || newPassword.length < 6 || busy} />
          <Pressable onPress={requestCode} disabled={cooldown > 0 || busy}>
            <Text style={{ ...typography.caption, color: cooldown > 0 ? colors.muted : colors.accent, textAlign: "center" }}>
              {cooldown > 0 ? `Kodu yeniden gönder (${cooldown}s)` : "Kodu yeniden gönder"}
            </Text>
          </Pressable>
        </>
      )}
    </AuthShell>
  );
}
