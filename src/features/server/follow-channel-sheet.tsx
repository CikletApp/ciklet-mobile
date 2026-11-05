import { useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";

import { useFollowChannel, useFollowTargets } from "@/api/hooks/use-channel-admin";
import { Button, Icon, showToast } from "@/components/ui";
import { PillPicker } from "@/features/moderation/ui";
import { fw } from "@/theme/fonts";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Duyuru kanalını takip et — web `chat/follow-channel-dialog.tsx`:
 * yönetici olunan sunuculardan bir metin kanalı seçilir; yayınlanan
 * duyurular oraya webhook olarak düşer.
 */
export function FollowChannelSheet({
  visible,
  onClose,
  channelId,
  channelName,
  sourceServerId,
}: {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  sourceServerId?: string | null;
}) {
  const targets = useFollowTargets(visible);
  const follow = useFollowChannel(channelId);
  const servers = (targets.data ?? []).filter((s) => s.id !== sourceServerId);
  const [serverPick, setServerPick] = useState<string | null>(null);
  const [channelPick, setChannelPick] = useState<string | null>(null);
  const t = useT();
  const serverId = serverPick && servers.some((s) => s.id === serverPick) ? serverPick : (servers[0]?.id ?? "");
  const selected = servers.find((s) => s.id === serverId);
  const targetChannelId =
    channelPick && selected?.channels.some((c) => c.id === channelPick) ? channelPick : (selected?.channels[0]?.id ?? "");

  const submit = () => {
    if (!targetChannelId) return;
    follow.mutate(targetChannelId, {
      onSuccess: () => {
        showToast(t("moreScreens.follow.followed"));
        onClose();
      },
      onError: (error) => showToast(userErrorMessage(error, t("moreScreens.follow.failed")), "error"),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <RNPressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          onStartShouldSetResponder={() => true}
          style={{
            maxHeight: "80%",
            margin: spacing.sm,
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Icon name="megaphone" size={20} color={colors.brand} />
            <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>{t("moreScreens.follow.title")}</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {t("moreScreens.follow.hint", { channel: channelName })}
          </Text>

          {targets.isLoading ? (
            <ActivityIndicator color={colors.muted} style={{ paddingVertical: spacing.xl }} />
          ) : servers.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.muted, paddingVertical: spacing.md }}>
              {t("moreScreens.follow.noServers")}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>{t("moreScreens.follow.server")}</Text>
              <PillPicker
                items={servers.map((s) => ({ id: s.id, label: s.name }))}
                selected={[serverId]}
                disabled={follow.isPending}
                emptyLabel=""
                onToggle={(id) => {
                  setServerPick(id);
                  setChannelPick(null);
                }}
              />
              <Text style={{ ...typography.overline, color: colors.muted }}>{t("moreScreens.follow.channel")}</Text>
              <PillPicker
                items={(selected?.channels ?? []).map((c) => ({ id: c.id, label: `#${c.name}` }))}
                selected={[targetChannelId]}
                disabled={follow.isPending}
                emptyLabel=""
                onToggle={setChannelPick}
              />
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button label={t("common.cancel")} variant="ghost" fullWidth onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t("moreScreens.follow.follow")}
                icon="check"
                fullWidth
                loading={follow.isPending}
                disabled={!targetChannelId}
                onPress={submit}
              />
            </View>
          </View>
        </View>
      </RNPressable>
    </Modal>
  );
}
