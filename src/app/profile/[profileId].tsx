import { useMemo, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  useAnnotation,
  useDirects,
  useFriends,
  useOpenDirect,
  useProfileCard,
  useSaveAnnotation,
} from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  Screen,
  ScreenLoader,
  showDialog,
  Tag,
} from "@/components/ui";
import { displayNameOf, formatDate } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useCallActions } from "@/realtime/use-call-events";
import { usePresence } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kullanıcı profili — web'deki üye kartının mobil karşılığı.
 *
 * Veri `GET /api/profile/[id]/card` ucundan gelir: bio, pronouns, banner
 * rengi, Mentol rozeti, arkadaşlık durumu ve ortak arkadaşlar tek istekte.
 * Uç gelmeden önce başlık alanları cache'ten (arkadaş/DM listeleri)
 * doldurulur ki ekran boş açılmasın.
 *
 * Kişisel kayıtlar (takma ad, not, yok say) yalnızca oturum sahibine ait ve
 * karşı taraf hiçbir yolla göremez — `/api/profile-annotations`.
 */
interface ProfileView {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  createdAt?: string | null;
  isBot?: boolean;
  isOfficial?: boolean;
  bio?: string | null;
  pronouns?: string | null;
  bannerColor?: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  PLUS: "MENTOL PLUS",
  PRO: "MENTOL PRO",
};

