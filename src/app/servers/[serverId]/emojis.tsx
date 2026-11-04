import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { hasServerPermission, useMyPermissions, useServerDetails } from "@/api/hooks";
import { canEditExpression, canUploadExpression, useCreateEmoji, useDeleteEmoji, useRenameEmoji } from "@/api/hooks/use-server-admin";
import {
  ActionSheet,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  ListSkeleton,
  Screen,
  SectionHeader,
  showDialog,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { useServerRoles, type ServerRoleLite } from "@/features/chat/server-assets";
import { RenameSheet } from "@/features/server/expression-admin";
import { BoostSlotsHint } from "@/features/server-boost/boost-ui";
import { effectiveServerPerks } from "@/lib/server-boost";
import { pickAndUploadServerEmoji } from "@/lib/uploads";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu emojileri — web Sunucu Ayarları › Emoji sekmesi: yükleme (İfade
 * Oluştur / İfadeleri Yönet), yeniden adlandırma ve silme (hepsini yöneten
 * ya da kendi yüklediği) ve rol kısıtı (Discord emoji "Roller"). Rol
 * seçilmemiş emoji herkesin; rol seçilmişse yalnızca o rollerden birine
 * sahip üyeler (ve botlar) kullanır, sunucu denetler (web
 * lib/custom-emoji-access). Rolleri yalnızca İfadeleri Yönet değiştirir;
 * uçlar aynı kapıları uygular.
 */
interface EmojiRow {
  id: string;
  name: string;
  imageUrl: string;
  roleIds: string[];
  createdById: string | null;
}

/** Emoji adı üst sınırı (web uç: harf, rakam, _). */
const EMOJI_NAME_MAX = 32;

const adminKey = (serverId: string) => ["server-emojis-admin", serverId] as const;

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

export default function ServerEmojisScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const queryClient = useQueryClient();
  const { data: permissions } = useMyPermissions(serverId);
  const canManageRoles = hasServerPermission(permissions, "MANAGE_EXPRESSIONS");
  const canUpload = canUploadExpression(permissions);
  const myId = useAuth((state) => state.profile?.id);
  const roles = useServerRoles(serverId);
  const [open, setOpen] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<EmojiRow | null>(null);
  const [renaming, setRenaming] = useState<EmojiRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const create = useCreateEmoji(serverId);
  const rename = useRenameEmoji(serverId);
  const remove = useDeleteEmoji(serverId);
  // Yuva sınırı sunucunun Takviye seviyesine bağlı (lib/server-boost; 50/100/150/250).
  const { data: server } = useServerDetails(serverId);
  const emojiMax = effectiveServerPerks(server).emojiSlots;

  const emojis = useQuery({
    queryKey: adminKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<unknown>(endpoints.serverEmojis(serverId!));
      if (!Array.isArray(data)) return [] as EmojiRow[];
      return data.flatMap((raw): EmojiRow[] => {
        const r = raw as Partial<EmojiRow> | null;
        if (!r || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.imageUrl !== "string") return [];
        return [
          {
            id: r.id,
            name: r.name,
            imageUrl: r.imageUrl,
            roleIds: Array.isArray(r.roleIds) ? r.roleIds.filter((x): x is string => typeof x === "string") : [],
            createdById: typeof r.createdById === "string" ? r.createdById : null,
          },
        ];
      });
    },
  });

  const saveRoles = useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      api<unknown>(`${endpoints.serverEmojis(serverId!)}/${encodeURIComponent(id)}`, { method: "PATCH", body: { roles: roleIds } }),
    onMutate: ({ id, roleIds }) => {
      const previous = queryClient.getQueryData<EmojiRow[]>(adminKey(serverId!));
      queryClient.setQueryData<EmojiRow[]>(adminKey(serverId!), (list) => list?.map((e) => (e.id === id ? { ...e, roleIds } : e)));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(adminKey(serverId!), context.previous);
      showToast("Emoji rolleri kaydedilemedi.", "error");
    },
    // Seçici/öneri listesi (`available`) yeniden hesaplansın.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["server-emojis", serverId] }),
  });

  const summary = (roleIds: string[]) => {
    const names = roles.filter((role) => roleIds.includes(role.id)).map((role) => role.name);
    if (names.length === 0) return "Herkes";
    return names.length === 1 ? names[0] : `${names.length} rol`;
  };

  const list = emojis.data ?? [];
  const count = list.length;
  const canEdit = (emoji: EmojiRow) => canEditExpression(permissions, emoji.createdById, myId);

  const upload = async () => {
    if (uploading || count >= emojiMax) return;
    setUploading(true);
    try {
      const picked = await pickAndUploadServerEmoji();
      if (picked) await create.mutateAsync({ name: picked.name, imageUrl: picked.url });
    } catch (error) {
      showToast(errorText(error, "Emoji yüklenemedi."), "error");
    } finally {
      setUploading(false);
    }
  };

  const menuItems: ActionSheetItem[] = [];
  if (menuFor) {
    const target = menuFor;
    if (canEdit(target)) {
      menuItems.push({ key: "rename", label: "Yeniden adlandır", icon: "pencil", onPress: () => setRenaming(target) });
    }
    if (canManageRoles) {
      menuItems.push({ key: "roles", label: "Roller", detail: summary(target.roleIds), icon: "shield", onPress: () => setOpen(target.id) });
    }
    if (canEdit(target)) {
      menuItems.push({
        key: "delete",
        label: "Sil",
        icon: "trash",
        destructive: true,
        onPress: () =>
          showDialog(`:${target.name}: silinsin mi?`, undefined, [
            { text: "Vazgeç", style: "cancel" },
            {
              text: "Sil",
              style: "destructive",
              onPress: () => remove.mutate(target.id, { onError: (error) => showToast(errorText(error, "Emoji silinemedi."), "error") }),
            },
          ]),
      });
    }
  }

  const toggle = (emoji: EmojiRow, role: ServerRoleLite) => {
    const next = emoji.roleIds.includes(role.id) ? emoji.roleIds.filter((id) => id !== role.id) : [...emoji.roleIds, role.id];
    saveRoles.mutate({ id: emoji.id, roleIds: next });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Emoji" }} />
      {emojis.isLoading ? (
        <ListSkeleton rows={6} />
      ) : emojis.isError ? (
        <ErrorState message="Emojiler yüklenemedi." onRetry={() => void emojis.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Bu sunucudaki herkesin kullanabileceği özel emojiler ekle. Bir emojiyi rollere kısıtlarsan yalnızca o rollere sahip üyeler kullanabilir.
            </Text>
            <View style={{ marginTop: spacing.sm }}>
              <BoostSlotsHint tier={server?.premiumTier} used={count} max={emojiMax} />
            </View>
            {canUpload ? (
              <View style={{ flexDirection: "row", marginTop: spacing.md }}>
                <Button
                  label="Emoji Yükle"
                  icon="image"
                  loading={uploading}
                  disabled={uploading || count >= emojiMax}
                  onPress={() => void upload()}
                />
              </View>
            ) : null}
          </View>
          {count === 0 ? (
            <EmptyState icon="emoji" title="EMOJİ YOK" description="Bir emoji yükleyerek başlayın" />
          ) : (
            <>
              <SectionHeader title={`EMOJİ — ${count}/${emojiMax}`} />
              <View style={{ paddingHorizontal: spacing.lg }}>
                <ListGroup>
                  {list.map((emoji, index) => (
                    <View key={emoji.id}>
                      {index > 0 ? <Divider inset={52} /> : null}
                      <ListRow
                        title={`:${emoji.name}:`}
                        subtitle={summary(emoji.roleIds)}
                        leading={<Image source={{ uri: emoji.imageUrl }} style={{ width: 28, height: 28 }} contentFit="contain" />}
                        chevron={false}
                        detail={open === emoji.id ? "Kapat" : undefined}
                        onPress={
                          open === emoji.id
                            ? () => setOpen(null)
                            : canManageRoles || canEdit(emoji)
                              ? () => setMenuFor(emoji)
                              : undefined
                        }
                      />
                      {open === emoji.id && canManageRoles ? (
                        <View style={{ paddingLeft: spacing.xl }}>
                          {roles.length === 0 ? (
                            <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md }}>Bu sunucuda rol yok.</Text>
                          ) : (
                            roles.map((role) => (
                              <View key={role.id}>
                                <Divider inset={16} />
                                <ListRow
                                  title={role.name}
                                  titleColor={role.color ?? colors.text}
                                  detail={emoji.roleIds.includes(role.id) ? "Seçili" : undefined}
                                  chevron={false}
                                  onPress={() => toggle(emoji, role)}
                                />
                              </View>
                            ))
                          )}
                          {emoji.roleIds.length > 0 ? (
                            <>
                              <Divider inset={16} />
                              <ListRow
                                title="Kısıtlamayı kaldır (herkes)"
                                titleColor={colors.muted}
                                chevron={false}
                                onPress={() => saveRoles.mutate({ id: emoji.id, roleIds: [] })}
                              />
                            </>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </ListGroup>
              </View>
            </>
          )}
        </ScrollView>
      )}
      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        header={menuFor ? <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{`:${menuFor.name}:`}</Text> : undefined}
        items={menuItems}
      />
      <RenameSheet
        visible={renaming !== null}
        title="Emojiyi yeniden adlandır"
        initialName={renaming?.name ?? ""}
        nameMax={EMOJI_NAME_MAX}
        prefix=":"
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (!renaming || name === renaming.name) return;
          rename.mutate({ id: renaming.id, name }, { onError: (error) => showToast(errorText(error, "Emoji adı değiştirilemedi."), "error") });
        }}
      />
    </Screen>
  );
}
