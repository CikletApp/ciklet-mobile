import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import type { PublicProfile } from "@ciklet/embedded-activities-sdk/types";

import { displayName, useDirects, useFriends, useOpenDirect, useServers } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState, Screen } from "@/components/ui/screen";
import { usePresence } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kullanıcı profili.
 *
 * ciklet-web'de "başka bir kullanıcının profili" için ayrı bir uç yok;
 * profil verisi zaten elimizdeki listelerde (arkadaşlar, DM'ler, sunucu
 * üyeleri) gömülü geliyor. Bu yüzden ekran veriyi cache'ten türetir —
 * gereksiz bir istek atmaz. Ortak sunucular da aynı verilerden hesaplanır.
 */
export default function ProfileScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { accepted } = useFriends();
  const { data: directs } = useDirects();
  const { data: servers } = useServers();
  const openDirect = useOpenDirect();
  const presence = usePresence(profileId);

  const profile = useMemo<PublicProfile | undefined>(() => {
    const fromFriends = accepted.find((f) => f.profile.id === profileId)?.profile;
    if (fromFriends) return fromFriends;

    for (const direct of directs ?? []) {
      if (direct.profileOne.id === profileId) return direct.profileOne;
      if (direct.profileTwo.id === profileId) return direct.profileTwo;
    }

    for (const server of servers ?? []) {
      const member = server.members?.find((m) => m.profile.id === profileId);
      if (member) return member.profile;
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
          style={{
            height: 110,
            backgroundColor: profile.bannerColor ?? colors.brand,
          }}
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
            <Text style={{ ...typography.displayLg, color: colors.bright }}>
              {displayName(profile)}
            </Text>
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
            <ProfileAction
              icon="message"
              label="Mesaj"
              onPress={() =>
                openDirect.mutate(profile.id, {
                  onSuccess: (direct) => router.replace(`/chat/direct/${direct.id}`),
                })
              }
            />
            <ProfileAction icon="phone" label="Sesli Arama" disabled />
            <ProfileAction icon="video" label="Görüntülü" disabled />
          </View>

          {profile.bio ? (
            <Card title="HAKKINDA">
              <Text style={{ ...typography.body, color: colors.text }}>
                {profile.bio}
              </Text>
            </Card>
          ) : null}

          <Card title="CİKLET ÜYESİ">
            <Text style={{ ...typography.body, color: colors.text }}>
              {new Date(profile.createdAt).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </Card>

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
            <Card title={`ORTAK SUNUCULAR — ${mutualServers.length}`}>
              {mutualServers.map((server) => (
                <Pressable
                  key={server.id}
                  onPress={() => router.push(`/servers/${server.id}`)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                  accessibilityRole="button"
                >
                  <Avatar
                    imageUrl={server.imageUrl}
                    fallbackText={server.name}
                    size={32}
                    shape="squircle"
                    backgroundColor={colors.panel}
                  />
                  <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>
                    {server.name}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
      {children}
    </View>
  );
}

function ProfileAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.panel,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={20} color={colors.text} />
      <Text style={{ ...typography.caption, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
