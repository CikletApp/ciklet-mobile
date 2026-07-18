import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/stores/auth";
import { colors } from "@/theme/colors";

export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      // Yönlendirme root layout'taki Stack.Protected guard'ıyla otomatik olur.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 items-center justify-center bg-main-bg px-8"
    >
      <Text className="mb-2 text-3xl font-bold text-brand">Ciklet</Text>
      <Text className="mb-8 text-text-muted">Hesabınla giriş yap</Text>

      <TextInput
        className="mb-3 w-full rounded-lg bg-surface px-4 py-3 text-text-primary"
        placeholder="Kullanıcı adı"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        className="mb-3 w-full rounded-lg bg-surface px-4 py-3 text-text-primary"
        placeholder="Şifre"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />

      {error ? <Text className="mb-3 text-danger">{error}</Text> : null}

      <TouchableOpacity
        className="w-full items-center rounded-lg bg-brand py-3"
        onPress={onSubmit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.mainBg} />
        ) : (
          <Text className="font-semibold text-main-bg">Giriş Yap</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
