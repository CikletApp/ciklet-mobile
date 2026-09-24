import { useRef, useState } from "react";
import { Text, TextInput } from "react-native";
import { router } from "expo-router";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { TURNSTILE_FIELD, useTurnstile } from "@/features/auth/turnstile-sheet";
import { colors, typography } from "@/theme/tokens";

interface RegisterResponse { ok: true; username: string; email: string }

export default function RegisterScreen() {
  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstile("signup");

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);
  const canSubmit = /.+@.+\..+/.test(email) && /^[a-zA-Z0-9_.]{2,32}$/.test(username) && password.length >= 6 && validDate && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // Jeton tek kullanımlık: her denemede yeniden alınır (4xx sonrası da).
      const captcha = await turnstile.request();
      if (!captcha) return;
      const result = await api<RegisterResponse>("/api/register", {
        method: "POST",
        skipAuth: true,
        body: {
          name: name.trim() || null,
          email: email.trim(),
          username: username.trim(),
          password,
          dateOfBirth,
          marketingConsent: false,
          ...(captcha.token ? { [TURNSTILE_FIELD]: captcha.token } : {}),
        },
      });
      router.replace({ pathname: "/(auth)/verify-email", params: { username: result.username, email: result.email } });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Hesap oluşturulamadı.";
      setError(
        message === "Username already exists" ? "Bu kullanıcı adı kullanılıyor."
          : message === "Email already in use" ? "Bu e-posta zaten kullanılıyor."
          : message === "Invalid email" ? "Geçerli bir e-posta gir."
          : /captcha/i.test(message) ? "Doğrulama tamamlanamadı. Tekrar dene."
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Hesabını oluştur" subtitle="Ciklet topluluklarına birkaç adım kaldı." onBack={() => router.back()}>
      <AuthField label="GÖRÜNEN AD" value={name} onChangeText={setName} placeholder="Seni nasıl tanısınlar?" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
      <AuthField ref={emailRef} label="E-POSTA" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" onSubmitEditing={() => usernameRef.current?.focus()} />
      <AuthField ref={usernameRef} label="KULLANICI ADI" value={username} onChangeText={setUsername} placeholder="kullaniciadi" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <AuthField ref={passwordRef} label="ŞİFRE" value={password} onChangeText={setPassword} placeholder="En az 6 karakter" secureTextEntry autoComplete="new-password" returnKeyType="next" onSubmitEditing={() => birthRef.current?.focus()} />
      <AuthField ref={birthRef} label="DOĞUM TARİHİ" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-AA-GG" keyboardType="numbers-and-punctuation" returnKeyType="done" onSubmitEditing={submit} error={dateOfBirth.length > 0 && !validDate ? "Tarihi YYYY-AA-GG biçiminde gir." : undefined} />
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
      <Button label="Hesap Oluştur" size="lg" fullWidth onPress={submit} loading={busy} disabled={!canSubmit} />
      {turnstile.element}
      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
        Devam ederek Kullanıcı Sözleşmesi’ni ve Gizlilik Bildirimi’ni kabul edersin.
      </Text>
    </AuthShell>
  );
}
