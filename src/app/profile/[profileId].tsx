import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useDirects, useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, Button, EmptyState, Screen, Tag } from "@/components/ui";
import { displayNameOf, formatDate } from "@/lib/format";
import { useCallActions } from "@/realtime/use-call-events";
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
 *  - `/api/friends` tam `PublicProfile` döner (bio, pronouns, bannerColor…)
 *  - `/api/directs` yalnızca beş alanlık slim profil döner
 * Bu yüzden görünüm modeli zengin alanları OPSİYONEL tutar ve yoksa ilgili
 * kartı hiç çizmez.
 *
 * ⚠️ "Ortak sunucular" kartı YOK: ciklet-web'de bunu tek istekte veren bir
 * uç bulunmuyor. Hesaplamak için sunucu başına `GET /api/members?serverId=`
 * çağırmak (N+1) gerekirdi. Backend'e `GET /api/profiles/[id]/mutual` gibi
 * bir uç eklendiğinde geri gelecek — bkz. docs/ROADMAP.md.
 */
interface ProfileView {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  isBot?: boolean;
  isOfficial?: boolean;
  bio?: string | null;
  pronouns?: string | null;
  bannerColor?: string | null;
}

export default function ProfileScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { accepted } = useFriends();
  const { data: directs } = useDirects();
  const openDirect = useOpenDirect();
  const { placeCall } = useCallActions();
  const presence = usePresence(profileId);

  const profile = useMemo<ProfileView | undefined>(() => {
    // Zengin kaynak önce denenir; slim DM kaydı son çare.
    const friend = accepted.find((f) => f.profile.id === profileId)?.profile;
    if (friend) return friend;

    for (const direct of directs ?? []) {
      if (direct.profileOne.id === profileId) return direct.profileOne;
      if (direct.profileTwo.id === profileId) return direct.profileTwo;
    }

    return undefined;
  }, [profileId, accepted, directs]);

  if (!profile) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <EmptyState
          icon="user"
          title="Profil bulunamadı"
          description="Bu kullanıcıyla arkadaş değilsin ve bir sohbetin de yok."
        />
      </Screen>
    );
  }

  const startCall = (kind: "audio" | "video") => {
    openDirect.mutate(profile.id, {
      onSuccess: (direct) => placeCall(profile, direct.id, kind),
    });
  };

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
            showPresence={!profile.isOfficial}
            backgroundColor={colors.bg}
          />

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={{ ...typography.displayLg, color: colors.bright }}>
                {displayNameOf(profile)}
              </Text>
              {profile.isOfficial ? (
                <Tag label="RESMÎ" tint={colors.onBrand} background={colors.brand} />
              ) : profile.isBot ? (
                <Tag label="UYG" tint={colors.onBrand} background={colors.brand} />
              ) : null}
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
            {!profile.isOfficial ? (
              <>
                <Button
                  label="Sesli"
                  icon="phone"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => startCall("audio")}
                  disabled={openDirect.isPending}
                />
                <Button
                  label="Görüntülü"
                  icon="video"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => startCall("video")}
                  disabled={openDirect.isPending}
                />
              </>
            ) : null}
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

          {!profile.isOfficial && presence.activity?.name ? (
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
