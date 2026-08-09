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

import { ApiError } from "@/api/client";
import { useCurrentProfile, useMyMemberships, useUpdateProfile } from "@/api/hooks";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { pickAndUploadProfileImage } from "@/lib/uploads";
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
      setAvatarError(reason instanceof Error ? reason.message : "Avatar değiştirilemedi.");
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
            <View
              style={{
                height: 88,
                alignSelf: "stretch",
                borderRadius: radii.lg,
                backgroundColor: profile.bannerColor ?? colors.brand,
              }}
            />
            <Pressable
              onPress={onChangeAvatar}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Avatarı değiştir"
              style={{ marginTop: -26, marginLeft: spacing.md }}
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
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...typography.display, color: colors.bright }}>
              {profile.name?.trim() || profile.username}
            </Text>
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
