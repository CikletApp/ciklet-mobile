import { useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useFollowChannel, useFollowTargets } from "@/api/hooks/use-channel-admin";
import { Button, Icon, showToast } from "@/components/ui";
import { PillPicker } from "@/features/moderation/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
  const serverId = serverPick && servers.some((s) => s.id === serverPick) ? serverPick : (servers[0]?.id ?? "");
  const selected = servers.find((s) => s.id === serverId);
  const targetChannelId =
    channelPick && selected?.channels.some((c) => c.id === channelPick) ? channelPick : (selected?.channels[0]?.id ?? "");

  const submit = () => {
    if (!targetChannelId) return;
    follow.mutate(targetChannelId, {
      onSuccess: () => {
        showToast("Takip edildi; yayınlanan duyurular seçtiğin kanala düşecek.");
        onClose();
      },
      onError: (error) => showToast(error instanceof ApiError ? error.message : "Takip edilemedi", "error"),
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
            <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>Kanalı takip et</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            #{channelName} kanalında yayınlanan duyurular seçtiğin kanala gelsin.
          </Text>

          {targets.isLoading ? (
            <ActivityIndicator color={colors.muted} style={{ paddingVertical: spacing.xl }} />
          ) : servers.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.muted, paddingVertical: spacing.md }}>
              Yöneticisi olduğun başka bir sunucu yok.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>SUNUCU</Text>
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
              <Text style={{ ...typography.overline, color: colors.muted }}>KANAL</Text>
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
              <Button label="Vazgeç" variant="ghost" fullWidth onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Takip et"
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
