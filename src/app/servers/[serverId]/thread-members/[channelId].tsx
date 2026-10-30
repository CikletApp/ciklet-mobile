import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  useMemberSearch,
  useSetThreadInvitable,
  useThreadMembers,
  useThreadMembership,
} from "@/api/hooks";
import { useAuth } from "@/stores/auth";
import {
  Avatar,
  ErrorState,
  Icon,
  IconButton,
  ListSkeleton,
  SectionHeader,
  TextField,
  showToast,
} from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Alt başlık üyeleri — web `thread-members-popover` ile aynı: liste, üye
 * ekle (sunucu üyelerinde arama), çıkar ("Alt Başlıkları Yönet" ya da özel
 * alt başlığı açan) ve özel alt başlıkta "Herkes davet edebilir". Kurallar
 * sunucuda (web lib/threads); düğmeler yalnızca izin varsa görünür.
 */
export default function ThreadMembersScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const me = useAuth((state) => state.profile?.id);
  const members = useThreadMembers(serverId, channelId);
  const membership = useThreadMembership(serverId, channelId);
  const invitable = useSetThreadInvitable(serverId, channelId);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const search = useMemberSearch(serverId, trimmed);

  const state = members.data;
  const memberIds = new Set(state?.members.map((m) => m.profileId) ?? []);
  const hits = trimmed ? (search.data ?? []).filter((m) => !memberIds.has(m.profileId)).slice(0, 8) : [];
  const canRemove = (profileId: string) =>
    Boolean(state) && profileId !== me && (state!.canManage || (state!.private && state!.ownerId === me));

  const mutate = (userId: string, add: boolean) =>
    membership.mutate(
      { userId, add },
      {
        onSuccess: () => {
          if (add) setQuery("");
          void members.refetch();
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : add ? "Eklenemedi." : "Çıkarılamadı.", "error"),
      }
    );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Alt başlık üyeleri" }} />
      {members.isLoading ? (
        <ListSkeleton rows={5} />
      ) : members.error || !state ? (
        <ErrorState
          message={members.error instanceof ApiError ? members.error.message : "Üyeler yüklenemedi."}
          onRetry={() => void members.refetch()}
        />
      ) : (
        <>
          {state.canAdd ? (
            <View style={{ padding: spacing.lg, paddingBottom: 0, gap: spacing.sm }}>
              <TextField label="ÜYE EKLE" value={query} onChangeText={setQuery} placeholder="Ad ya da kullanıcı adı" autoCapitalize="none" />
              {hits.map((hit) => (
                <View key={hit.profileId} style={rowStyle}>
                  <Avatar profileId={hit.profile.id} imageUrl={hit.profile.imageUrl} fallbackText={hit.profile.username} size={32} />
                  <Text style={nameStyle} numberOfLines={1}>
                    {hit.nickname || hit.profile.name || hit.profile.username}
                  </Text>
                  <IconButton
                    icon="user-plus"
                    label="Alt başlığa ekle"
                    background="transparent"
                    tint={colors.brand}
                    disabled={membership.isPending}
                    onPress={() => mutate(hit.profileId, true)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <SectionHeader title={`ÜYELER — ${state.members.length}`} />
          {state.members.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg }}>Henüz kimse takip etmiyor.</Text>
          ) : (
            state.members.map((m) => (
              <View key={m.profileId} style={[rowStyle, { paddingHorizontal: spacing.lg }]}>
                <Avatar profileId={m.profileId} imageUrl={m.imageUrl} fallbackText={m.username} size={32} />
                <Text style={nameStyle} numberOfLines={1}>
                  {m.nickname || m.name || m.username}
                  {m.isBot ? "  BOT" : ""}
                </Text>
                {canRemove(m.profileId) ? (
                  <IconButton
                    icon="trash"
                    label="Alt başlıktan çıkar"
                    background="transparent"
                    tint={colors.muted}
                    disabled={membership.isPending}
                    onPress={() => mutate(m.profileId, false)}
                  />
                ) : null}
              </View>
            ))
          )}

          {state.private && state.canEditInvitable ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                margin: spacing.lg,
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.panel,
              }}
            >
              <Icon name="users" size={18} color={colors.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Herkes davet edebilir</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>Kapalıysa yalnızca moderatörler üye ekler.</Text>
              </View>
              <Switch
                value={state.invitable}
                disabled={invitable.isPending}
                onValueChange={(value) =>
                  invitable.mutate(value, {
                    onError: (error) =>
                      showToast(error instanceof ApiError ? error.message : "Değiştirilemedi.", "error"),
                  })
                }
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor="#ffffff"
              />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const rowStyle = { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, paddingVertical: spacing.sm };
const nameStyle = { ...typography.body, ...fw(600), color: colors.bright, flex: 1 };
