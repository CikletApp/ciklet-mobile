import { Text, View } from "react-native";
import { router } from "expo-router";

import { Button, CikletLogo } from "@/components/ui";
import { AuthBackdrop } from "@/features/auth/auth-shell";
import { colors, spacing, typography } from "@/theme/tokens";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, justifyContent: "space-between", backgroundColor: colors.bentoShell }}
    >
      <AuthBackdrop />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing["2xl"] }}>
        <View style={{ marginBottom: spacing["2xl"] }}>
          <CikletLogo height={48} color={colors.bright} />
        </View>
        <Text style={{ ...typography.displayLg, color: colors.bright, textAlign: "center" }}>
          Ciklet’e hoş geldin
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
          Arkadaşlarınla konuş, topluluklarını kur ve aynı anda birlikte vakit geçir.
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.md }}>
        <Button
          label="Kaydol"
          size="lg"
          fullWidth
          variant="secondary"
          onPress={() => router.push("/(auth)/register")}
        />
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
