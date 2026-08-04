import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useDirects, useFriends, useOpenDirect, useServers } from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  ListRow,
  Screen,
  Tag,
} from "@/components/ui";
import { displayNameOf, formatDate } from "@/lib/format";
import { usePresence } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kullanıcı profili.
 *
 * ciklet-web'de "başka bir kullanıcının profili" için ayrı bir uç yok;
 * profil verisi zaten elimizdeki listelerde gömülü geliyor. Bu yüzden ekran
 * veriyi cache'ten türetir ve gereksiz istek atmaz.
 *
 * ⚠️ Kaynaklar EŞİT ZENGİNLİKTE DEĞİL:
 *  - `/api/friends` ve `/api/servers` tam `PublicProfile` döner
 *    (bio, pronouns, bannerColor, createdAt...)
 *  - `/api/directs` yalnızca beş alanlık slim profil döner
 * Bu yüzden görünüm modeli zengin alanları OPSİYONEL tutar ve yoksa ilgili
 * kartı hiç çizmez. Aksi halde DM'den açılan profilde boş kartlar görünürdü.
 */
interface ProfileView {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  isBot?: boolean;
  bio?: string | null;
  pronouns?: string | null;
  bannerColor?: string | null;
}

export default function ProfileScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { accepted } = useFriends();
  const { data: directs } = useDirects();
  const { data: servers } = useServers();
  const openDirect = useOpenDirect();
  const presence = usePresence(profileId);

  const profile = useMemo<ProfileView | undefined>(() => {
    // Zengin kaynaklar önce denenir; slim DM kaydı son çare.
    const friend = accepted.find((f) => f.profile.id === profileId)?.profile;
    if (friend) return friend;

    for (const server of servers ?? []) {
      const member = server.members?.find((m) => m.profile.id === profileId);
      if (member) return member.profile;
    }

    for (const direct of directs ?? []) {
      if (direct.profileOne.id === profileId) return direct.profileOne;
      if (direct.profileTwo.id === profileId) return direct.profileTwo;
    }

    return undefined;
  }, [profileId, accepted, directs, servers]);

  const mutualServers = useMemo(
    () =>
      (servers ?? []).filter((server) =>
        server.members?.some((m) => m.profile.id === profileId)
      ),
    [servers, profileId]
  );

  if (!profile) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <EmptyState
          icon="user"
          title="Profil bulunamadı"
          description="Bu kullanıcıyla ortak bir sunucun veya sohbetin yok."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }}>
        <View
          style={{ height: 110, backgroundColor: profile.bannerColor ?? colors.brand }}
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -34, gap: spacing.lg }}>
          <Avatar
            profileId={profile.id}
            imageUrl={profile.imageUrl}
            fallbackText={profile.username}
            size={80}
            showPresence
            backgroundColor={colors.bg}
          />

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={{ ...typography.displayLg, color: colors.bright }}>
                {displayNameOf(profile)}
              </Text>
              {profile.isBot ? <Tag label="BOT" tint={colors.onBrand} background={colors.brand} /> : null}
            </View>
            <Text style={{ ...typography.body, color: colors.muted }}>
              @{profile.username}
            </Text>
            {profile.pronouns ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {profile.pronouns}
              </Text>
            ) : null}
          </View>

          {/* Sesli/görüntülü arama Faz 4'te LiveKit ile bağlanacak. */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              label="Mesaj"
              icon="message"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() =>
                openDirect.mutate(profile.id, {
                  onSuccess: (direct) => router.replace(`/chat/direct/${direct.id}`),
                })
              }
              loading={openDirect.isPending}
            />
            <Button label="Sesli" icon="phone" variant="secondary" disabled style={{ flex: 1 }} />
            <Button label="Görüntülü" icon="video" variant="secondary" disabled style={{ flex: 1 }} />
          </View>

          {profile.bio ? (
            <Card title="HAKKINDA">
              <Text style={{ ...typography.body, color: colors.text }}>{profile.bio}</Text>
            </Card>
          ) : null}

          {profile.createdAt ? (
            <Card title="CİKLET ÜYESİ">
              <Text style={{ ...typography.body, color: colors.text }}>
                {formatDate(profile.createdAt)}
              </Text>
            </Card>
          ) : null}

          {presence.activity?.name ? (
            <Card title="ŞU AN">
              <Text style={{ ...typography.body, color: colors.text }}>
                {presence.activity.name}
              </Text>
              {presence.activity.details ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {presence.activity.details}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {mutualServers.length > 0 ? (
            <Card title={`ORTAK SUNUCULAR — ${mutualServers.length}`} flush>
              {mutualServers.map((server) => (
                <ListRow
                  key={server.id}
                  title={server.name}
                  onPress={() => router.push(`/servers/${server.id}`)}
                  leading={
                    <Avatar
                      imageUrl={server.imageUrl}
                      fallbackText={server.name}
                      size={32}
                      shape="squircle"
                      backgroundColor={colors.panel}
                    />
                  }
                />
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Card({
  title,
  children,
  /** İçerik kendi yatay boşluğunu yönetiyorsa (liste satırları). */
  flush,
}: {
  title: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderRadius: radii.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: flush ? 0 : spacing.lg,
        gap: spacing.sm,
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          ...typography.overline,
          color: colors.muted,
          paddingHorizontal: flush ? spacing.lg : 0,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
