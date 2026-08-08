import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useMyMemberships, useUpdateMemberProfile } from "@/api/hooks";
import { Avatar, EmptyState, ScreenLoader } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function ServerProfileEditScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { data: memberships, isLoading } = useMyMemberships();
  const membership = useMemo(
    () => memberships?.find((item) => item.id === memberId),
    [memberships, memberId]
  );
  const update = useUpdateMemberProfile(memberId);

  const [nickname, setNickname] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!membership) return;
    // Sunucudan gelen üyelik, düzenleme taslağına yalnızca üyelik değişince alınır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(membership.nickname ?? "");
    setPronouns(membership.serverPronouns ?? "");
    setBio(membership.serverBio ?? "");
  }, [membership?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <ScreenLoader label="Sunucu profili yükleniyor…" />;

  if (!membership) {
    return (
      <EmptyState
        icon="user"
        title="Sunucu profili bulunamadı"
        description="Bu sunucunun üyeliği artık hesabında görünmüyor."
      />
    );
  }

  const dirty =
    nickname !== (membership.nickname ?? "") ||
    pronouns !== (membership.serverPronouns ?? "") ||
    bio !== (membership.serverBio ?? "");

  const save = () => {
    if (!dirty || update.isPending) return;
    update.mutate(
      {
        nickname: nickname.trim() || null,
        serverPronouns: pronouns.trim() || null,
        serverBio: bio.trim() || null,
      },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.panel }}>
      <Stack.Screen
        options={{
          title: membership.server.name,
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={!dirty || update.isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sunucu profilini kaydet"
            >
              {update.isPending ? (
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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <View style={{ alignItems: "flex-start" }}>
          <View
            style={{
              height: 104,
              alignSelf: "stretch",
              borderRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: membership.serverBannerColor ?? colors.brand,
            }}
          />
          <View style={{ marginTop: -30, marginLeft: spacing.md }}>
            <Avatar
              imageUrl={membership.serverImageUrl ?? membership.server.imageUrl}
              fallbackText={membership.nickname ?? membership.server.name}
              size={72}
              backgroundColor={colors.panel}
            />
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...typography.display, color: colors.bright }}>
            {membership.nickname?.trim() || membership.server.name}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Bu bilgiler yalnızca {membership.server.name} içinde görünür.
          </Text>
        </View>

        <Field
          label="SUNUCU TAKMA ADI"
          value={nickname}
          onChangeText={setNickname}
          placeholder="Takma ad ekle"
          maxLength={32}
        />
        <Field
          label="SUNUCU HİTAPLARI"
          value={pronouns}
          onChangeText={setPronouns}
          placeholder="Hitap ekle"
          maxLength={40}
        />
        <Field
          label="SUNUCU HAKKIMDA"
          value={bio}
          onChangeText={setBio}
          placeholder="Bu sunucu için kendinden bahset"
          maxLength={190}
          multiline
        />

        {update.isError ? (
          <Text style={{ ...typography.caption, color: colors.danger }}>
            {update.error instanceof ApiError
              ? update.error.message
              : "Sunucu profili kaydedilemedi."}
          </Text>
        ) : null}
      </ScrollView>
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
          minHeight: multiline ? 104 : 50,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.lg,
          borderCurve: "continuous",
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
