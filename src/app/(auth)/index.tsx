import { Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/ui";
import { AuthBackdrop, BrandMark } from "@/features/auth/auth-shell";
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
        <View
          style={{
            width: 112,
            height: 112,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 38,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            marginBottom: spacing["2xl"],
          }}
        >
          <BrandMark size={84} />
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
          size="lg"
          fullWidth
          onPress={() => router.push("/(auth)/login")}
        />
      </View>
    </SafeAreaView>
  );
}
