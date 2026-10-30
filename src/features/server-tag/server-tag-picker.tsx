import { ActivityIndicator, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useMyServerTag, useSetMyServerTag } from "@/api/hooks";
import { Avatar, Divider, ListGroup, ListRow, showToast } from "@/components/ui";
import { ServerTagPill } from "@/features/server-tag/server-tag-pill";
import { useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Profil › Sunucu Etiketi (Discord "Server Tag") — web
 * `components/settings/server-tag-picker.tsx` karşılığı: adının yanında
 * gösterilecek etiketi seç; yalnızca etiketi açık sunucular listelenir,
 * "Yok" kaldırır. Anında kaydedilir.
 */
export function ServerTagPicker() {
  const t = useT();
  const { data, isLoading } = useMyServerTag();
  const setTag = useSetMyServerTag();
  const current = data?.primaryGuild?.serverId ?? null;
  const eligible = data?.eligible ?? [];

  const choose = (serverId: string | null) => {
    if (serverId === current || setTag.isPending) return;
    setTag.mutate(serverId, {
      onSuccess: () => showToast(serverId ? t("serverTag.profile.updated") : t("serverTag.profile.removed")),
      onError: (error) =>
        showToast(error instanceof ApiError && error.message ? error.message : t("serverTag.profile.failed"), "error"),
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{t("serverTag.profile.title").toLocaleUpperCase("tr")}</Text>
      <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverTag.profile.description")}</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.muted} />
      ) : (
        <ListGroup>
          <ListRow
            title={t("serverTag.profile.none")}
            detail={current === null ? t("serverTag.profile.selected") : undefined}
            chevron={false}
            disabled={setTag.isPending}
            onPress={() => choose(null)}
          />
          {eligible.map((server) => (
            <View key={server.serverId}>
              <Divider inset={16} />
              <ListRow
                title={server.serverName}
                leading={<Avatar imageUrl={server.serverImageUrl} fallbackText={server.serverName} size={32} shape="squircle" />}
                trailing={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <ServerTagPill guild={{ tag: server.tag, badge: server.badge, serverName: server.serverName }} />
                    {current === server.serverId ? (
                      <Text style={{ ...typography.caption, color: colors.brand }}>{t("serverTag.profile.selected")}</Text>
                    ) : null}
                  </View>
                }
                chevron={false}
                disabled={setTag.isPending}
                onPress={() => choose(server.serverId)}
              />
            </View>
          ))}
          {eligible.length === 0 ? (
            <View>
              <Divider inset={16} />
              <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.lg }}>{t("serverTag.profile.empty")}</Text>
            </View>
          ) : null}
        </ListGroup>
      )}
    </View>
  );
}
