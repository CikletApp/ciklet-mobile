import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useCurrentProfile } from "@/api/hooks";
import {
  Avatar,
  Divider,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { CLIENT_VERSION } from "@/lib/device";
import { disconnectSocket } from "@/realtime/socket";
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

  const onLogout = () => {
    Alert.alert("Çıkış yap", "Oturumun bu cihazda kapatılacak.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: () => {
          disconnectSocket();
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
              accessibilityHint="Profilini düzenle"
            />
          </ListGroup>
        </View>

        <SectionHeader title="HESAP AYARLARI" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="user"
              title="Hesap"
              detail={profile?.email ?? undefined}
              onPress={() => router.push("/settings/account")}
            />
            <Divider inset={52} />
            <ListRow
              icon="bookmark"
              title="Mentol"
              onPress={() => router.push("/settings/mentol")}
            />
            <Divider inset={52} />
            <ListRow
              icon="shield"
              title="Gizlilik, Veri ve Sosyal"
              onPress={() => router.push("/settings/privacy")}
            />
            <Divider inset={52} />
            <ListRow
              icon="users"
              title="Arkadaşlık İstekleri"
              onPress={() => router.push("/friends")}
            />
            <Divider inset={52} />
            <ListRow
              icon="link"
              title="Yetkili Uygulamalar"
              onPress={() => router.push("/settings/authorized-apps")}
            />
          </ListGroup>
        </View>

        <SectionHeader title="UYGULAMA AYARLARI" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="volume"
              title="Ses ve Video"
              onPress={() => router.push("/settings/voice")}
            />
            <Divider inset={52} />
            <ListRow
              icon="compass"
              title="Görünüm"
              detail={THEME_LABELS[themeId]}
              onPress={() => router.push("/settings/appearance")}
            />
            <Divider inset={52} />
            <ListRow
              icon="message"
              title="Sohbet"
              onPress={() => router.push("/settings/chat")}
            />
            <Divider inset={52} />
            <ListRow
              icon="bell"
              title="Bildirimler"
              onPress={() => router.push("/settings/notifications")}
            />
          </ListGroup>
        </View>

        <SectionHeader title="OTURUM" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="logout"
              iconTint={colors.danger}
              titleColor={colors.danger}
              title="Çıkış Yap"
              onPress={onLogout}
              chevron={false}
            />
          </ListGroup>
        </View>

        <Text
          style={{
            ...typography.caption,
            color: colors.muted,
            textAlign: "center",
            paddingTop: spacing.xl,
          }}
        >
          Ciklet {CLIENT_VERSION}
        </Text>
      </ScrollView>
    </Screen>
  );
}
