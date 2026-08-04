import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useCurrentProfile, useFriends } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FLOATING_TAB_INSET } from "@/components/ui/tab-bar";

/**
 * "Sen" sekmesi — profil özeti ve hesap kısayolları.
 */
export default function MeScreen() {
  const sessionProfile = useAuth((s) => s.profile);
  const { data: profile } = useCurrentProfile();
  const { accepted } = useFriends();

  const me = profile ?? sessionProfile;

  return (
    <Screen edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: FLOATING_TAB_INSET, gap: spacing.lg }}>
        {/* Banner + avatar */}
        <View>
          <View
            style={{
              height: 96,
              borderRadius: radii.lg,
              backgroundColor: me?.bannerColor ?? colors.brand,
            }}
          />
          <View style={{ marginTop: -28, marginLeft: spacing.lg }}>
            <Avatar
              profileId={me?.id}
              imageUrl={me?.imageUrl}
              fallbackText={me?.username}
              size={72}
              showPresence
              backgroundColor={colors.bg}
            />
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.displayLg, color: colors.bright }}>
            {me?.name?.trim() || me?.username || "—"}
          </Text>
          <Text style={{ ...typography.body, color: colors.muted }}>
            {me?.username ? `@${me.username}` : ""}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ActionButton
            icon="pencil"
            label="Profili Düzenle"
            onPress={() => router.push("/profile/edit")}
          />
          <ActionButton
            icon="settings"
            label="Ayarlar"
            onPress={() => router.push("/settings")}
          />
        </View>

        <Card>
          <Text style={{ ...typography.overline, color: colors.muted }}>
            CİKLET ÜYESİ
          </Text>
          <Text style={{ ...typography.body, color: colors.text }}>
            {me?.createdAt
              ? new Date(me.createdAt).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </Text>
        </Card>

        <Pressable onPress={() => router.push("/friends")}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>
                Arkadaşların
              </Text>
              <Text style={{ ...typography.body, color: colors.muted }}>
                {accepted.length}
              </Text>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </View>
          </Card>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.xs,
      }}
    >
      {children}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radii.full,
        backgroundColor: colors.panel,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={18} color={colors.text} />
      <Text style={{ ...typography.bodyStrong, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
