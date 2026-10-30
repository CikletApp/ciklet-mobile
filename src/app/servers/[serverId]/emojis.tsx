import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { hasServerPermission, useMyPermissions } from "@/api/hooks";
import { Divider, EmptyState, ErrorState, ListGroup, ListRow, ListSkeleton, Screen, SectionHeader, showToast } from "@/components/ui";
import { useServerRoles, type ServerRoleLite } from "@/features/chat/server-assets";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu emojileri — web Sunucu Ayarları › Emoji sekmesinin rol kısıtı
 * kısmı (Discord emoji "Roller"). Rol seçilmemiş emoji herkesin; rol
 * seçilmişse yalnızca o rollerden birine sahip üyeler (ve botlar) kullanır,
 * sunucu denetler (web lib/custom-emoji-access). Rolleri yalnızca İfadeleri
 * Yönet değiştirir; uç aynı kapıyı uygular.
 *
 * Yükleme, yeniden adlandırma ve silme şimdilik yalnızca webde.
 */
interface EmojiRow {
  id: string;
  name: string;
  imageUrl: string;
  roleIds: string[];
}

const adminKey = (serverId: string) => ["server-emojis-admin", serverId] as const;

export default function ServerEmojisScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const queryClient = useQueryClient();
  const { data: permissions } = useMyPermissions(serverId);
  const canManageRoles = hasServerPermission(permissions, "MANAGE_EXPRESSIONS");
  const roles = useServerRoles(serverId);
  const [open, setOpen] = useState<string | null>(null);

  const emojis = useQuery({
    queryKey: adminKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<unknown>(endpoints.serverEmojis(serverId!));
      if (!Array.isArray(data)) return [] as EmojiRow[];
      return data.flatMap((raw): EmojiRow[] => {
        const r = raw as Partial<EmojiRow> | null;
        if (!r || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.imageUrl !== "string") return [];
        return [{ id: r.id, name: r.name, imageUrl: r.imageUrl, roleIds: Array.isArray(r.roleIds) ? r.roleIds.filter((x): x is string => typeof x === "string") : [] }];
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
      ) : (emojis.data ?? []).length === 0 ? (
        <EmptyState icon="emoji" title="Emoji yok" description="Sunucu ayarlarından (web) emoji yüklenebilir." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Bir emojiyi rollere kısıtlarsan yalnızca o rollere sahip üyeler kullanabilir. Hiç rol seçilmezse herkes kullanabilir.
            </Text>
          </View>
          <SectionHeader title={`EMOJİ — ${(emojis.data ?? []).length}/50`} />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ListGroup>
              {(emojis.data ?? []).map((emoji, index) => (
                <View key={emoji.id}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    title={`:${emoji.name}:`}
                    subtitle={summary(emoji.roleIds)}
                    leading={<Image source={{ uri: emoji.imageUrl }} style={{ width: 28, height: 28 }} contentFit="contain" />}
                    chevron={false}
                    detail={canManageRoles ? (open === emoji.id ? "Kapat" : "Roller") : undefined}
                    onPress={canManageRoles ? () => setOpen((current) => (current === emoji.id ? null : emoji.id)) : undefined}
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
        </ScrollView>
      )}
    </Screen>
  );
}
