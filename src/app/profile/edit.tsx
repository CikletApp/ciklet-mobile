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
import { ScreenLoader } from "@/components/ui/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Profil düzenleme — iki sekme:
 *  - Kullanıcı Profili : `PATCH /api/current-profile`
 *  - Sunucu Profilleri : üyelik başına `PATCH /api/members/[memberId]`
 *
 * Faz 1'de kullanıcı profili alanları (görünen ad, hitaplar, hakkımda)
 * yazılabilir. Avatar/banner yükleme ve sunucu profili formu Faz 2'de
 * (UploadThing entegrasyonuyla birlikte) gelir.
 */
type Tab = "user" | "servers";

export default function EditProfileScreen() {
  const [tab, setTab] = useState<Tab>("user");
  const { data: profile, isLoading } = useCurrentProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");

  // Sunucudan gelen değerlerle formu bir kez doldur. Kullanıcı yazmaya
  // başladıktan sonra gelen bir refetch yazdıklarını EZMEMELİ; bu yüzden
  // bağımlılık yalnızca profil kimliği.
  useEffect(() => {
    if (!profile) return;
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
            <View style={{ marginTop: -26, marginLeft: spacing.md }}>
              <Avatar
                profileId={profile.id}
                imageUrl={profile.imageUrl}
                fallbackText={profile.username}
                size={68}
                backgroundColor={colors.panel}
              />
            </View>
          </View>

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

/** Sunucu profilleri listesi — düzenleme formu Faz 2. */
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
