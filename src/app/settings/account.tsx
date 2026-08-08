import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useCurrentProfile } from "@/api/hooks";
import {
  Button,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  TextField,
} from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type TwoFactorStatus = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
  required: boolean;
};

type Enrollment = { secret: string; uri: string; qrDataUrl: string };

export default function AccountSettingsScreen() {
  const { data: profile } = useCurrentProfile();
  const queryClient = useQueryClient();
  const logout = useAuth((s) => s.logout);
  const authProfile = useAuth((s) => s.profile);

  const [username, setUsername] = useState(authProfile?.username ?? "");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const twoFactor = useQuery({
    queryKey: ["account-two-factor"],
    queryFn: () => api<TwoFactorStatus>(endpoints.accountTwoFactor),
  });
  const accountStatus = useQuery({
    queryKey: ["account-status"],
    queryFn: () => api<{ accountStatus: string; trustScore: number }>(endpoints.accountStatus),
  });

  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: qk.currentProfile });
  const showError = (error: unknown) =>
    Alert.alert("İşlem tamamlanamadı", error instanceof ApiError ? error.message : "Tekrar dene.");

  const changeUsername = useMutation({
    mutationFn: () => api(endpoints.accountUsername, { method: "POST", body: { username, password: usernamePassword } }),
    onSuccess: () => { setUsernamePassword(""); void refreshProfile(); Alert.alert("Tamam", "Kullanıcı adın güncellendi."); },
    onError: showError,
  });
  const startEmail = useMutation({
    mutationFn: () => api<{ pendingEmail: string }>(endpoints.accountEmail, { method: "POST", body: { email, password: emailPassword } }),
    onSuccess: (result) => { setPendingEmail(result.pendingEmail); setEmailPassword(""); },
    onError: showError,
  });
  const verifyEmail = useMutation({
    mutationFn: () => api(endpoints.accountEmail, { method: "PATCH", body: { code: emailCode } }),
    onSuccess: () => { setPendingEmail(null); setEmail(""); setEmailCode(""); void refreshProfile(); Alert.alert("Tamam", "E-posta adresin doğrulandı ve güncellendi."); },
    onError: showError,
  });
  const changePassword = useMutation({
    mutationFn: () => api(endpoints.changePassword, { method: "POST", body: { currentPassword, newPassword } }),
    onSuccess: () => { Alert.alert("Şifre güncellendi", "Güvenlik için tüm oturumların kapatıldı.", [{ text: "Giriş ekranına dön", onPress: () => void logout() }]); },
    onError: showError,
  });
  const startTwoFactor = useMutation({
    mutationFn: () => api<Enrollment>(endpoints.accountTwoFactor, { method: "POST" }),
    onSuccess: setEnrollment,
    onError: showError,
  });
  const enableTwoFactor = useMutation({
    mutationFn: () => api<{ recoveryCodes: string[] }>(endpoints.accountTwoFactor, { method: "PATCH", body: { code: totpCode } }),
    onSuccess: (result) => { setEnrollment(null); setTotpCode(""); setRecoveryCodes(result.recoveryCodes); void twoFactor.refetch(); },
    onError: showError,
  });
  const disableTwoFactor = useMutation({
    mutationFn: () => api(endpoints.accountTwoFactor, { method: "DELETE", body: { password: disablePassword } }),
    onSuccess: () => { setDisablePassword(""); void twoFactor.refetch(); Alert.alert("Tamam", "İki adımlı doğrulama kapatıldı."); },
    onError: showError,
  });

  const passwordsMatch = newPassword.length >= 6 && newPassword === newPasswordAgain;
  const statusLabel = ACCOUNT_STATUS_LABELS[accountStatus.data?.accountStatus ?? "GOOD"] ?? "İyi";

  return (
    <Screen>
      <Stack.Screen options={{ title: "Hesap" }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="HESAP DURUMU" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow icon="shield" title={statusLabel} subtitle={`Güven puanı: ${accountStatus.data?.trustScore ?? "—"}/100`} chevron={false} />
          </ListGroup>
        </View>

        <SectionHeader title="PROFİL" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow icon="user" title="Görünen ad ve profil" subtitle="Avatar, hitaplar ve biyografi" onPress={() => router.push("/profile/edit")} />
          </ListGroup>
        </View>

        <SectionHeader title="KULLANICI ADI" />
        <FormCard>
          <TextField label="KULLANICI ADI" prefix="@" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={32} />
          <TextField label="MEVCUT ŞİFRE" value={usernamePassword} onChangeText={setUsernamePassword} secureTextEntry autoCapitalize="none" />
          <Button label="Kullanıcı Adını Değiştir" onPress={() => changeUsername.mutate()} loading={changeUsername.isPending} disabled={!username.trim() || !usernamePassword} fullWidth />
        </FormCard>

        <SectionHeader title="E-POSTA" />
        <FormCard>
          <Text style={{ ...typography.caption, color: colors.muted }}>Mevcut: {profile?.email ?? "Tanımlı değil"}</Text>
          {pendingEmail ? (
            <>
              <Text style={{ ...typography.body, color: colors.text }}>{pendingEmail} adresine gelen 6 haneli kodu gir.</Text>
              <TextField label="DOĞRULAMA KODU" value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" maxLength={6} />
              <Button label="E-postayı Doğrula" onPress={() => verifyEmail.mutate()} loading={verifyEmail.isPending} disabled={emailCode.length !== 6} fullWidth />
            </>
          ) : (
            <>
              <TextField label="YENİ E-POSTA" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextField label="MEVCUT ŞİFRE" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry autoCapitalize="none" />
              <Button label="Doğrulama Kodu Gönder" onPress={() => startEmail.mutate()} loading={startEmail.isPending} disabled={!email.includes("@") || !emailPassword} fullWidth />
            </>
          )}
        </FormCard>

        <SectionHeader title="İKİ ADIMLI DOĞRULAMA" />
        <FormCard>
          {twoFactor.data?.enabled ? (
            <>
              <Text style={{ ...typography.bodyStrong, color: colors.success }}>Etkin</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>Kalan kurtarma kodu: {twoFactor.data.recoveryCodesLeft}</Text>
              {!twoFactor.data.required ? <TextField label="MEVCUT ŞİFRE" value={disablePassword} onChangeText={setDisablePassword} secureTextEntry /> : null}
              {!twoFactor.data.required ? <Button label="2FA'yı Kapat" variant="danger" onPress={() => disableTwoFactor.mutate()} loading={disableTwoFactor.isPending} disabled={!disablePassword} fullWidth /> : null}
            </>
          ) : enrollment ? (
            <>
              <Text style={{ ...typography.body, color: colors.text }}>Kimlik doğrulama uygulamanla QR kodunu tara veya anahtarı elle gir.</Text>
              <Image source={{ uri: enrollment.qrDataUrl }} style={{ width: 220, height: 220, alignSelf: "center", borderRadius: radii.md }} contentFit="contain" />
              <Text selectable style={{ ...typography.caption, color: colors.bright, textAlign: "center" }}>{enrollment.secret}</Text>
              <TextField label="6 HANELİ KOD" value={totpCode} onChangeText={setTotpCode} keyboardType="number-pad" maxLength={6} />
              <Button label="Doğrula ve Etkinleştir" onPress={() => enableTwoFactor.mutate()} loading={enableTwoFactor.isPending} disabled={totpCode.length !== 6} fullWidth />
            </>
          ) : (
            <Button label="2FA Kurulumunu Başlat" icon="shield" onPress={() => startTwoFactor.mutate()} loading={startTwoFactor.isPending} fullWidth />
          )}
          {recoveryCodes.length > 0 ? (
            <View style={{ padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.bg, gap: spacing.xs }}>
              <Text style={{ ...typography.bodyStrong, color: colors.warning }}>Kurtarma kodlarını şimdi güvenli bir yere kaydet.</Text>
              {recoveryCodes.map((code) => <Text key={code} selectable style={{ ...typography.body, color: colors.bright }}>{code}</Text>)}
            </View>
          ) : null}
        </FormCard>

        <SectionHeader title="ŞİFRE" />
        <FormCard>
          <TextField label="MEVCUT ŞİFRE" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <TextField label="YENİ ŞİFRE" value={newPassword} onChangeText={setNewPassword} secureTextEntry hint="6-200 karakter" />
          <TextField label="YENİ ŞİFRE (TEKRAR)" value={newPasswordAgain} onChangeText={setNewPasswordAgain} secureTextEntry error={newPasswordAgain && newPassword !== newPasswordAgain ? "Şifreler eşleşmiyor." : null} />
          <Button label="Şifreyi Değiştir" onPress={() => changePassword.mutate()} loading={changePassword.isPending} disabled={!currentPassword || !passwordsMatch} fullWidth />
        </FormCard>
      </ScrollView>
    </Screen>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return <View style={{ marginHorizontal: spacing.lg, padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border }}>{children}</View>;
}

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  GOOD: "Gayet iyi",
  LIMITED: "Kısıtlı",
  AT_RISK: "Risk altında",
  RESTRICTED: "Sınırlandırılmış",
  SUSPENDED: "Askıya alınmış",
};
