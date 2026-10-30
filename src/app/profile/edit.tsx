import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";

import { Image } from "expo-image";

import { STORE_TITLE } from "@/lib/purchases";
import { ApiError } from "@/api/client";
import { useCurrentProfile, useMyGames, useMyMemberships, useUpdateProfile } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { StyledName } from "@/components/ui/styled-name";
import { showDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Divider, ListGroup, ListRow } from "@/components/ui/list";
import { findDecoration } from "@/lib/avatar-decorations";
import { findNameEffect, findNameFont, parseNameStyle } from "@/lib/name-style";
import { findProfileEffect } from "@/lib/profile-effects";
import { activeCustomStatus, formatCustomStatus } from "@/lib/custom-status";
import { GAMES_VISIBILITY_OPTIONS } from "@/lib/profile-extras";
import { UserFacingUploadError, pickAndUploadProfileBanner, pickAndUploadProfileImage } from "@/lib/uploads";
import { FavoriteGameSheet } from "@/features/profile/favorite-game-sheet";
import { ServerTagPicker } from "@/features/server-tag/server-tag-picker";
import { ProfileEffectOverlay } from "@/features/profile/profile-effect";
import { favoriteCandidates, favoriteGameTagLabel } from "@/lib/favorite-game";
import { ScreenLoader } from "@/components/ui/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Profil düzenleme — iki sekme:
 *  - Kullanıcı Profili : `PATCH /api/current-profile`
 *  - Sunucu Profilleri : üyelik başına `PATCH /api/members/[memberId]`
 *
 * Kullanıcı profili alanları burada, sunucuya özel alanlar ise üyelik
 * satırından açılan ayrı ekranda düzenlenir.
 */
type Tab = "user" | "servers";

/**
 * Ekrana yalnızca bizim yazdığımız Türkçe iletiler çıkar (yükleme hatası ya
 * da sunucu yanıtı); kütüphane/yerel modül iletileri genel cümleye döner.
 */
function friendlyError(reason: unknown, fallback: string): string {
  if (reason instanceof UserFacingUploadError || reason instanceof ApiError) return reason.message;
  return fallback;
}

/** "Gotik · Gradyan" — profil öğeleri satırının özeti. */
function nameStyleSummary(raw: unknown): string {
  const style = parseNameStyle(raw);
  const parts = [findNameFont(style?.font)?.name, findNameEffect(style?.effect)?.name].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Yok";
}

