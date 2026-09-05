import { useLocalSearchParams } from "expo-router";

import { PasswordResetFlow } from "@/features/auth/password-reset-flow";

/**
 * "Şifremi unuttum" girişi. Akışın tamamı `PasswordResetFlow` içinde —
 * bu dosya yalnızca parametreyi okur ve başlığı verir (rota dosyaları ince
 * kalır, bkz. README).
 */
export default function ForgotPasswordScreen() {
  const { username } = useLocalSearchParams<{ username?: string }>();

  return (
    <PasswordResetFlow
      title="Şifreni sıfırla"
      subtitle="Kullanıcı adını ve hesabına bağlı e-postayı gir; sana tek kullanımlık bir doğrulama kodu gönderelim."
      initialUsername={username}
    />
  );
}
