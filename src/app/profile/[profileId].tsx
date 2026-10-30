import { useMemo, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";

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
  StyledName,
  Button,
  EmptyState,
  Icon,
  Pressable,
  Screen,
  ScreenLoader,
  SegmentedTabs,
  showDialog,
  Tag,
  type TabItem,
} from "@/components/ui";
import { ActivityReplySheet, type ActivityReplyTarget } from "@/features/presence/activity-reply-sheet";
import { isMobileActivity } from "@/features/presence/media-activity";
import { UserAppsCard } from "@/features/chat/user-apps";
import { FavoriteGameSheet } from "@/features/profile/favorite-game-sheet";
import { ProfileEffectOverlay } from "@/features/profile/profile-effect";
import {
  ActivityList,
  BadgeRow,
  Card,
  CollectionGrid,
  ConnectionList,
  FavoriteGameCard,
  PeopleList,
} from "@/features/profile/profile-sections";
import { ListenAlongBar, SpotifyCard } from "@/features/spotify/spotify-card";
import { activeCustomStatus } from "@/lib/custom-status";
import { broadcastPresentation } from "@/lib/activity-broadcast";
import { partySizeLabel, stateWithParty } from "@/lib/activity-party";
import { ActivityButtons } from "@/features/presence/activity-buttons";
import { StreamWatchButton } from "@/features/presence/stream-watch-button";
import { displayNameOf, formatActivity, formatDate } from "@/lib/format";
import { parseNameStyle } from "@/lib/name-style";
import { isOfficialProfile } from "@/lib/official";
import { ServerTagPill } from "@/features/server-tag/server-tag-pill";
import { useCallActions } from "@/realtime/use-call-events";
import { useAuth } from "@/stores/auth";
import { usePresence } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kullanıcı profili — web'deki üye kartının mobil karşılığı.
 *
 * Veri `GET /api/profile/[id]/card` ucundan gelir: bio, pronouns, banner
 * rengi, rozetler, arkadaşlık durumu, ortak arkadaş/sunucular, son
 * etkinlikler, oyun koleksiyonu ve bağlantılar tek istekte. Uç gelmeden
 * önce başlık alanları cache'ten (arkadaş/DM listeleri) doldurulur ki ekran
 * boş açılmasın.
 *
 * Sekmeler web ile aynı: Pano / Etkinlik / Ortak Arkadaşlar / Ortak
 * Sunucular (kendi profilinde ortak sekmeleri yok). Dar ekranda dört sekme
 * sığmadığı için çip şeridi yatay kayar — üst üste binme yok.
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
  /** Yüklenen afiş görseli; varsa renk yerine bu çizilir (web ile aynı). */
  bannerUrl?: string | null;
  avatarDecorationId?: string | null;
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  customStatusUntil?: string | null;
  profileEffectId?: string | null;
}

type CardTab = "pano" | "etkinlik" | "arkadaslar" | "sunucular";

const PLAN_LABELS: Record<string, string> = {
  PLUS: "MENTOL PLUS",
  PRO: "MENTOL PRO",
};

const BANNER_HEIGHT = 110;

