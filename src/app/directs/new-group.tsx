import { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";

import { ApiError } from "@/api/client";
import {
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  useCreateGroup,
  useFriends,
} from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  KeyboardAvoider,
  ListSkeleton,
  Pressable,
  TextField,
  showDialog,
} from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Yeni grup sohbeti.
 *
 * Sunucunun kuralları arayüzde ÖNCEDEN uygulanır, çünkü hepsi gönderdikten
 * sonra ancak bir hata mesajı olarak görünürdü:
 *  • yalnızca ARKADAŞLAR eklenebilir (uç aksi halde 403 döner),
 *  • resmî hesaplar eklenemez (uç "geçersiz üye" der),
 *  • grup en fazla `MAX_GROUP_MEMBERS` kişilik — sen dahil,
 *  • ad en fazla `MAX_GROUP_NAME_LENGTH` karakter.
 *
 * Ad zorunlu değil: boş bırakılırsa hem web hem mobil başlığı üye
 * adlarından türetiyor (`directDisplay`).
 */
export default function NewGroupScreen() {
  const { accepted, isLoading } = useFriends();
  const createGroup = useCreateGroup();

  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");

  // Resmî hesaplar (Ciklet bildirim hesabı gibi) gruba alınamaz; listeden
  // hiç göstermemek, seçilip sonra reddedilmesinden dürüst.
  const candidates = useMemo(
    () => accepted.filter((entry) => !isOfficialProfile(entry.profile)),
    [accepted]
  );

  /** Sen de gruptasın: kalan kontenjan bir eksik. */
  const capacity = MAX_GROUP_MEMBERS - 1;
  const full = selected.length >= capacity;

  const toggle = (profileId: string) => {
    setSelected((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : current.length >= capacity
          ? current
          : [...current, profileId]
    );
  };

  const submit = () => {
    if (selected.length === 0 || createGroup.isPending) return;
    createGroup.mutate(
      { memberIds: selected, name },
      {
        onSuccess: (direct) => router.replace(`/chat/direct/${direct.id}`),
        onError: (error) =>
          showDialog(
            "Grup kurulamadı",
            error instanceof ApiError
              ? error.message
              : "Beklenmeyen bir hata oldu."
          ),
      }
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.panel }}>
        <ListSkeleton />
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.panel }}>
        <EmptyState
          icon="users"
          title="Grup kuracak arkadaş yok"
          description="Gruba yalnızca arkadaşlarını ekleyebilirsin. Önce bir arkadaş ekle."
          action={
            <Button
              label="Arkadaş Ekle"
              icon="user-plus"
              onPress={() => router.replace("/friends/add")}
            />
          }
        />
      </View>
    );
  }

  return (
    <KeyboardAvoider style={{ flex: 1, backgroundColor: colors.panel }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <TextField
          label="Grup adı"
          hint="İsteğe bağlı — boş bırakırsan üye adlarından oluşur."
          placeholder="Örn. Hafta Sonu Planı"
          value={name}
          onChangeText={setName}
          maxLength={MAX_GROUP_NAME_LENGTH}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <Text style={{ ...typography.overline, color: colors.muted }}>
          ÜYELER
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: full ? colors.warning : colors.muted,
          }}
        >
          {selected.length + 1}/{MAX_GROUP_MEMBERS}
        </Text>
      </View>

      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing["4xl"] * 2,
        }}
        renderItem={({ item }) => {
          const checked = selected.includes(item.profile.id);
          // Kontenjan dolduğunda SEÇİLİ OLMAYANLAR sönükleşir; seçili
          // olanlar tıklanabilir kalmalı, yoksa kullanıcı seçimini
          // geri alamaz ve ekranda kilitlenir.
          const blocked = full && !checked;

          return (
            <Pressable
              onPress={() => toggle(item.profile.id)}
              disabled={blocked}
              haptic="light"
              noHitSlop
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: blocked }}
              accessibilityLabel={displayNameOf(item.profile)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 60,
                paddingHorizontal: spacing.md,
                borderRadius: radii.lg,
                backgroundColor: pressed ? colors.raised : "transparent",
                opacity: blocked ? 0.4 : 1,
              })}
            >
              <Avatar
                profileId={item.profile.id}
                imageUrl={item.profile.imageUrl}
                fallbackText={item.profile.username}
                size={42}
                showPresence
                backgroundColor={colors.panel}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ ...typography.bodyStrong, color: colors.bright }}
                  numberOfLines={1}
                >
                  {displayNameOf(item.profile)}
                </Text>
                <Text
                  style={{ ...typography.caption, color: colors.muted }}
                  numberOfLines={1}
                >
                  @{item.profile.username}
                </Text>
              </View>

              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: checked ? 0 : 1.5,
                  borderColor: colors.border,
                  backgroundColor: checked ? colors.brand : "transparent",
                }}
              >
                {checked ? (
                  <Icon name="check" size={15} color={colors.onBrand} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <View
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: spacing.xl,
        }}
      >
        <Button
          label={
            selected.length === 0
              ? "En az bir arkadaş seç"
              : `Grubu Kur (${selected.length + 1})`
          }
          icon="users"
          onPress={submit}
          disabled={selected.length === 0 || createGroup.isPending}
          loading={createGroup.isPending}
        />
      </View>
    </KeyboardAvoider>
  );
}