export default function ProfileScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { accepted } = useFriends();
  const { data: directs } = useDirects();
  const card = useProfileCard(profileId);
  const annotation = useAnnotation(profileId);
  const openDirect = useOpenDirect();
  const { placeCall } = useCallActions();
  const presence = usePresence(profileId);

  const cached = useMemo<ProfileView | undefined>(() => {
    const friend = accepted.find((f) => f.profile.id === profileId)?.profile;
    if (friend) return friend;
    for (const direct of directs ?? []) {
      if (direct.profileOne.id === profileId) return direct.profileOne;
      if (direct.profileTwo.id === profileId) return direct.profileTwo;
    }
    return undefined;
  }, [profileId, accepted, directs]);

  // Kart geldiyse zengin alanlar ondan; gelene kadar cache başlığı çizer.
  const profile: ProfileView | undefined = card.data
    ? { ...cached, ...card.data.profile }
    : cached;

  if (!profile) {
    if (card.isLoading) {
      return (
        <Screen>
          <Stack.Screen options={{ title: "" }} />
          <ScreenLoader />
        </Screen>
      );
    }
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <EmptyState
          icon="user"
          title="Profil bulunamadı"
          description={
            card.error instanceof ApiError && card.error.status === 404
              ? "Bu kullanıcı artık yok."
              : "Profil yüklenemedi."
          }
        />
      </Screen>
    );
  }

  const isOfficial = isOfficialProfile(profile) || card.data?.profile.isOfficial === true;
  const isSelf = card.data?.isSelf ?? false;
  const planLabel = card.data?.badge ? PLAN_LABELS[card.data.plan] : undefined;
  const mutuals = card.data?.mutualFriends ?? [];
  const mutualCount = card.data?.mutualFriendsCount ?? 0;

  const startCall = (kind: "audio" | "video") => {
    openDirect.mutate(profile.id, {
      onSuccess: (direct) => placeCall(profile, direct.id, kind),
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{ height: 110, backgroundColor: profile.bannerColor ?? colors.brand }}
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -44, gap: spacing.lg }}>
          {/* Zemin renginde halka: avatar banda binerken kenarı kaybolmasın. */}
          <View style={{ alignSelf: "flex-start", borderRadius: 50, borderWidth: 5, borderColor: colors.bg }}>
            <Avatar
              profileId={profile.id}
              imageUrl={profile.imageUrl}
              fallbackText={profile.username}
              size={80}
              showPresence={!isOfficial}
              backgroundColor={colors.bg}
            />
          </View>

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={{ ...typography.displayLg, color: colors.bright }}>
                {/* Takma ad her yerde olduğu gibi burada da gerçek adın önünde. */}
                {annotation?.nickname?.trim() || displayNameOf(profile)}
              </Text>
              {isOfficial ? (
                <Tag label="RESMÎ" tint={colors.onBrand} background={colors.brand} />
              ) : profile.isBot ? (
                <Tag label="UYG" tint={colors.onBrand} background={colors.brand} />
              ) : null}
              {planLabel ? (
                <Tag label={planLabel} tint={colors.brand} background={colors.brandSoft} />
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

          {!isSelf ? (
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
              {!isOfficial ? (
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
          ) : null}

          {profile.bio ? (
            <Card title="HAKKINDA">
              <Text style={{ ...typography.body, color: colors.text }}>{profile.bio}</Text>
            </Card>
          ) : null}

          {mutualCount > 0 ? (
            <Card title="ORTAK ARKADAŞLAR">
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={{ flexDirection: "row" }}>
                  {mutuals.map((friend, index) => (
                    <View
                      key={friend.id}
                      style={{
                        marginLeft: index === 0 ? 0 : -10,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: colors.panel,
                      }}
                    >
                      <Avatar
                        profileId={friend.id}
                        imageUrl={friend.imageUrl}
                        fallbackText={friend.username}
                        size={28}
                      />
                    </View>
                  ))}
                </View>
                <Text style={{ ...typography.body, color: colors.text }}>
                  {mutualCount} ortak arkadaş
                </Text>
              </View>
            </Card>
          ) : null}

          {profile.createdAt ? (
            <Card title="CİKLET ÜYESİ">
              <Text style={{ ...typography.body, color: colors.text }}>
                {formatDate(profile.createdAt)}
              </Text>
            </Card>
          ) : null}

          {!isOfficial && presence.activity?.name ? (
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

          {!isSelf && !isOfficial && !profile.isBot ? (
            <AnnotationCard profileId={profile.id} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Kişisel kayıtlar — takma ad, not, yok say.
 *
 * Alanlar odak kaybında kaydedilir (her tuşta PUT atmak hem gürültü hem
 * yarış); anahtar ise dokununca hemen. Uç birleşmiş son hâli döndürür ve
 * cache onunla güncellenir, böylece takma ad DM listesinde anında görünür.
 */
function AnnotationCard({ profileId }: { profileId: string }) {
  const annotation = useAnnotation(profileId);
  const save = useSaveAnnotation(profileId);

  // `colors` bir Proxy: modül düzeyinde sabite çekilirse değerler varsayılan
  // paletle donar ve etkin tema yok sayılır — bu yüzden render içinde kurulur.
  const fieldStyle = {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.deep,
    color: colors.bright,
    ...typography.body,
  } as const;

  // `null` = kullanıcı henüz dokunmadı → sunucu değeri gösterilir. Kayıtlar
  // ekrandan sonra yüklenebildiği için taslağı state'e kopyalamak yerine
  // görüntüleme anında birleştirilir (effect'e gerek kalmaz).
  const [nicknameDraft, setNicknameDraft] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const nickname = nicknameDraft ?? annotation?.nickname ?? "";
  const note = noteDraft ?? annotation?.note ?? "";

  const persist = (patch: Parameters<typeof save.mutate>[0]) =>
    save.mutate(patch, {
      onError: (reason) =>
        showDialog(
          "Kaydedilemedi",
          reason instanceof ApiError ? reason.message : "Kayıt kaydedilemedi."
        ),
    });

  return (
    <Card title="KİŞİSEL">
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>Takma ad</Text>
          <TextInput
            value={nickname}
            onChangeText={setNicknameDraft}
            onEndEditing={() => persist({ nickname: nickname.trim() || null })}
            placeholder="Yalnızca senin gördüğün ad"
            placeholderTextColor={colors.muted}
            maxLength={80}
            style={fieldStyle}
            accessibilityLabel="Takma ad"
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>Kişisel not</Text>
          <TextInput
            value={note}
            onChangeText={setNoteDraft}
            onEndEditing={() => persist({ note: note.trim() || null })}
            placeholder="Bu kişi hakkında not al"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={{ ...fieldStyle, minHeight: 72, textAlignVertical: "top" as const }}
            accessibilityLabel="Kişisel not"
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, color: colors.text }}>Yok say</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Bu kişiden gelen bildirim önerileri bastırılır.
            </Text>
          </View>
          <Switch
            value={annotation?.ignored ?? false}
            onValueChange={(next) => persist({ ignored: next })}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor={colors.onBrand}
            accessibilityLabel="Yok say"
          />
        </View>
      </View>
    </Card>
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
