import { useEffect } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { Avatar, Button, CikletLogo, Pressable } from "@/components/ui";
import { AuthBackdrop } from "@/features/auth/auth-shell";
import { cancelAddAccount } from "@/features/account-switcher/switcher";
import { accountDisplayName, useSwitcherAccounts } from "@/features/account-switcher/use-accounts";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const t = useT();
  const addingFrom = useAuth((s) => s.addingFrom);
  const loginHint = useAuth((s) => s.loginHint);
  // Bu cihazda kayıtlı hesaplar (hesap değiştirici): parolasız geçiş —
  // web giriş ekranındaki "Kayıtlı hesaplar" ile aynı.
  const { accounts, busy, onSwitch } = useSwitcherAccounts();
  const saved = (accounts ?? []).filter((a) => !a.current);

  // Oturumu düşmüş kayıtlı hesap: giriş, kullanıcı adı dolu açılır.
  useEffect(() => {
    if (!loginHint) return;
    useAuth.setState({ loginHint: null });
    router.push({ pathname: "/(auth)/login", params: { username: loginHint } });
  }, [loginHint]);

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, justifyContent: "space-between", backgroundColor: colors.bentoShell }}
    >
      <AuthBackdrop />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing["2xl"] }}>
        <View style={{ marginBottom: spacing["2xl"] }}>
          <CikletLogo height={48} color={colors.bright} />
        </View>
        <Text style={{ ...typography.displayLg, color: colors.bright, textAlign: "center" }}>
          {addingFrom ? t("accountSwitcher.addTitle") : "Ciklet’e hoş geldin"}
        </Text>
        <Text
          style={{
            ...typography.body,
            color: colors.muted,
            textAlign: "center",
            maxWidth: 330,
            marginTop: spacing.md,
          }}
        >
          {addingFrom ? t("accountSwitcher.addDescription") : "Arkadaşlarınla konuş, topluluklarını kur ve aynı anda birlikte vakit geçir."}
        </Text>

        {!addingFrom && saved.length > 0 ? (
          <View style={{ alignSelf: "stretch", marginTop: spacing["2xl"], gap: spacing.sm }}>
            <Text style={{ ...typography.caption, ...fw(700), color: colors.muted, letterSpacing: 0.6 }}>
              {t("accountSwitcher.savedTitle").toLocaleUpperCase("tr")}
            </Text>
            {saved.map((account) => (
              <Pressable
                key={account.id}
                disabled={busy !== null}
                onPress={() => void onSwitch(account)}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                <Avatar profileId={account.id} imageUrl={account.imageUrl} fallbackText={account.username} size={36} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ ...typography.body, ...fw(600), color: colors.bright }}>
                    {accountDisplayName(account)}
                  </Text>
                  <Text numberOfLines={1} style={{ ...typography.caption, color: account.needsLogin ? colors.danger : colors.muted }}>
                    {account.needsLogin ? t("accountSwitcher.needsLogin") : `@${account.username}`}
                  </Text>
                </View>
                {busy === account.id ? <ActivityIndicator color={colors.muted} /> : null}
              </Pressable>
            ))}
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", marginTop: spacing.xs }}>
              {t("accountSwitcher.orSignIn")}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md }}>
        {addingFrom ? (
          <Button
            label={t("accountSwitcher.addCancel")}
            size="lg"
            fullWidth
            variant="secondary"
            onPress={() => void cancelAddAccount()}
          />
        ) : (
          <Button
            label="Kaydol"
            size="lg"
            fullWidth
            variant="secondary"
            onPress={() => router.push("/(auth)/register")}
          />
        )}
        <Button
          label="Giriş Yap"
          variant="lime"
          size="lg"
          fullWidth
          onPress={() => router.push("/(auth)/login")}
        />
      </View>
    </SafeAreaView>
  );
}