export default function ProfileScreen() {
  // `chatId`: profil bir sohbetten açıldıysa — "Uygulamalar" (USER komutları) o sohbette çalışır.
  const { profileId, chatId } = useLocalSearchParams<{ profileId: string; chatId?: string }>();
  const { accepted } = useFriends();
  const { data: directs } = useDirects();
  const card = useProfileCard(profileId);
  const annotation = useAnnotation(profileId);
  const openDirect = useOpenDirect();
  const { placeCall } = useCallActions();
  const presence = usePresence(profileId);
  const [tab, setTab] = useState<CardTab>("pano");
  const [replyTarget, setReplyTarget] = useState<ActivityReplyTarget | null>(null);
  const myId = useAuth((s) => s.profile?.id);
  const [favoritePicker, setFavoritePicker] = useState(false);

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

  const data = card.data;
  const isOfficial = isOfficialProfile(profile) || data?.profile.isOfficial === true;
  const isSelf = data?.isSelf ?? false;
  // Eski sunucu rozet listesi göndermiyorsa yalnızca plan etiketi kalır.
  const badges = data?.badges;
  const planLabel = !badges && data?.badge ? PLAN_LABELS[data.plan] : undefined;
  const mutuals = data?.mutualFriends ?? [];
  const mutualCount = data?.mutualFriendsCount ?? 0;
  const mutualServers = data?.mutualServers ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const games = data?.collection?.games ?? [];
  const programs = data?.collection?.programs ?? [];
  const connections = data?.connections ?? [];
  const favoriteGame = data?.favoriteGame ?? null;
  const customStatus = activeCustomStatus(profile);
  const title = annotation?.nickname?.trim() || displayNameOf(profile);
  const friendship = data?.friendship;
  const friendsSince =
    friendship?.status === "ACCEPTED" && (friendship.acceptedAt || friendship.createdAt)
      ? formatDate((friendship.acceptedAt || friendship.createdAt)!)
      : null;
  // Kendi etkinliğine ya da bota yanıt verilmez (kart gelmeden de bilinsin).
  const canReplyToActivity = !isSelf && profile.id !== myId && profile.isBot !== true;
  const showSpotify = connections.some((c) => c.type === "spotify" && c.verified);

  const tabs: TabItem<CardTab>[] = [
    { id: "pano", label: "Pano" },
    { id: "etkinlik", label: "Etkinlik", count: recentActivity.length || undefined },
  ];
  if (!isSelf) {
    tabs.push({ id: "arkadaslar", label: "Ortak Arkadaşlar", count: mutualCount || undefined });
    tabs.push({ id: "sunucular", label: "Ortak Sunucular", count: mutualServers.length || undefined });
  }

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
          style={{ height: BANNER_HEIGHT, backgroundColor: profile.bannerColor ?? colors.brand }}
        >
          {profile.bannerUrl ? (
            <Image
              source={{ uri: profile.bannerUrl }}
              contentFit="cover"
              transition={150}
              style={{ width: "100%", height: "100%" }}
            />
          ) : null}
          <ProfileEffectOverlay id={profile.profileEffectId} height={BANNER_HEIGHT} />
        </View>

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
              decorationId={data ? (data.profile.avatarDecorationId ?? null) : undefined}
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              {/* Takma ad her yerde olduğu gibi burada da gerçek adın önünde;
                  takma ad gösteriliyorsa ad stili çizilmez (web ile aynı). */}
              <StyledName
                profileId={profile.id}
                name={title}
                style={data ? parseNameStyle(data.profile.nameStyle) : undefined}
                enabled={!annotation?.nickname?.trim()}
                animate
                textStyle={{ ...typography.displayLg, color: colors.bright, flexShrink: 1 }}
              />
              {/* Sunucu etiketi (web ServerTagPill): Discord "Server Tag". */}
              <ServerTagPill guild={data?.primaryGuild} />
              {!badges && isOfficial ? (
                <Tag label="RESMÎ" tint={colors.onBrand} background={colors.brand} />
              ) : !badges && profile.isBot ? (
                <Tag label="UYG" tint={colors.onBrand} background={colors.brand} />
              ) : null}
              {planLabel ? (
                <Tag label={planLabel} tint={colors.brand} background={colors.brandSoft} />
              ) : null}
            </View>
            <Text style={{ ...typography.body, color: colors.muted }}>
              @{profile.username}
              {profile.pronouns ? ` · ${profile.pronouns}` : ""}
            </Text>
            {customStatus ? (
              <Text style={{ ...typography.body, color: colors.text }} numberOfLines={2}>
                {customStatus.emoji ? `${customStatus.emoji} ` : ""}
                {customStatus.text ?? ""}
              </Text>
            ) : null}
            {badges && badges.length > 0 ? <BadgeRow badges={badges} /> : null}
          </View>

          {isSelf ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                label="Profili Düzenle"
                icon="pencil"
                variant="primary"
                style={{ flex: 1 }}
                onPress={() => router.push("/profile/edit")}
              />
              <Button
                label="Durum"
                icon="emoji"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => router.push("/profile/status")}
              />
            </View>
          ) : (
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
          )}

          <UserAppsCard chatId={chatId} targetId={profile.id} />

          {data ? (
            <View style={{ marginHorizontal: -spacing.lg }}>
              <SegmentedTabs items={tabs} value={tab} onChange={setTab} variant="pill" />
            </View>
          ) : null}

          {tab === "etkinlik" ? <ActivityList items={recentActivity} /> : null}

          {tab === "arkadaslar" ? (
            <PeopleList
              emptyText="Ortak arkadaşınız yok."
              items={mutuals.map((f) => ({
                id: f.id,
                title: f.name?.trim() || f.username,
                subtitle: `@${f.username}`,
                imageUrl: f.imageUrl,
                seed: f.username,
                href: `/profile/${f.id}`,
              }))}
            />
          ) : null}

          {tab === "sunucular" ? (
            <PeopleList
              emptyText="Ortak sunucunuz yok."
              items={mutualServers.map((s) => ({
                id: s.id,
                title: s.name,
                subtitle: null,
                imageUrl: s.imageUrl,
                seed: s.name,
                square: true,
                href: `/servers/${s.id}`,
              }))}
            />
          ) : null}

          {tab === "pano" ? (
            <>
              {!isSelf && mutualCount > 0 ? (
                <Card title="ORTAK ARKADAŞLAR">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View style={{ flexDirection: "row" }}>
                      {mutuals.slice(0, 6).map((friend, index) => (
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
                            decorationId={null}
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

              {profile.bio ? (
                <Card title="HAKKINDA">
                  <Text style={{ ...typography.body, color: colors.text }}>{profile.bio}</Text>
                </Card>
              ) : null}

              {profile.createdAt ? (
                <Card title="CİKLET ÜYESİ">
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                    {formatDate(profile.createdAt)}
                  </Text>
                </Card>
              ) : null}

              {friendsSince ? (
                <Card title="ŞU TARİHTEN BERİ ARKADAŞ">
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{friendsSince}</Text>
                </Card>
              ) : null}

              {!isOfficial && presence.activity?.name ? (
                // Başkasının etkinliğine dokununca yanıt/tepki sayfası.
                <Pressable
                  disabled={!canReplyToActivity}
                  onPress={() => presence.activity && setReplyTarget({ profile, activity: presence.activity })}
                  haptic="light"
                  noHitSlop
                  accessibilityRole={canReplyToActivity ? "button" : undefined}
                  accessibilityHint={canReplyToActivity ? "Etkinliğe yanıt ver" : undefined}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card title="ŞU AN">
                    {/* Yayında: "FC 27 yayını yapıyor" / "Yayında" — yayın
                        programının adı yazmaz (lib/activity-broadcast). */}
                    <Text style={{ ...typography.body, color: colors.text }}>
                      {broadcastPresentation(presence.activity) ? formatActivity(presence.activity) : presence.activity.name}
                    </Text>
                    {presence.activity.details ? (
                      <Text style={{ ...typography.caption, color: colors.muted }}>
                        {presence.activity.details}
                      </Text>
                    ) : null}
                    {/* Discord uyumlu grup: durum satırının sonunda "(2/4)" (lib/activity-party). */}
                    {partySizeLabel(presence.activity) ? (
                      <Text style={{ ...typography.caption, color: colors.muted }}>
                        {stateWithParty(presence.activity)}
                      </Text>
                    ) : null}
                    {isMobileActivity(presence.activity) ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Icon name="smartphone" size={12} color={colors.muted} />
                        <Text style={{ ...typography.caption, color: colors.muted }}>Telefondan</Text>
                      </View>
                    ) : null}
                    {/* Twitch/Kick yayını: kanalı tarayıcıda açar (adres yoksa çizilmez). */}
                    <StreamWatchButton activity={presence.activity} />
                    {/* Programın bağlantı düğmeleri: yalnızca başkasının etkinliğinde (Discord gibi). */}
                    {!isSelf && profile.id !== myId ? <ActivityButtons activity={presence.activity} /> : null}
                    {canReplyToActivity ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Icon name="reply" size={12} color={colors.brand} />
                        <Text style={{ ...typography.caption, color: colors.brand }}>Yanıt ver ya da tepki gönder</Text>
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              ) : null}

              {showSpotify ? <SpotifyCard profileId={profile.id} name={title} isSelf={isSelf} /> : null}

              {/* Favori oyun (web lib/favorite-game): koleksiyonun üstünde. Kendi
                  profilinde boşsa seçme kutusu, doluysa kalemle değiştirilir. */}
              {favoriteGame ? (
                <Card
                  title={isSelf ? "FAVORİ OYUNUN" : "FAVORİ OYUN"}
                  action={
                    isSelf ? (
                      <Pressable
                        onPress={() => setFavoritePicker(true)}
                        haptic="light"
                        accessibilityRole="button"
                        accessibilityLabel="Favori oyunu değiştir"
                      >
                        <Icon name="pencil" size={16} color={colors.muted} />
                      </Pressable>
                    ) : undefined
                  }
                >
                  <FavoriteGameCard game={favoriteGame} />
                </Card>
              ) : isSelf ? (
                <Pressable
                  onPress={() => setFavoritePicker(true)}
                  haptic="light"
                  noHitSlop
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    paddingVertical: spacing.lg,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.brand,
                    backgroundColor: pressed ? colors.brandSoft : "transparent",
                  })}
                >
                  <Text style={{ ...typography.bodyStrong, color: colors.brand }}>★ Favori oyun seç</Text>
                </Pressable>
              ) : null}

              {games.length > 0 ? (
                <Card title={isSelf ? "OYUNLARIN" : "SEVDİĞİ OYUNLAR"}>
                  <CollectionGrid items={games} />
                </Card>
              ) : null}

              {programs.length > 0 ? (
                <Card title={isSelf ? "PROGRAMLARIN" : "KULLANDIĞI PROGRAMLAR"}>
                  <CollectionGrid items={programs} />
                </Card>
              ) : null}

              {connections.length > 0 ? (
                <Card title="BAĞLANTILAR">
                  <ConnectionList connections={connections} />
                </Card>
              ) : null}

              {!isSelf && !isOfficial && !profile.isBot ? (
                <AnnotationCard profileId={profile.id} />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <ListenAlongBar />
      <ActivityReplySheet target={replyTarget} onClose={() => setReplyTarget(null)} />
      {isSelf ? <FavoriteGameSheet visible={favoritePicker} onClose={() => setFavoritePicker(false)} /> : null}
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
            <Text style={{ ...typography.body, color: colors.text }}>Yoksay</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Mesajları daraltılır, bildirim gelmez, etkinliği gizlenir. Ona haber verilmez.
            </Text>
          </View>
          <Switch
            value={annotation?.ignored ?? false}
            onValueChange={(next) => persist({ ignored: next })}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor={colors.onBrand}
            accessibilityLabel="Yoksay"
          />
        </View>
      </View>
    </Card>
  );
}
