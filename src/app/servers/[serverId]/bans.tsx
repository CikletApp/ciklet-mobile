import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { hasServerPermission, useMyPermissions } from "@/api/hooks";
import { useServerBans, useUnban, type ServerBan } from "@/api/hooks/use-server-admin";
import { Avatar, EmptyState, ErrorState, Icon, ListSkeleton, Pressable, Screen, showToast } from "@/components/ui";
import { useT, type Translator } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/** web lib/server-bans `banExpiryLabel` (çevrilmiş). */
function banExpiryText(t: Translator, expiresAt: string | null, now = Date.now()): string {
  const at = expiresAt ? new Date(expiresAt).getTime() : NaN;
  if (!Number.isFinite(at)) return t("moreScreens.bans.permanent");
  if (at <= now) return t("moreScreens.bans.expired");
  const hours = Math.ceil((at - now) / 3_600_000);
  if (hours < 24) return t("moreScreens.bans.hoursLeft", { count: hours });
  return t("moreScreens.bans.daysLeft", { count: Math.ceil(hours / 24) });
}

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
  const t = useT();

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
      onError: (error) => showToast(userErrorMessage(error, t("moreScreens.bans.unbanFailed")), "error"),
      onSettled: () => setBusy(""),
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t("moreScreens.bans.title") }} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        <Text style={{ ...typography.overline, color: colors.muted }}>{t("moreScreens.bans.listHeader", { count: list.length })}</Text>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("moreScreens.bans.hint")}</Text>
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
            placeholder={t("moreScreens.bans.search")}
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
        <ErrorState message={t("moreScreens.bans.loadFailed")} onRetry={() => void bans.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="shield" title={t("moreScreens.bans.emptyTitle")} description={t("moreScreens.bans.emptyBody")} />
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
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{t("moreScreens.bans.reason", { reason: ban.reason })}</Text>
                ) : null}
                <Text style={{ ...typography.caption, color: colors.muted }}>{banExpiryText(t, ban.expiresAt ?? null)}</Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={() => lift(ban)}
                  disabled={busy === ban.userId}
                  accessibilityRole="button"
                  accessibilityLabel={t("moreScreens.bans.unban")}
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
                    <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{t("moreScreens.bans.unban")}</Text>
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
