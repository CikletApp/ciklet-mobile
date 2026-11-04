import { Pressable, Switch, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { OwnGameStatsCard } from "@/api/types";
import { Divider, ListGroup, SectionHeader } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";

const KEY = ["profile-game-stats"] as const;

/**
 * Ayarlar › Gizlilik › Oyun İstatistikleri — web
 * `components/settings/game-stats-privacy-section` ile aynı: her uygulama
 * için "Profilimde göster" anahtarı ve Kaldır. Liste boşsa bölüm görünmez.
 */
export function GameStatsPrivacySection() {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const rows = await api<OwnGameStatsCard[]>(endpoints.profileGameStats);
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 30_000,
  });

  const setHidden = useMutation({
    mutationFn: (input: { applicationId: string; hidden: boolean }) => api(endpoints.profileGameStats, { method: "PATCH", body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<OwnGameStatsCard[]>(KEY);
      queryClient.setQueryData<OwnGameStatsCard[]>(KEY, (rows) => rows?.map((r) => (r.application.id === input.applicationId ? { ...r, hidden: input.hidden } : r)));
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(KEY, context?.previous),
  });

  const remove = useMutation({
    mutationFn: (applicationId: string) => api(endpoints.profileGameStats, { method: "DELETE", body: { applicationId } }),
    onSuccess: (_data, applicationId) =>
      queryClient.setQueryData<OwnGameStatsCard[]>(KEY, (rows) => rows?.filter((r) => r.application.id !== applicationId)),
  });

  const rows = query.data ?? [];
  if (rows.length === 0) return null;

  return (
    <>
      <SectionHeader title={t("gameStats.privacy.title").toLocaleUpperCase(locale)} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("gameStats.privacy.description")}</Text>
        <ListGroup>
          {rows.map((row, index) => (
            <View key={row.application.id}>
              {index > 0 ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.body, color: colors.text }} numberOfLines={1}>
                    {row.game?.name ?? row.application.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>{t("gameStats.privacy.show")}</Text>
                </View>
                <Pressable onPress={() => remove.mutate(row.application.id)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ ...typography.caption, color: colors.danger }}>{t("gameStats.privacy.remove")}</Text>
                </Pressable>
                <Switch
                  value={!row.hidden}
                  onValueChange={(v) => setHidden.mutate({ applicationId: row.application.id, hidden: !v })}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          ))}
        </ListGroup>
      </View>
    </>
  );
}
