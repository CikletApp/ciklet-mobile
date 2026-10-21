import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { STORE_TITLE } from "@/lib/purchases";
import { useCurrentProfile } from "@/api/hooks";
import {
  Avatar,
  Divider,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  showDialog,
} from "@/components/ui";
import { mediaPresenceSupported } from "@/features/presence/media-presence";
import { displayNameOf, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { stopGateway } from "@/realtime/gateway";
import { useAuth } from "@/stores/auth";
import { THEME_LABELS, useTheme } from "@/stores/theme";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Ayarlar.
 *
 * Hazır olmayan satırlar devre dışı gösterilir — tıklanıp boş ekrana
 * düşmek, kapalı olduğunu görmekten daha kötü bir deneyim.
 */
export default function SettingsScreen() {
  const { data: profile } = useCurrentProfile();
  const logout = useAuth((s) => s.logout);
  const themeId = useTheme((s) => s.themeId);
  const t = useT();

  const onLogout = () => {
    showDialog(t("settings.logout.title"), t("settings.logout.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout.action"),
        style: "destructive",
        onPress: () => {
          stopGateway();
          void logout();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ListGroup>
            <ListRow
              title={profile ? displayNameOf(profile) : "—"}
              subtitle={profile ? `@${profile.username}` : undefined}
              leading={
                <Avatar
                  profileId={profile?.id}
                  imageUrl={profile?.imageUrl}
                  fallbackText={profile?.username}
                  size={44}
                  showPresence
                  backgroundColor={colors.panel}
                />
              }
              onPress={() => router.push("/profile/edit")}
              accessibilityHint={t("settings.editProfile")}
            />
          </ListGroup>
        </View>

        <SectionHeader title={t("settings.sections.account")} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="user"
              title={t("settings.rows.account")}
              detail={profile?.email ?? undefined}
              onPress={() => router.push("/settings/account")}
            />
            <Divider inset={52} />
            <ListRow
              icon="sparkles"
              title={t("settings.rows.mentol")}
              onPress={() => router.push("/settings/mentol")}
            />
            <Divider inset={52} />
            <ListRow
              icon="heart"
              title={STORE_TITLE}
              onPress={() => router.push("/store")}
            />
            <Divider inset={52} />
            <ListRow
              icon="shield"
              title={t("settings.rows.privacy")}
              onPress={() => router.push("/settings/privacy")}
            />
            <Divider inset={52} />
            <ListRow
              icon="users"
              title={t("settings.rows.friendRequests")}
              onPress={() => router.push("/friends")}
            />
            <Divider inset={52} />
            <ListRow
              icon="link"
              title={t("settings.rows.authorizedApps")}
              onPress={() => router.push("/settings/authorized-apps")}
            />
          </ListGroup>
        </View>

        <SectionHeader title={t("settings.sections.app")} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="volume"
              title={t("settings.rows.voice")}
              onPress={() => router.push("/settings/voice")}
            />
            <Divider inset={52} />
            <ListRow
              icon="palette"
              title={t("settings.rows.appearance")}
              detail={THEME_LABELS[themeId]}
              onPress={() => router.push("/settings/appearance")}
            />
            <Divider inset={52} />
            <ListRow
              icon="message"
              title={t("settings.rows.chat")}
              onPress={() => router.push("/settings/chat")}
            />
            <Divider inset={52} />
            <ListRow
              icon="bell"
              title={t("settings.rows.notifications")}
              onPress={() => router.push("/settings/notifications")}
            />
            {mediaPresenceSupported ? (
              <>
                <Divider inset={52} />
                <ListRow
                  icon="headphones"
                  title={t("settings.rows.activity")}
                  onPress={() => router.push("/settings/activity")}
                />
              </>
            ) : null}
          </ListGroup>
        </View>

        <SectionHeader title={t("settings.sections.support")} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="help"
              title={t("settings.rows.help")}
              subtitle={t("settings.rows.helpSubtitle")}
              onPress={() => router.push("/settings/help")}
            />
          </ListGroup>
        </View>

        <SectionHeader title={t("settings.sections.session")} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="logout"
              iconTint={colors.danger}
              titleColor={colors.danger}
              title={t("settings.logout.action")}
              onPress={onLogout}
              chevron={false}
            />
          </ListGroup>
        </View>

        {/* Sürüm artık Yardım sayfasının başlığında; burada üyelik tarihi
            ("Sen" sekmesindekiyle aynı ifade). */}
        {profile?.createdAt ? (
          <Text
            style={{
              ...typography.caption,
              color: colors.muted,
              textAlign: "center",
              paddingTop: spacing.xl,
            }}
          >
            {t("settings.memberSince", { date: formatDate(profile.createdAt) })}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
