import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { api, ApiError } from "@/api/client";
import { Button, Icon } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { BirthDateField, EMPTY_BIRTH_DATE, resolveBirthDate } from "@/features/auth/birth-date-field";
import { TURNSTILE_FIELD, useTurnstile } from "@/features/auth/turnstile-sheet";
import { API_BASE_URL } from "@/lib/config";
import { fw } from "@/theme/fonts";
import { authBrand, colors, typography } from "@/theme/tokens";

interface RegisterResponse { ok: true; username: string; email: string }

/**
 * Web `lib/username` → `sanitizeUsernameInput`: boşluk ve Türkçe karakter
 * yazılamaz. Hata göstermek yerine karakter hiç kabul edilmiyor; eskiden
 * "kullanıcı adı" düğmeyi sessizce kapalı tutuyordu ve nedeni görünmüyordu.
 */
function sanitizeUsername(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 32);
}

/** Yerel takvim günü "YYYY-AA-GG": sunucu UTC'de çalışır, saat kayması olmasın. */
function plainDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function openLegal(path: string) {
  void WebBrowser.openBrowserAsync(`${API_BASE_URL}${path}`, { toolbarColor: colors.bg, showTitle: true }).catch(() => {});
}

export default function RegisterScreen() {
  const emailRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [birth, setBirth] = useState(EMPTY_BIRTH_DATE);
  // KVKK: sözleşme + aydınlatma metni ZORUNLU, pazarlama açık rızası İSTEĞE
  // BAĞLI ve ayrı kutucuk (sunucu /api/register ikisini de denetler).
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const turnstile = useTurnstile("signup");

  const birthDate = resolveBirthDate(birth);
  const canSubmit = /.+@.+\..+/.test(email) && /^[a-zA-Z0-9_.]{2,32}$/.test(username) && password.length >= 6 && birthDate.date !== null && legalAccepted && !busy;

  const submit = async () => {
    if (!canSubmit || !birthDate.date) return;
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
          dateOfBirth: plainDate(birthDate.date),
          consents: { terms: true, kvkkNotice: true, marketing },
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
          : message === "Invalid date of birth" ? "Lütfen geçerli bir doğum tarihi gir."
          : /at least \d+ years old/.test(message) ? "Ciklet'e kaydolmak için en az 13 yaşında olmalısın."
          : message === "Legal consent required" ? "Devam etmek için sözleşmeyi ve aydınlatma metnini onayla."
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
      <AuthField ref={usernameRef} label="KULLANICI ADI" value={username} onChangeText={(value) => setUsername(sanitizeUsername(value))} placeholder="kullaniciadi" autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
      <AuthField ref={passwordRef} label="ŞİFRE" value={password} onChangeText={setPassword} placeholder="En az 6 karakter" secureTextEntry autoComplete="new-password" returnKeyType="done" onSubmitEditing={submit} />
      <BirthDateField value={birth} onChange={setBirth} error={birthDate.error} />
      <ConsentRow checked={legalAccepted} onToggle={() => setLegalAccepted((v) => !v)}>
        <Text style={{ color: authBrand.lime, ...fw(600) }} onPress={() => openLegal("/terms")}>Kullanıcı Sözleşmesi</Text>
        {"'ni ve "}
        <Text style={{ color: authBrand.lime, ...fw(600) }} onPress={() => openLegal("/yasal/kvkk-aydinlatma-metni")}>KVKK Aydınlatma Metni</Text>
        {"'ni okudum, kabul ediyorum."}
      </ConsentRow>
      <ConsentRow checked={marketing} onToggle={() => setMarketing((v) => !v)}>
        {"Kampanya ve duyurular için "}
        <Text style={{ color: authBrand.lime, ...fw(600) }} onPress={() => openLegal("/yasal/acik-riza-metni")}>açık rıza</Text>
        {" veriyorum (isteğe bağlı)."}
      </ConsentRow>
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
      <Button label="Hesap Oluştur" variant="lime" size="lg" fullWidth onPress={submit} loading={busy} disabled={!canSubmit} />
      {turnstile.element}
      <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
          Zaten üye misin? <Text style={{ color: authBrand.lime, ...fw(600) }}>Giriş Yap</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}

function ConsentRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? authBrand.lime : colors.muted,
          backgroundColor: checked ? authBrand.lime : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Icon name="check" size={14} color={colors.bg} /> : null}
      </View>
      <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>{children}</Text>
    </Pressable>
  );
}
