import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType, MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  useDeleteServer,
  useLeaveServer,
  useMyMembership,
  useServerChannels,
  useServerDetails,
  useUpdateServer,
} from "@/api/hooks";
import { Divider, ListGroup, ListRow, Screen, ScreenLoader, SectionHeader, TextField } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";

export default function ServerSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server, isLoading } = useServerDetails(serverId);
  const { data: membership } = useMyMembership(serverId);
  const { data: channels } = useServerChannels(serverId);
  const myId = useAuth((state) => state.profile?.id);
  const update = useUpdateServer(serverId);
  const remove = useDeleteServer(serverId);
  const leave = useLeaveServer(serverId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [systemChannelId, setSystemChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (!server) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(server.name);
    setDescription(server.description ?? "");
    setIsPublic(server.isPublic);
    setIsDiscoverable(server.isDiscoverable);
    setSystemChannelId(server.systemChannelId);
  }, [server?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !server) return <ScreenLoader label="Sunucu ayarları yükleniyor…" />;

  const isOwner = server.profileId === myId;
  const canEdit = isOwner || membership?.role === MemberRole.ADMIN;
  const dirty =
    name !== server.name ||
    description !== (server.description ?? "") ||
    isPublic !== server.isPublic ||
    isDiscoverable !== server.isDiscoverable ||
    systemChannelId !== server.systemChannelId;

  const save = () => {
    if (!canEdit || !dirty || update.isPending) return;
    update.mutate({
      name: name.trim(),
      description: description.trim() || null,
      isPublic,
      isDiscoverable: isPublic && isDiscoverable,
      systemChannelId,
    });
  };

  const leaveOrDelete = () => {
    const destructive = isOwner ? remove : leave;
    Alert.alert(
      isOwner ? "Sunucuyu sil" : "Sunucudan ayrıl",
      isOwner
        ? "Sunucu, kanalları ve mesajları kalıcı olarak silinecek."
        : "Bu sunucu sunucu rayından kaldırılacak.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: isOwner ? "Sunucuyu Sil" : "Ayrıl",
          style: "destructive",
          onPress: () => destructive.mutate(undefined, { onSuccess: () => router.replace("/") }),
        },
      ]
    );
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Sunucu Ayarları",
          headerRight: canEdit
            ? () => (
                <Pressable onPress={save} disabled={!dirty || update.isPending} accessibilityRole="button">
                  {update.isPending ? <ActivityIndicator color={colors.brand} /> : <Text style={{ ...typography.bodyStrong, color: dirty ? colors.brand : colors.muted }}>Kaydet</Text>}
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        {canEdit ? (
          <>
            <SectionHeader title="GENEL BAKIŞ" />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
              <TextField label="SUNUCU ADI" value={name} onChangeText={setName} maxLength={60} />
              <TextField label="AÇIKLAMA" value={description} onChangeText={setDescription} multiline maxLength={300} />
            </View>

            <SectionHeader title="GİZLİLİK VE KEŞFET" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                <ToggleRow title="Herkese açık" value={isPublic} onChange={(value) => { setIsPublic(value); if (!value) setIsDiscoverable(false); }} />
                <Divider inset={16} />
                <ToggleRow title="Keşfette göster" value={isDiscoverable} disabled={!isPublic} onChange={setIsDiscoverable} />
              </ListGroup>
            </View>

            <SectionHeader title="SİSTEM KANALI" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                <ListRow title="Kapalı" detail={!systemChannelId ? "Seçili" : undefined} chevron={false} onPress={() => setSystemChannelId(null)} />
                {(channels ?? []).filter((channel) => channel.type === ChannelType.TEXT).map((channel) => (
                  <View key={channel.id}>
                    <Divider inset={52} />
                    <ListRow icon="hash" title={channel.name} detail={systemChannelId === channel.id ? "Seçili" : undefined} chevron={false} onPress={() => setSystemChannelId(channel.id)} />
                  </View>
                ))}
              </ListGroup>
            </View>
          </>
        ) : null}

        <SectionHeader title="DAVET" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow
              icon="link"
              title="Davet bağlantısını paylaş"
              subtitle={`https://ciklet.xyz/i/${server.inviteCode}`}
              onPress={() => void Share.share({ message: `https://ciklet.xyz/i/${server.inviteCode}` })}
            />
          </ListGroup>
        </View>

        <SectionHeader title="TEHLİKELİ BÖLGE" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ListRow icon="logout" iconTint={colors.danger} titleColor={colors.danger} title={isOwner ? "Sunucuyu Sil" : "Sunucudan Ayrıl"} chevron={false} onPress={leaveOrDelete} />
          </ListGroup>
        </View>

        {update.isError ? <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>{update.error instanceof ApiError ? update.error.message : "Sunucu kaydedilemedi."}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({ title, value, onChange, disabled }: { title: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{title}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.deep, true: colors.brand }} thumbColor={colors.bright} />
    </View>
  );
}
