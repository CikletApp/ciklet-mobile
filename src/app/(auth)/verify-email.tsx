import { Pressable, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AuthShell } from "@/features/auth/auth-shell";
import { VerifyEmailForm } from "@/features/auth/verify-email-form";
import { fw } from "@/theme/fonts";
import { authBrand, colors, spacing, typography } from "@/theme/tokens";

/**
 * Kayıt sonrası kod ekranı — web `/verify-email`. Kod kayıt anında
 * gönderildiği için açılışta yeniden istenmez.
 *
 * Girişte doğrulanmamış hesaba rastlanınca bu ekrana GELİNMEZ; kod adımı
 * giriş ekranının içinde açılır ki doğrulamadan sonra şifre yeniden
 * sorulmadan giriş tamamlansın (bkz. login.tsx).
 */
export default function VerifyEmailScreen() {
  const { username = "", email = "" } = useLocalSearchParams<{ username?: string; email?: string }>();

  return (
    <AuthShell
      title="E-postanı doğrula"
      subtitle="Hesabını kullanmaya başlamak için adresine gönderdiğimiz kodu gir."
      onBack={() => router.back()}
    >
      <VerifyEmailForm
        username={username}
        email={email || undefined}
        onVerified={() => router.replace({ pathname: "/(auth)/login", params: { username, verified: "1" } })}
      />
      {/* Web'le aynı çıkış. Sunucu, bekleme süresini aşmış doğrulanmamış
          kaydı aynı kullanıcı adı ya da adresle yeni kayıtta siliyor
          (ciklet-web `reclaimStaleUnverified`); süre dolmadıysa farklı bir
          kullanıcı adı gerekir. */}
      <Pressable onPress={() => router.replace("/(auth)/register")} hitSlop={8} style={{ paddingTop: spacing.xs }}>
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
          Yanlış adres mi girdin? <Text style={{ color: authBrand.lime, ...fw(600) }}>Yeniden kaydol</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
