import { Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, CikletLogo, Icon } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ban ekranı — ciklet-web `app/banned/page.tsx`.
 *
 * Giriş ya da oturum yenileme `account_banned` / `device_banned` döndüğünde
 * açılır. Eskiden sunucu banlı hesaba "şifre hatalı" diyordu ve oturumu açık
 * olan kullanıcı neden atıldığını öğrenmeden giriş ekranına düşüyordu.
 *
 * Gösterilen bilgi web'le aynı ve bilinçli olarak sınırlı: gerekçe ve süre.
 */

const APPEAL_ADDRESS = "destek@ciklet.app";

export default function BannedScreen() {
  const ban = useAuth((s) => s.ban);
  const dismissBan = useAuth((s) => s.dismissBan);
  const isDevice = ban?.kind === "device";

  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bentoShell }}
      edges={["top", "bottom"]}
    >
      <View
        style={{
          gap: spacing.lg,
          padding: spacing.xl,
          borderRadius: radii.bentoWrapper,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.bento,
        }}
      >
        <CikletLogo height={22} color={colors.bright} />

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.displayLg, color: colors.bright }}>
            {isDevice ? "Bu cihaz engellendi" : "Hesabın askıya alındı"}
          </Text>
          <Text style={{ ...typography.body, color: colors.muted }}>
            {isDevice
              ? "Bu cihaz Ciklet'ten kalıcı olarak uzaklaştırıldı. Farklı bir hesapla giriş yapmak da engeli aşmaz."
              : "Ciklet hesabın, topluluk kurallarının ihlali nedeniyle askıya alındı. Bu süre boyunca platformu kullanamazsın."}
          </Text>
        </View>

        {!isDevice && ban ? (
          <View style={{ gap: spacing.md }}>
            {ban.reason ? (
              <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.deep }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>GEREKÇE</Text>
                <Text style={{ ...typography.body, color: colors.text }}>{ban.reason}</Text>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.lg,
                backgroundColor: colors.deep,
              }}
            >
              <Icon name="timer" size={16} color={colors.muted} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>SÜRE</Text>
                <Text style={{ ...typography.body, color: colors.text }}>
                  {ban.type === "TEMPORARY" && ban.expiresAt
                    ? `${formatDate(ban.expiresAt)} tarihinde otomatik olarak kalkacak.`
                    : "Süresiz — otomatik olarak kalkmaz."}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => void Linking.openURL(`mailto:${APPEAL_ADDRESS}`)}
          accessibilityRole="link"
          style={{ padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Bunun bir hata olduğunu düşünüyorsan{" "}
            <Text style={{ ...fw(600), color: colors.bright }}>{APPEAL_ADDRESS}</Text> adresine yazarak itiraz
            edebilirsin.
          </Text>
        </Pressable>

        <Button label="Giriş ekranına dön" variant="secondary" size="lg" fullWidth onPress={dismissBan} />
      </View>
    </SafeAreaView>
  );
}
