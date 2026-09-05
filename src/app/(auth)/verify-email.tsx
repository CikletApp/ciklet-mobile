import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { NUMERIC_CODE_LENGTH } from "@ciklet/embedded-activities-sdk/types";

import { describeAuthError, isAlreadyVerified, resendVerification, verifyEmail } from "@/api/auth";
import { Button, Icon } from "@/components/ui";
import { AuthShell } from "@/features/auth/auth-shell";
import { OtpField } from "@/features/auth/otp-field";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kayıt sonrası e-posta doğrulama.
 *
 * Kullanıcı adı URL'den gelir. Oturum YOKTUR ve olamaz: doğrulanmamış hesap
 * giriş yapamıyor, bu yüzden kimlik kullanıcı adı + koddan gelir.
 *
 * Kod son kutuya girildiği an kendiliğinden gönderilir — altı hane yazıp bir
 * de düğmeye basmak gereksiz bir adım. Düğme yine de duruyor: otomatik
 * doldurma çalışmadığında ya da gönderim hata verdiğinde tek çıkış yolu o.
 */

const RESEND_COOLDOWN_SECS = 60;

export default function VerifyEmailScreen() {
  const { username = "", email = "" } = useLocalSearchParams<{
    username?: string;
    email?: string;
  }>();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Kod kayıt anında zaten gönderildi; sayaç oradan başlar.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== NUMERIC_CODE_LENGTH || busy) return;
      setBusy(true);
      setError(null);
      try {
        await verifyEmail(username, value);
        setDone(true);
        // Kısa bir onay anı, sonra girişe. Anında yönlendirmek kullanıcıya
        // işlemin başarılı olduğunu göstermezdi.
        setTimeout(
          () => router.replace({ pathname: "/(auth)/login", params: { username, verified: "1" } }),
          1200
        );
      } catch (err) {
        if (isAlreadyVerified(err)) {
          router.replace({ pathname: "/(auth)/login", params: { username } });
          return;
        }
        setInvalid(true);
        setCode("");
        setError(describeAuthError(err, "Kod doğrulanamadı."));
        setBusy(false);
      }
    },
    [busy, username]
  );

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resendVerification(username);
      setCooldown(RESEND_COOLDOWN_SECS);
      setCode("");
    } catch (err) {
      setError(describeAuthError(err, "Kod yeniden gönderilemedi. Biraz sonra dene."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="E-postan doğrulandı" subtitle="Giriş ekranına yönlendiriliyorsun…">
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
          <View
            style={{
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.full,
              backgroundColor: colors.bubbleOwn,
            }}
          >
            <Icon name="check" size={26} color={colors.brand} />
          </View>
          <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>
            Hesabın artık kullanıma hazır.
          </Text>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="E-postanı doğrula"
      subtitle="Hesabını kullanmaya başlamak için adresine gönderdiğimiz kodu gir."
      onBack={() => router.back()}
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
        <Icon name="bell" size={18} color={colors.accent} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
          {email ? (
            <>
              <Text style={{ color: colors.bright }}>{email}</Text> adresine 6 haneli bir kod
              gönderdik.
            </>
          ) : (
            "Hesabına bağlı e-posta adresine 6 haneli bir kod gönderdik."
          )}{" "}
          Kod 15 dakika geçerli.
        </Text>
      </View>

      <OtpField
        label="DOĞRULAMA KODU"
        value={code}
        onChange={(value) => {
          setCode(value);
          setInvalid(false);
          setError(null);
        }}
        onComplete={submit}
        length={NUMERIC_CODE_LENGTH}
        mode="numeric"
        disabled={busy}
        invalid={invalid}
        autoFocus
        error={error ?? undefined}
      />

      <Button
        label="Doğrula"
        size="lg"
        fullWidth
        onPress={() => submit(code)}
        loading={busy}
        disabled={code.length !== NUMERIC_CODE_LENGTH || busy}
      />

      <Pressable onPress={resend} disabled={cooldown > 0 || busy}>
        <Text
          style={{
            ...typography.caption,
            color: cooldown > 0 ? colors.muted : colors.accent,
            textAlign: "center",
          }}
        >
          {cooldown > 0 ? `Kodu yeniden gönder (${cooldown}s)` : "Kodu yeniden gönder"}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
