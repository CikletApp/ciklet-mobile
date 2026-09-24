import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  useDirect,
  useDirectDisplay,
  useFriends,
  useRemoveDirect,
  useUpdateGroup,
} from "@/api/hooks";
import {
  Avatar,
  Button,
  Icon,
  IconButton,
  Pressable,
  Screen,
  ScreenLoader,
  SectionHeader,
  TextField,
  showDialog,
} from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Grup bilgisi — ad, üyeler, ayrılma.
 *
 * Yetki modeli uçtan geliyor ve arayüz onu birebir yansıtır:
 * `PATCH /api/directs/groups/[id]` YALNIZCA grup sahibine izin veriyor.
 * Sahip olmayan biri düzenleme alanlarını hiç görmez — göstermek, dokununca
 * 403 yiyeceği bir düğme sunmak olurdu.
 *
 * ⚠️ Uç `memberIds` alanını fark değil TAM LİSTE olarak yorumluyor: eksik
 * gönderilen üye gruptan çıkarılır. Bu yüzden ekran her zaman tam listeyi
 * gönderir.
 */
export default function GroupInfoScreen() {
  const { directId } = useLocalSearchParams<{ directId: string }>();
  const { data: direct, isLoading } = useDirect(directId);
  const display = useDirectDisplay(direct);
  const myId = useAuth((s) => s.profile?.id);
  const { accepted } = useFriends();
  const updateGroup = useUpdateGroup(directId);
  const removeDirect = useRemoveDirect();

  /**
   * Ad taslağı YALNIZCA düzenleme sırasında var: `null` = düzenlenmiyor.
   *
   * Alternatifi, adı bir efektle sunucu verisinden state'e kopyalamaktı;
   * o kurgu hem gereksiz bir render turu ekliyor hem de kullanıcı yazarken
   * arkadan gelen bir tazeleme yazdığını EZİYOR. Taslağı yalnızca düzenleme
   * açıkken tutmak ikisini birden ortadan kaldırıyor.
   */
  const [draftName, setDraftName] = useState<string | null>(null);
  const editing = draftName !== null;

  const memberIds = useMemo(
    () => (direct?.groupMembers ?? []).map((member) => member.profileId),
    [direct?.groupMembers]
  );

  /** Gruba eklenebilecekler: arkadaşım olup henüz üye olmayanlar. */
  const addable = useMemo(
    () =>
      accepted.filter(
        (entry) =>
          !memberIds.includes(entry.profile.id) &&
          !isOfficialProfile(entry.profile)
      ),
    [accepted, memberIds]
  );

  if (isLoading) return <ScreenLoader />;

  if (!direct || !display?.isGroup) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Grup" }} />
        <View style={{ padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.muted }}>
            Bu sohbet bulunamadı ya da bir grup değil.
          </Text>
        </View>
      </Screen>
    );
  }

  const isOwner = display.isOwner;
  const full = display.members.length >= MAX_GROUP_MEMBERS;

  /** Üye listesini TAM olarak gönderir (sen hariç — uç seni zaten ekliyor). */
  const commitMembers = (nextIds: string[]) => {
    updateGroup.mutate(
      { memberIds: nextIds.filter((id) => id !== myId) },
      {
        onError: (error) =>
          showDialog(
            "Güncellenemedi",
            error instanceof ApiError ? error.message : "Beklenmeyen bir hata oldu."
          ),
      }
    );
  };

  const saveName = () => {
    const next = (draftName ?? "").trim();
    setDraftName(null);
    if ((direct.name ?? "") === next) return;
    updateGroup.mutate(
      { name: next },
      {
        onError: (error) =>
          showDialog(
            "Ad değiştirilemedi",
            error instanceof ApiError ? error.message : "Beklenmeyen bir hata oldu."
          ),
      }
    );
  };

  const removeMember = (profileId: string, label: string) => {
    showDialog("Üyeyi çıkar", `${label} gruptan çıkarılacak.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkar",
        style: "destructive",
        onPress: () => commitMembers(memberIds.filter((id) => id !== profileId)),
      },
    ]);
  };

  const leave = () => {
    showDialog(
      "Gruptan ayrıl",
      `"${display.title}" grubundan ayrılacaksın. Yeniden eklenmen için bir üyenin seni davet etmesi gerekir.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Ayrıl",
          style: "destructive",
          onPress: () =>
            removeDirect.mutate(direct.id, {
              // Sohbet artık senin değil; geri dönülecek ekran da yok.
              onSuccess: () => router.dismissTo("/(tabs)"),
            }),
        },
      ]
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Grup Bilgisi" }} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md }}>
          <Avatar
            imageUrl={display.imageUrl}
            fallbackText={display.fallbackText}
            size={92}
            radius={radii.bento}
            backgroundColor={colors.bento}
          />

          {editing ? (
            <View style={{ width: "100%", paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <TextField
                label="Grup adı"
                value={draftName ?? ""}
                onChangeText={setDraftName}
                maxLength={MAX_GROUP_NAME_LENGTH}
                autoFocus
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Vazgeç"
                    variant="ghost"
                    onPress={() => setDraftName(null)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Kaydet" onPress={saveName} loading={updateGroup.isPending} />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text
                style={{ ...typography.display, color: colors.bright, textAlign: "center" }}
                numberOfLines={2}
              >
                {display.title}
              </Text>
              {isOwner ? (
                <IconButton
                  icon="pencil"
                  label="Grup adını değiştir"
                  background="transparent"
                  tint={colors.muted}
                  onPress={() => setDraftName(direct.name ?? "")}
                />
              ) : null}
            </View>
          )}

          <Text style={{ ...typography.caption, color: colors.muted }}>
            {display.members.length} üye
            {!isOwner ? " · Yalnızca grup sahibi düzenleyebilir" : ""}
          </Text>
        </View>

        <SectionHeader title={`ÜYELER (${display.members.length})`} />
        {display.members.map((member) => {
          const isMe = member.id === myId;
          const isGroupOwner = member.id === direct.ownerId;
          return (
            <Pressable
              key={member.id}
              onPress={() => (isMe ? undefined : router.push(`/profile/${member.id}`))}
              disabled={isMe}
              haptic={isMe ? undefined : "light"}
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={displayNameOf(member)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: spacing.lg,
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Avatar
                profileId={member.id}
                imageUrl={member.imageUrl}
                fallbackText={member.username}
                size={42}
                showPresence
              />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                  {isMe ? "Sen" : displayNameOf(member)}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                  {isGroupOwner ? "Grup sahibi" : `@${member.username}`}
                </Text>
              </View>
              {isOwner && !isMe ? (
                <IconButton
                  icon="close"
                  label={`${displayNameOf(member)} kullanıcısını çıkar`}
                  background="transparent"
                  tint={colors.danger}
                  onPress={() => removeMember(member.id, displayNameOf(member))}
                />
              ) : null}
            </Pressable>
          );
        })}

        {isOwner ? (
          <>
            <SectionHeader title="ARKADAŞ EKLE" />
            {full ? (
              <Text
                style={{
                  ...typography.caption,
                  color: colors.warning,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                Grup dolu — en fazla {MAX_GROUP_MEMBERS} kişi olabilir.
              </Text>
            ) : addable.length === 0 ? (
              <Text
                style={{
                  ...typography.caption,
                  color: colors.muted,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                Eklenebilecek başka arkadaşın yok.
              </Text>
            ) : (
              addable.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => commitMembers([...memberIds, entry.profile.id])}
                  disabled={updateGroup.isPending}
                  haptic="light"
                  noHitSlop
                  accessibilityRole="button"
                  accessibilityLabel={`${displayNameOf(entry.profile)} kullanıcısını gruba ekle`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    minHeight: 56,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: pressed ? colors.raised : "transparent",
                    opacity: updateGroup.isPending ? 0.6 : 1,
                  })}
                >
                  <Avatar
                    profileId={entry.profile.id}
                    imageUrl={entry.profile.imageUrl}
                    fallbackText={entry.profile.username}
                    size={38}
                  />
                  <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={1}>
                    {displayNameOf(entry.profile)}
                  </Text>
                  <Icon name="plus" size={20} color={colors.brand} />
                </Pressable>
              ))
            )}
          </>
        ) : null}

        <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
          <Button
            label="Gruptan Ayrıl"
            icon="logout"
            variant="danger"
            onPress={leave}
            loading={removeDirect.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
