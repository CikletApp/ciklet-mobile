import { Alert, ScrollView, Text } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { useChannel, useCreateChannel, useDeleteChannel, useUpdateChannel } from "@/api/hooks";
import { Button, KeyboardAvoider, SegmentedTabs, TextField } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";
import { useEffect, useState } from "react";

export default function ChannelSettingsScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const creating = channelId === "new";
  const channel = useChannel(serverId, creating ? undefined : channelId);
  const create = useCreateChannel(serverId);
  const update = useUpdateChannel(serverId, channelId);
  const remove = useDeleteChannel(serverId, channelId);
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(ChannelType.TEXT);

  useEffect(() => {
    if (!channel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(channel.name);
    setType(channel.type);
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = creating ? create : update;
  const submit = () => mutation.mutate({ name: name.trim(), type }, { onSuccess: () => router.back() });
  const protectedChannel = channel?.name.toLocaleLowerCase("tr") === "general";

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: creating ? "Kanal Oluştur" : "Kanalı Düzenle" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <TextField label="KANAL ADI" value={name} onChangeText={setName} autoFocus={creating} maxLength={60} />
        <Text style={{ ...typography.overline, color: colors.muted }}>KANAL TÜRÜ</Text>
        <SegmentedTabs
          items={[
            { id: ChannelType.TEXT, label: "Metin" },
            { id: ChannelType.AUDIO, label: "Ses" },
            { id: ChannelType.VIDEO, label: "Video" },
          ]}
          value={type}
          onChange={setType}
        />
        <Button label={creating ? "Kanalı Oluştur" : "Değişiklikleri Kaydet"} fullWidth size="lg" loading={mutation.isPending} disabled={name.trim().length < 2 || protectedChannel} onPress={submit} />
        {!creating && !protectedChannel ? (
          <Button
            label="Kanalı Sil"
            variant="danger"
            fullWidth
            onPress={() => Alert.alert("Kanalı sil", "Kanal ve mesajları kalıcı olarak silinecek.", [
              { text: "Vazgeç", style: "cancel" },
              { text: "Sil", style: "destructive", onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }) },
            ])}
          />
        ) : null}
        {protectedChannel ? <Text style={{ ...typography.caption, color: colors.muted }}>Varsayılan general kanalı düzenlenemez veya silinemez.</Text> : null}
        {mutation.isError ? <Text style={{ ...typography.caption, color: colors.danger }}>{mutation.error instanceof ApiError ? mutation.error.message : "Kanal kaydedilemedi."}</Text> : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}
