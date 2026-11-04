import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";

import { useMyPermissions, useServerDetails } from "@/api/hooks";
import {
  STICKER_DESCRIPTION_MAX,
  STICKER_NAME_MAX,
  canEditExpression,
  canUploadExpression,
  useCreateSticker,
  useDeleteSticker,
  useServerStickersAdmin,
  useUpdateSticker,
  type ServerStickerAdmin,
} from "@/api/hooks/use-server-admin";
import { ActionSheet, Button, EmptyState, ErrorState, ListSkeleton, Pressable, Screen, showDialog, showToast, type ActionSheetItem } from "@/components/ui";
import { RenameSheet } from "@/features/server/expression-admin";
import { BoostSlotsHint } from "@/features/server-boost/boost-ui";
import { effectiveServerPerks } from "@/lib/server-boost";
import { pickAndUploadServerSticker } from "@/lib/uploads";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/**
 * Sunucu Ayarları › Çıkartmalar (web stickers-tab): yükleme (İfade Oluştur /
 * İfadeleri Yönet), ad + açıklama düzenleme ve silme (hepsini yöneten ya da
 * kendi yüklediği). Görsel işlenmez; APNG/GIF animasyonu korunur (512 KB).
 */
export default function ServerStickersScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: permissions } = useMyPermissions(serverId);
  const { data: server } = useServerDetails(serverId);
  const myId = useAuth((state) => state.profile?.id);
  const max = effectiveServerPerks(server).stickerSlots;
  const stickers = useServerStickersAdmin(serverId);
  const create = useCreateSticker(serverId);
  const update = useUpdateSticker(serverId);
  const remove = useDeleteSticker(serverId);
  const [uploading, setUploading] = useState(false);
  const [menuFor, setMenuFor] = useState<ServerStickerAdmin | null>(null);
  const [editing, setEditing] = useState<ServerStickerAdmin | null>(null);

  const items = stickers.data ?? [];
  const canUpload = canUploadExpression(permissions);
  const canEdit = (sticker: ServerStickerAdmin) => canEditExpression(permissions, sticker.createdById, myId);

  const upload = async () => {
    if (uploading || items.length >= max) return;
    setUploading(true);
    try {
      const picked = await pickAndUploadServerSticker();
      if (picked) {
        await create.mutateAsync({ name: picked.name.slice(0, STICKER_NAME_MAX), imageUrl: picked.url });
        showToast("Çıkartma eklendi");
      }
    } catch (error) {
      showToast(errorText(error, "Çıkartma yüklenemedi"), "error");
    } finally {
      setUploading(false);
    }
  };

  const menuItems: ActionSheetItem[] = menuFor
    ? [
        { key: "edit", label: "Düzenle", icon: "pencil", onPress: () => setEditing(menuFor) },
        {
          key: "delete",
          label: "Sil",
          icon: "trash",
          destructive: true,
          onPress: () => {
            const target = menuFor;
            showDialog(`"${target.name}" silinsin mi?`, undefined, [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Sil",
                style: "destructive",
                onPress: () => remove.mutate(target.id, { onError: (error) => showToast(errorText(error, "Silinemedi"), "error") }),
              },
            ]);
          },
        },
      ]
    : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Çıkartmalar" }} />
      {stickers.isLoading ? (
        <ListSkeleton rows={4} />
      ) : stickers.isError ? (
        <ErrorState message="Çıkartmalar yüklenemedi." onRetry={() => void stickers.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>{`ÇIKARTMALAR — ${items.length}/${max}`}</Text>
          <BoostSlotsHint tier={server?.premiumTier} used={items.length} max={max} />
          <Text style={{ ...typography.caption, color: colors.muted }}>
            Sunucu üyelerinin kanallarda gönderebileceği çıkartmalar. PNG, APNG, GIF ya da WebP; en fazla 512 KB, kare önerilir.
          </Text>
          {canUpload ? (
            <View style={{ flexDirection: "row" }}>
              <Button label="Çıkartma Yükle" icon="image" loading={uploading} disabled={uploading || items.length >= max} onPress={() => void upload()} />
            </View>
          ) : null}
          {items.length === 0 ? (
            <EmptyState icon="image" title="ÇIKARTMA YOK" />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {items.map((sticker) => (
                <Pressable
                  key={sticker.id}
                  disabled={!canEdit(sticker)}
                  onPress={() => setMenuFor(sticker)}
                  accessibilityRole="button"
                  accessibilityLabel={sticker.name}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    padding: spacing.md,
                    gap: spacing.sm,
                    borderRadius: radii.bento,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: colors.bentoBorder,
                    backgroundColor: colors.panel,
                  }}
                >
                  <Image source={{ uri: sticker.imageUrl }} style={{ height: 100, width: "100%" }} contentFit="contain" />
                  <View>
                    <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1}>
                      {sticker.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                      {sticker.description ?? "—"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        header={menuFor ? <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{menuFor.name}</Text> : undefined}
        items={menuItems}
      />
      <RenameSheet
        visible={editing !== null}
        title="Çıkartmayı düzenle"
        initialName={editing?.name ?? ""}
        nameMax={STICKER_NAME_MAX}
        initialDescription={editing ? (editing.description ?? "") : undefined}
        descriptionMax={STICKER_DESCRIPTION_MAX}
        onClose={() => setEditing(null)}
        onSave={(name, description) => {
          if (!editing) return;
          update.mutate({ id: editing.id, name, description }, { onError: (error) => showToast(errorText(error, "Kaydedilemedi"), "error") });
        }}
      />
    </Screen>
  );
}
