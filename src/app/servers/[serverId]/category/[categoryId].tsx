import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { useCategoryMutations, useServerCategories } from "@/api/hooks/use-channel-admin";
import { Button, KeyboardAvoider, TextField, showDialog, showToast } from "@/components/ui";
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/channel-layout";
import { useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

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
  const t = useT();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (category) setName(category.name);
  }, [category?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = name.trim();
  const unchanged = !creating && trimmed === category?.name;
  const mutation = creating ? create : rename;
  const fail = (fallback: string) => (error: unknown) =>
    showToast(userErrorMessage(error, fallback), "error");

  const submit = () => {
    if (!trimmed || unchanged) return;
    if (creating) {
      create.mutate(trimmed, { onSuccess: () => router.back(), onError: fail(t("moreScreens.category.createFailed")) });
    } else {
      rename.mutate({ categoryId, name: trimmed }, { onSuccess: () => router.back(), onError: fail(t("moreScreens.category.saveFailed")) });
    }
  };

  const confirmDelete = () => {
    if (!category) return;
    showDialog(
      t("moreScreens.category.deleteTitle"),
      t("moreScreens.category.deleteBody", { name: category.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("moreScreens.category.delete"),
          style: "destructive",
          onPress: () => remove.mutate(category.id, { onSuccess: () => router.back(), onError: fail(t("moreScreens.category.deleteFailed")) }),
        },
      ]
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: creating ? t("moreScreens.category.create") : t("moreScreens.category.editTitle") }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <TextField
          label={t("moreScreens.category.nameLabel")}
          value={name}
          onChangeText={setName}
          autoFocus={creating}
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          placeholder={t("moreScreens.category.namePlaceholder")}
        />
        <Text style={{ ...typography.caption, color: colors.muted, marginTop: -spacing.md }}>
          {t("moreScreens.category.hint")}
        </Text>
        <Button
          label={creating ? t("moreScreens.category.create") : t("common.save")}
          fullWidth
          size="lg"
          loading={mutation.isPending}
          disabled={!trimmed || unchanged}
          onPress={submit}
        />
        {category ? (
          <>
            <Button
              label={t("moreScreens.category.permissions")}
              variant="ghost"
              icon="shield"
              fullWidth
              onPress={() => router.push(`/servers/${serverId}/channel-permissions?categoryId=${category.id}`)}
            />
            <Button label={t("moreScreens.category.delete")} variant="danger" fullWidth loading={remove.isPending} onPress={confirmDelete} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}
