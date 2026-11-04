import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useCategoryMutations, useServerCategories } from "@/api/hooks/use-channel-admin";
import { Button, KeyboardAvoider, TextField, showDialog, showToast } from "@/components/ui";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/channel-layout";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Kategori Oluştur / Kategoriyi Düzenle — web `modals/category-modal.tsx`.
 * Düzenlemede İzinler ve Kategoriyi Sil (içindeki kanallar silinmez,
 * kategorisiz alana taşınır).
 */
export default function CategoryScreen() {
  const { serverId, categoryId } = useLocalSearchParams<{ serverId: string; categoryId: string }>();
  const creating = categoryId === "new";
  const { data: categories } = useServerCategories(serverId);
  const category = creating ? undefined : categories?.find((c) => c.id === categoryId);
  const { create, rename, remove } = useCategoryMutations(serverId);
  const [name, setName] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (category) setName(category.name);
  }, [category?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = name.trim();
  const unchanged = !creating && trimmed === category?.name;
  const mutation = creating ? create : rename;
  const fail = (fallback: string) => (error: unknown) =>
    showToast(error instanceof ApiError ? error.message : fallback, "error");

  const submit = () => {
    if (!trimmed || unchanged) return;
    if (creating) {
      create.mutate(trimmed, { onSuccess: () => router.back(), onError: fail("Kategori oluşturulamadı") });
    } else {
      rename.mutate({ categoryId, name: trimmed }, { onSuccess: () => router.back(), onError: fail("Kategori kaydedilemedi") });
    }
  };

  const confirmDelete = () => {
    if (!category) return;
    showDialog(
      "Kategoriyi sil?",
      `${category.name} kategorisini silmek istediğine emin misin? İçindeki kanallar silinmez, kategorisiz olarak listenin üstüne taşınır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Kategoriyi Sil",
          style: "destructive",
          onPress: () => remove.mutate(category.id, { onSuccess: () => router.back(), onError: fail("Kategori silinemedi") }),
        },
      ]
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: creating ? "Kategori Oluştur" : "Kategoriyi Düzenle" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <TextField
          label="KATEGORİ ADI"
          value={name}
          onChangeText={setName}
          autoFocus={creating}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          placeholder="Yeni Kategori"
        />
        <Text style={{ ...typography.caption, color: colors.muted, marginTop: -spacing.md }}>
          Kategoriler kanalları kenar çubuğunda gruplar. Kanalları kanal ayarlarından kategoriler arasında taşıyabilirsin.
        </Text>
        <Button
          label={creating ? "Kategori Oluştur" : "Kaydet"}
          fullWidth
          size="lg"
          loading={mutation.isPending}
          disabled={!trimmed || unchanged}
          onPress={submit}
        />
        {category ? (
          <>
            <Button
              label="İzinler"
              variant="ghost"
              icon="shield"
              fullWidth
              onPress={() => router.push(`/servers/${serverId}/channel-permissions?categoryId=${category.id}`)}
            />
            <Button label="Kategoriyi Sil" variant="danger" fullWidth loading={remove.isPending} onPress={confirmDelete} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}
