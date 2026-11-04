import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { hasServerPermission, useMyPermissions } from "@/api/hooks";
import { banExpiryLabel, useServerBans, useUnban, type ServerBan } from "@/api/hooks/use-server-admin";
import { Avatar, EmptyState, ErrorState, Icon, ListSkeleton, Pressable, Screen, showToast } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu yasaklama listesi — web Sunucu Ayarları › Yasaklar sekmesi:
 * kullanıcı adıyla arama, sebep, süre ve "Yasağı Kaldır" (Üyeleri Yasakla).
 */
export default function ServerBansScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: actor } = useMyPermissions(serverId);
  const canManage = hasServerPermission(actor, "BAN_MEMBERS");
  const bans = useServerBans(serverId);
  const unban = useUnban(serverId);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");

  const list = useMemo(() => bans.data ?? [], [bans.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((ban) => (ban.user?.username ?? ban.userId).toLowerCase().includes(q));
  }, [list, query]);

  const lift = (ban: ServerBan) => {
    if (busy) return;
    setBusy(ban.userId);
    unban.mutate(ban.userId, {
      onError: (error) => showToast(error instanceof ApiError ? error.message : "Yasak kaldırılamadı.", "error"),
      onSettled: () => setBusy(""),
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Yasaklar" }} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        <Text style={{ ...typography.overline, color: colors.muted }}>{`SUNUCU YASAKLAMA LİSTESİ — ${list.length}`}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>Yasaklı kullanıcılar davetle bile sunucuya katılamaz.</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: colors.panel,
          }}
        >
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı adıyla ara"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, height: 40, ...typography.body, color: colors.text }}
          />
        </View>
      </View>

      {bans.isLoading ? (
        <ListSkeleton rows={6} />
      ) : bans.isError ? (
        <ErrorState message="Yasaklar yüklenemedi." onRetry={() => void bans.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="shield" title="YASAKLAMA YOK" description="Üyeler sekmesinden bir kullanıcıyı yasaklayabilirsin." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(ban) => ban.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["4xl"] }}
          renderItem={({ item: ban }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
              <Avatar profileId={ban.user?.id} imageUrl={ban.user?.imageUrl ?? null} fallbackText={ban.user?.username ?? "?"} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1}>
                  {ban.user?.username ?? ban.userId}
                </Text>
                {ban.reason ? (
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{`Sebep: ${ban.reason}`}</Text>
                ) : null}
                <Text style={{ ...typography.caption, color: colors.muted }}>{banExpiryLabel(ban.expiresAt ?? null)}</Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={() => lift(ban)}
                  disabled={busy === ban.userId}
                  accessibilityRole="button"
                  accessibilityLabel="Yasağı Kaldır"
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: busy === ban.userId ? 0.5 : 1,
                  }}
                >
                  {busy === ban.userId ? (
                    <ActivityIndicator size="small" color={colors.muted} />
                  ) : (
                    <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>Yasağı Kaldır</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}
