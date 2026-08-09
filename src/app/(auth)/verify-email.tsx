import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui";
import { AuthField, AuthShell } from "@/features/auth/auth-shell";
import { colors, typography } from "@/theme/tokens";

export default function VerifyEmailScreen() {
  const { username = "", email = "" } = useLocalSearchParams<{ username?: string; email?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/verify-email", { method: "POST", skipAuth: true, body: { username, code } });
      router.replace({ pathname: "/(auth)/login", params: { username, verified: "1" } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await api("/api/auth/verify-email", { method: "PUT", skipAuth: true, body: { username } });
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="E-postanı doğrula" subtitle={`${email || "E-posta adresine"} gönderilen 6 haneli kodu gir.`} onBack={() => router.back()}>
      <AuthField label="DOĞRULAMA KODU" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" keyboardType="number-pad" autoFocus returnKeyType="done" onSubmitEditing={submit} error={error ?? undefined} />
      <Button label="Doğrula" size="lg" fullWidth onPress={submit} loading={busy} disabled={code.length !== 6 || busy} />
      <Pressable onPress={resend} disabled={cooldown > 0 || busy}>
        <Text style={{ ...typography.caption, color: cooldown > 0 ? colors.muted : colors.accent, textAlign: "center" }}>
          {cooldown > 0 ? `Yeniden gönder (${cooldown}s)` : "Kodu yeniden gönder"}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