export default function EditProfileScreen() {
  const [tab, setTab] = useState<Tab>("user");
  const { data: profile, isLoading } = useCurrentProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [favoritePicker, setFavoritePicker] = useState(false);
  const myGames = useMyGames();
  const favoriteGame = favoriteCandidates(myGames.data ?? []).find((g) => g.favorite) ?? null;

  // Sunucudan gelen değerlerle formu bir kez doldur. Kullanıcı yazmaya
  // başladıktan sonra gelen bir refetch yazdıklarını EZMEMELİ; bu yüzden
  // bağımlılık yalnızca profil kimliği.
  // Bu, dış API verisini yerel düzenleme taslağına bir kez aktaran bilinçli
  // bir senkronizasyon; profil kimliği değişmedikçe yeniden çalışmaz.
  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(profile.name ?? "");
    setPronouns(profile.pronouns ?? "");
    setBio(profile.bio ?? "");
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !profile) return <ScreenLoader label="Profil yükleniyor…" />;

  // `colors` Proxy'dir; modül düzeyinde sabitlense tema donar (bkz. hafıza:
  // mobile-colors-proxy-trap). Bu yüzden render içinde kurulur.
  const badgeStyle = {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.scrim,
  } as const;

  const dirty =
    name !== (profile.name ?? "") ||
    pronouns !== (profile.pronouns ?? "") ||
    bio !== (profile.bio ?? "");

  const onSave = () => {
    if (!dirty || updateProfile.isPending) return;
    updateProfile.mutate(
      {
        name: name.trim() || null,
        pronouns: pronouns.trim() || null,
        bio: bio.trim() || null,
      },
      { onSuccess: () => router.back() }
    );
  };

  /** Afiş görseli: dokun → seç → yükle → kaydet; kaldırma köşedeki çarpıdan. */
  const onChangeBanner = async () => {
    if (bannerBusy || updateProfile.isPending) return;
    setBannerBusy(true);
    setBannerError(null);
    try {
      const bannerUrl = await pickAndUploadProfileBanner();
      if (!bannerUrl) return;
      await updateProfile.mutateAsync({ bannerUrl });
    } catch (reason) {
      setBannerError(friendlyError(reason, "Afiş değiştirilemedi. Tekrar dene."));
    } finally {
      setBannerBusy(false);
    }
  };

  const onRemoveBanner = () => {
    showDialog("Afişi kaldır", "Profil afişin silinecek; renk degradesi görünecek.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: () => {
          updateProfile.mutate(
            { bannerUrl: null },
            {
              onError: () => setBannerError("Afiş kaldırılamadı."),
            }
          );
        },
      },
    ]);
  };

  const onChangeAvatar = async () => {
    if (avatarBusy || updateProfile.isPending) return;
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarProgress(0);
    try {
      const imageUrl = await pickAndUploadProfileImage(setAvatarProgress);
      if (!imageUrl) return;
      await updateProfile.mutateAsync({ imageUrl });
    } catch (reason) {
      setAvatarError(friendlyError(reason, "Avatar değiştirilemedi. Tekrar dene."));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.panel }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={onSave}
              disabled={!dirty || updateProfile.isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Kaydet"
            >
              {updateProfile.isPending ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text
                  style={{
                    ...typography.bodyStrong,
                    color: dirty ? colors.brand : colors.muted,
                  }}
                >
                  Kaydet
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <SegmentedTabs value={tab} onChange={setTab} />

      {tab === "user" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
          <View style={{ alignItems: "flex-start" }}>
            <Pressable
              onPress={onChangeBanner}
              disabled={bannerBusy}
              accessibilityRole="button"
              accessibilityLabel="Profil afişini değiştir"
              style={{
                height: 88,
                alignSelf: "stretch",
                borderRadius: radii.lg,
                backgroundColor: profile.bannerColor ?? colors.brand,
                overflow: "hidden",
              }}
            >
              {profile.bannerUrl ? (
                <Image
                  source={{ uri: profile.bannerUrl }}
                  contentFit="cover"
                  transition={150}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : null}
              {/* Önizleme: takılı profil efekti afişin üstünde (web ile aynı). */}
              <ProfileEffectOverlay id={profile.profileEffectId} height={88} />
              <View
                style={{
                  position: "absolute",
                  right: spacing.sm,
                  top: spacing.sm,
                  flexDirection: "row",
                  gap: spacing.xs,
                }}
              >
                {profile.bannerUrl && !bannerBusy ? (
                  <Pressable
                    onPress={onRemoveBanner}
                    accessibilityRole="button"
                    accessibilityLabel="Afişi kaldır"
                    hitSlop={6}
                    style={badgeStyle}
                  >
                    <Icon name="close" size={13} color={colors.onBrand} />
                  </Pressable>
                ) : null}
                <View style={badgeStyle}>
                  {bannerBusy ? (
                    <ActivityIndicator size="small" color={colors.onBrand} />
                  ) : (
                    <Icon name="pencil" size={13} color={colors.onBrand} />
                  )}
                </View>
              </View>
            </Pressable>
            <Pressable
              onPress={onChangeAvatar}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Avatarı değiştir"
              style={{ marginTop: -34, marginLeft: spacing.md, alignSelf: "flex-start", borderRadius: 44, borderWidth: 4, borderColor: colors.panel }}
            >
              <Avatar
                profileId={profile.id}
                imageUrl={profile.imageUrl}
                fallbackText={profile.username}
                size={68}
                backgroundColor={colors.panel}
              />
              <View
                style={{
                  position: "absolute",
                  right: -4,
                  bottom: -4,
                  width: 28,
                  height: 28,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: colors.panel,
                  backgroundColor: colors.brand,
                }}
              >
                {avatarBusy ? (
                  <ActivityIndicator size="small" color={colors.onBrand} />
                ) : (
                  <Icon name="pencil" size={14} color={colors.onBrand} />
                )}
              </View>
            </Pressable>
          </View>

          {avatarBusy ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Avatar yükleniyor… %{Math.round(avatarProgress)}
            </Text>
          ) : avatarError ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>{avatarError}</Text>
          ) : bannerError ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>{bannerError}</Text>
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <StyledName
              profileId={profile.id}
              name={profile.name?.trim() || profile.username}
              animate
              textStyle={{ ...typography.display, color: colors.bright }}
              containerStyle={{ alignSelf: "flex-start" }}
            />
            <Text style={{ ...typography.body, color: colors.muted }}>
              @{profile.username}
            </Text>
          </View>

          <Field
            label="GÖRÜNEN AD"
            value={name}
            onChangeText={setName}
            placeholder={profile.username}
            maxLength={50}
          />
          <Field
            label="HİTAPLAR"
            value={pronouns}
            onChangeText={setPronouns}
            placeholder="Hitap eklemek için dokun"
            maxLength={40}
          />
          <Field
            label="HAKKIMDA"
            value={bio}
            onChangeText={setBio}
            placeholder="Hakkımda yazısı eklemek için dokun"
            maxLength={190}
            multiline
          />

          {/* Profil öğeleri: her biri anında kaydedilir (üstteki Kaydet'ten bağımsız). */}
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>PROFİL ÖĞELERİ</Text>
            <ListGroup>
              <ListRow
                icon="emoji"
                title="Özel Durum"
                detail={(() => {
                  const status = activeCustomStatus(profile);
                  return status ? formatCustomStatus(status) : undefined;
                })()}
                onPress={() => router.push("/profile/status")}
              />
              <Divider inset={52} />
              <ListRow
                icon="sparkles"
                title="Avatar Süsü"
                detail={findDecoration(profile.avatarDecorationId)?.name ?? "Yok"}
                onPress={() => router.push("/profile/decoration")}
              />
              <Divider inset={52} />
              <ListRow
                icon="pencil"
                title="Ad Stili"
                detail={nameStyleSummary(profile.nameStyle)}
                onPress={() => router.push("/profile/name-style")}
              />
              <Divider inset={52} />
              <ListRow
                icon="palette"
                title="Profil Efekti"
                detail={findProfileEffect(profile.profileEffectId)?.name ?? "Yok"}
                onPress={() => router.push("/profile/effect")}
              />
              <Divider inset={52} />
              <ListRow icon="link" title="Bağlantılar" onPress={() => router.push("/profile/connections")} />
              <Divider inset={52} />
              <ListRow icon="heart" title={STORE_TITLE} subtitle="İsim plakası, profil efekti, süsler" onPress={() => router.push("/store")} />
            </ListGroup>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>OYUN KOLEKSİYONU</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Oynadığın oyunlar ve kullandığın programlar masaüstü uygulamasından kendiliğinden toplanır. Profilinde kimin göreceğini seç.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {GAMES_VISIBILITY_OPTIONS.map((option) => {
                const active = (profile.gamesVisibility ?? "EVERYONE") === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => !active && updateProfile.mutate({ gamesVisibility: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityHint={option.desc}
                    style={{
                      minHeight: 36,
                      justifyContent: "center",
                      paddingHorizontal: 14,
                      borderRadius: radii.full,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandSoft : colors.bg,
                    }}
                  >
                    <Text style={{ ...typography.caption, fontSize: 14, color: active ? colors.brand : colors.text }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Favori oyun (web lib/favorite-game): koleksiyondan tek oyun + etiket. */}
            <ListGroup>
              <ListRow
                icon="gamepad"
                title="Favori Oyun"
                subtitle={favoriteGame ? favoriteGameTagLabel(favoriteGame.favoriteTag) ?? undefined : undefined}
                detail={favoriteGame?.name ?? "Yok"}
                onPress={() => setFavoritePicker(true)}
              />
            </ListGroup>
          </View>
          <FavoriteGameSheet visible={favoritePicker} onClose={() => setFavoritePicker(false)} />

          {/* Sunucu etiketi (web lib/server-tag): anında kaydedilir. */}
          <ServerTagPicker />

          {updateProfile.isError ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {updateProfile.error instanceof ApiError
                ? updateProfile.error.message
                : "Profil kaydedilemedi."}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <ServerProfilesTab />
      )}
    </View>
  );
}

/** Sunucu profilleri listesi. */
function ServerProfilesTab() {
  const { data: memberships, isLoading } = useMyMemberships();

  if (isLoading) return <ScreenLoader />;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={{ ...typography.caption, color: colors.muted }}>
        Her sunucu için ayrı takma ad, hitap ve hakkımda yazısı
        tanımlayabilirsin.
      </Text>

      {(memberships ?? []).map((membership) => (
        <Pressable
          key={membership.id}
          onPress={() =>
            router.push({
              pathname: "/profile/server/[memberId]",
              params: { memberId: membership.id },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${membership.server.name} sunucu profili`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.raised : colors.bg,
          })}
        >
          <Avatar
            imageUrl={membership.server.imageUrl}
            fallbackText={membership.server.name}
            size={36}
            shape="squircle"
            backgroundColor={colors.bg}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
              {membership.server.name}
            </Text>
            {membership.nickname ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {membership.nickname}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SegmentedTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
}) {
  const items: { id: Tab; label: string }[] = [
    { id: "user", label: "Kullanıcı Profili" },
    { id: "servers", label: "Sunucu Profilleri" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: spacing.md,
              borderBottomWidth: 2,
              borderBottomColor: active ? colors.brand : "transparent",
            }}
          >
            <Text
              style={{
                ...typography.bodyStrong,
                color: active ? colors.bright : colors.muted,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  multiline,
  ...input
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength: number;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{label}</Text>
      <TextInput
        {...input}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          minHeight: multiline ? 96 : 48,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          color: colors.bright,
          textAlignVertical: multiline ? "top" : "center",
          ...typography.body,
        }}
        accessibilityLabel={label}
      />
    </View>
  );
}
