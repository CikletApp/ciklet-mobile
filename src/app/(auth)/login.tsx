import { useRef, useState } from "react";
import { Pressable, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { ApiError, banNoticeFrom } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { authBrand, colors, spacing, typography } from "@/theme/tokens";

/**
 * Giriş — ciklet-web `components/auth/login-form.tsx` ile aynı akış.
 *
 * Şifre DOĞRU olduğu hâlde sunucu durabilir; her durumda kullanıcı hata
 * metniyle baş başa bırakılmaz, eksik adım bu ekranda açılır:
 *  - `email_not_verified` → e-posta kodu adımı. Taze kod istenir (eldeki
 *    günler öncesine ait olabilir); doğrulanınca şifre yeniden sorulmadan
 *    giriş tamamlanır.
 *  - `totp_required` / `totp_invalid` → iki adımlı doğrulama kodu.
 *  - telefon doğrulaması → kısıtlı oturumla doğrulama ekranı (stores/auth).
 */

type Step = "credentials" | "email" | "totp";

/**
 * Giriş hatasını kullanıcıya gösterilecek metne çevirir. Sunucu makine
 * okunur kod ve İngilizce metin döndürüyor (bkz. ciklet-web
 * /api/mobile/auth); ham metin gösterilmez.
 */
function loginErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Giriş yapılamadı.";
  if (err.code === "phone_verification_required") {
    // Yalnızca kısıtlı oturum veremeyen (güncellenmemiş) sunucuda gelir.
    return "Hesabını kullanmaya başlamadan önce telefon numaranı doğrulaman gerekiyor. Bunu ciklet.xyz üzerinden yapabilirsin.";
  }
  if (err.isUnauthorized) return "Kullanıcı adı veya şifre hatalı.";
  if (err.status === 429) return "Çok fazla deneme yaptın. Lütfen bir süre sonra tekrar dene.";
  if (err.status >= 500) return "Sunucuda geçici bir sorun var. Biraz sonra tekrar dene.";
  if (err.isNetwork) return "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.";
  return err.message;
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ username?: string; verified?: string; reset?: string }>();
  const login = useAuth((s) => s.login);
  const showBan = useAuth((s) => s.showBan);
  const passwordRef = useRef<TextInput>(null);
  const [username, setUsername] = useState(params.username ?? "");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    params.verified === "1"
      ? "E-postan doğrulandı. Şifreni girerek giriş yapabilirsin."
      : params.reset === "1"
        ? "Şifren güncellendi. Şimdi giriş yapabilirsin."
        : null
  );
  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const attempt = async (code?: string) => {
    setBusy(true);
    setError(null);
    try {
      // Başarılıysa durum değişir ve rota koruması bir sonraki ekrana geçirir.
      await login(username.trim(), password, code);
    } catch (err) {
      const ban = banNoticeFrom(err);
      if (ban) {
        // Tek satırlık hata yerine ban ekranı: gerekçe, süre ve itiraz yolu
        // orada (web'deki /banned yönlendirmesiyle aynı).
        showBan(ban);
      } else if (err instanceof ApiError && err.code === "email_not_verified") {
        setStep("email");
      } else if (err instanceof ApiError && err.code === "totp_required") {
        setStep("totp");
      } else if (err instanceof ApiError && err.code === "totp_invalid") {
        setStep("totp");
        setTotp("");
        setError("Kod hatalı. Uygulamandaki güncel kodu ya da bir kurtarma kodu gir.");
      } else {
        setError(loginErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = () => {
    if (!canSubmit) return;
    if (step === "totp") {
      if (!totp.trim()) {
        setError("Doğrulama kodunu gir.");
        return;
      }
      void attempt(totp.trim());
      return;
    }
    void attempt();
  };

  const backToCredentials = () => {
    setStep("credentials");
    setTotp("");
    setError(null);
  };

  if (step === "email") {
    return (
      <AuthShell
        title="E-postanı doğrula"
        subtitle="Giriş yapabilmek için hesabına bağlı adrese gönderdiğimiz kodu gir."
        onBack={backToCredentials}
      >
        <VerifyEmailForm
          username={username.trim()}
          autoResend
          onVerified={() => {
            setStep("credentials");
            setNotice("E-postan doğrulandı.");
            // Şifre hâlâ elimizde: kullanıcıya yeniden yazdırmadan devam et.
            void attempt();
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={step === "totp" ? "İki adımlı doğrulama" : "Tekrar hoş geldin!"}
      subtitle={step === "totp" ? "Hesabını korumak için bir doğrulama kodu daha gerekiyor." : "Seni yeniden gördüğümüze sevindik."}
      onBack={step === "totp" ? backToCredentials : () => router.back()}
    >
      {notice && step === "credentials" ? (
        <Text style={{ ...typography.caption, color: authBrand.lime }}>{notice}</Text>
      ) : null}

      {step === "credentials" ? (
        <>
          <AuthField
            label="KULLANICI ADI"
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              setNotice(null);
            }}
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
          <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8} style={{ alignSelf: "flex-end" }}>
            <Text style={{ ...typography.caption, ...fw(600), color: authBrand.lime }}>Şifremi unuttum</Text>
          </Pressable>
        </>
      ) : (
        <>
          <AuthField
            label="İKİ ADIMLI DOĞRULAMA KODU"
            value={totp}
            onChangeText={(value) => {
              setTotp(value);
              setError(null);
            }}
            placeholder="000000"
            // Kurtarma kodları harf ve tire içerebilir; sayısal klavye yetmez.
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Uygulamandaki 6 haneli kodu gir. Telefonuna erişemiyorsan kurtarma kodlarından birini kullanabilirsin.
          </Text>
        </>
      )}

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <Button
        label={step === "totp" ? "Doğrula ve Gir" : "Giriş Yap"}
        variant="lime"
        size="lg"
        fullWidth
        onPress={onSubmit}
        loading={busy}
        disabled={!canSubmit}
      />

      {step === "credentials" ? (
        <Pressable onPress={() => router.push("/(auth)/register")} style={{ paddingTop: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
            Hesabın yok mu? <Text style={{ color: authBrand.lime, ...fw(600) }}>Kaydol</Text>
          </Text>
        </Pressable>
      ) : null}
    </AuthShell>
  );
}
