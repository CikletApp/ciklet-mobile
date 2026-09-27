import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";
import { OtpField } from "./otp-field";

/**
 * E-posta doğrulama kodu — ciklet-web `components/auth/verify-email-form.tsx`
 * karşılığı. İki yerde kullanılır:
 *
 *  • Kayıttan sonra (`app/(auth)/verify-email.tsx`): kod kayıt anında ZATEN
 *    gönderildi; açılışta yeniden istemek eskisini geçersiz kılar.
 *  • Girişte, sunucu `email_not_verified` dediğinde (`app/(auth)/login.tsx`):
 *    eldeki kod günler öncesine ait olabilir, açılışta yenisi istenir.
 *
 * Oturum YOK ve olamaz: doğrulanmamış hesap giriş yapamıyor. Kimlik
 * kullanıcı adı + koddan gelir (POST/PUT /api/auth/verify-email).
 */

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECS = 60;

export function VerifyEmailForm({
  username,
  email,
  autoResend = false,
  onVerified,
}: {
  username: string;
  /** Yalnızca göstermek için — "şu adrese gönderdik". */
  email?: string;
  /** Açılışta yeni kod iste (giriş denemesinden gelindiğinde). */
  autoResend?: boolean;
  /** Kod doğrulandı ya da hesap zaten doğrulanmıştı. */
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await api("/api/auth/verify-email", { method: "POST", skipAuth: true, body: { username, code: value } });
        onVerified();
      } catch (err) {
        // "Zaten doğrulanmış" bir hata değil; akış devam eder.
        if (err instanceof ApiError && err.status === 409) {
          onVerified();
          return;
        }
        setInvalid(true);
        setCode("");
        setError(
          err instanceof ApiError && !err.isNetwork && err.message
            ? err.message
            : "Kod doğrulanamadı. Bağlantını kontrol edip tekrar dene."
        );
        setSubmitting(false);
      }
    },
    [username, submitting, onVerified]
  );

  const resend = useCallback(async () => {
    setResending(true);
    setError(null);
    try {
      await api("/api/auth/verify-email", { method: "PUT", skipAuth: true, body: { username } });
      setCooldown(RESEND_COOLDOWN_SECS);
      setCode("");
      setInvalid(false);
    } catch {
      setError("Kod yeniden gönderilemedi. Biraz sonra dene.");
    } finally {
      setResending(false);
    }
  }, [username]);

  // BİR KEZ: iki istek gitseydi ikincisi ilkinin kodunu geçersiz kılardı.
  // Sunucu bekleme süresini kendisi uyguluyor; süre dolmadıysa sessizce
  // geçer, yani bu istek eldeki geçerli bir kodu asla bozmaz.
  const autoResendSent = useRef(false);
  useEffect(() => {
    if (!autoResend || autoResendSent.current) return;
    autoResendSent.current = true;
    void resend();
  }, [autoResend, resend]);

  return (
    <>
      <View
        style={{
          padding: spacing.md,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: authBrand.limeBorder,
          backgroundColor: authBrand.limeSoft,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.text }}>
          {email ? (
            <>
              <Text style={{ ...typography.caption, ...fw(600), color: colors.bright }}>{email}</Text> adresine 6 haneli bir kod
              gönderdik.
            </>
          ) : (
            "Hesabına bağlı e-posta adresine 6 haneli bir kod gönderdik."
          )}{" "}
          Kod 15 dakika geçerli.
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.overline, color: invalid ? colors.danger : colors.muted }}>DOĞRULAMA KODU</Text>
        <OtpField
          value={code}
          onChange={(value) => {
            setCode(value);
            setInvalid(false);
            setError(null);
          }}
          onComplete={submit}
          length={CODE_LENGTH}
          invalid={invalid}
          disabled={submitting}
          autoFocus
        />
      </View>

      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <Button
        label="Doğrula"
        variant="lime"
        size="lg"
        fullWidth
        onPress={() => void submit(code)}
        loading={submitting}
        disabled={code.length !== CODE_LENGTH}
      />

      <Pressable onPress={resend} disabled={cooldown > 0 || resending} hitSlop={8}>
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
          Kod gelmedi mi?{" "}
          <Text style={{ ...fw(600), color: cooldown > 0 || resending ? colors.muted : authBrand.lime }}>
            {cooldown > 0 ? `Yeniden gönder (${cooldown}s)` : "Yeniden gönder"}
          </Text>
        </Text>
      </Pressable>
    </>
  );
}
