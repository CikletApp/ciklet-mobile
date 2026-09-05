import { useLocalSearchParams } from "expo-router";

import { PasswordResetFlow } from "@/features/auth/password-reset-flow";

/**
 * `/reset-password` — web'de olduğu gibi AYNI iki adımlı akışı render eder
 * (`app/(auth)/(routes)/reset-password/page.tsx`).
 *
 * Neden ayrı bir rota: e-postadaki yönlendirme ve web'den paylaşılan
 * bağlantılar bu adı kullanıyor. Mobilde bu rota olmadan, uygulamayı açan
 * bir `ciklet://reset-password` derin bağlantısı hiçbir yere gitmiyordu.
 * Adım durumu tek bileşende yaşadığı için iki rota da aynı davranır.
 */
export default function ResetPasswordScreen() {
  const { username } = useLocalSearchParams<{ username?: string }>();

  return (
    <PasswordResetFlow
      title="Yeni şifre belirle"
      subtitle="Hesabını doğrulayalım: kullanıcı adın ve e-postanla sana bir kod gönderelim, ardından yeni şifreni belirle."
      initialUsername={username}
    />
  );
}
