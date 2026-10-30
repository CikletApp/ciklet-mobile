import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { Image } from "expo-image";
import { ChannelType, MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useDeleteServer,
  useLeaveServer,
  useMyMembership,
  useMyPermissions,
  useServerChannels,
  useServerDetails,
  useUpdateServer,
} from "@/api/hooks";
import { Avatar, Divider, Icon, type IconName, ListGroup, ListRow, Screen, ScreenLoader, SectionHeader, TextField, showDialog } from "@/components/ui";
import { pickAndUploadServerBanner, pickAndUploadServerImage } from "@/lib/uploads";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { ChannelExtras } from "@/api/types";
import { AFK_TIMEOUT_DEFAULT, AFK_TIMEOUT_OPTIONS } from "@/lib/voice-settings";

export default function ServerSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server, isLoading } = useServerDetails(serverId);
  const { data: membership } = useMyMembership(serverId);
  const { data: channels } = useServerChannels(serverId);
  const { data: permissions } = useMyPermissions(serverId);
  const myId = useAuth((state) => state.profile?.id);
  const update = useUpdateServer(serverId);
  const remove = useDeleteServer(serverId);
  const leave = useLeaveServer(serverId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [systemChannelId, setSystemChannelId] = useState<string | null>(null);
  // AFK kanalı + zaman aşımı (web Sunucu Ayarları → Genel Görünüm ile aynı).
  const [afkChannelId, setAfkChannelId] = useState<string | null>(null);
  const [afkTimeout, setAfkTimeout] = useState(AFK_TIMEOUT_DEFAULT);
  const [mediaBusy, setMediaBusy] = useState<"image" | "banner" | null>(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (!server) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(server.name);
    setDescription(server.description ?? "");
    setIsPublic(server.isPublic);
    setIsDiscoverable(server.isDiscoverable);
    setSystemChannelId(server.systemChannelId);
    setAfkChannelId(server.afkChannelId ?? null);
    setAfkTimeout(server.afkTimeout ?? AFK_TIMEOUT_DEFAULT);
  }, [server?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !server) return <ScreenLoader label="Sunucu ayarları yükleniyor…" />;

  const isOwner = server.profileId === myId;
  // Uçla aynı kapı (getServerManager): sahip, yönetici ya da "Sunucuyu Yönet".
  const canEdit = isOwner || membership?.role === MemberRole.ADMIN || hasServerPermission(permissions, "MANAGE_SERVER");
  const canManageServer = hasServerPermission(permissions, "MANAGE_SERVER");
  // Web Sunucu Ayarları › Davetler sekmesiyle aynı kapı (davet listesi ucu:
  // Sunucuyu Yönet ya da Kanalları Yönet).
  const canManageInvites = canManageServer || hasServerPermission(permissions, "MANAGE_CHANNELS");
  const moderationLinks: SettingsLink[] = [
    ...(hasServerPermission(permissions, "MANAGE_ROLES") ? [{ icon: "shield" as const, title: "Roller", href: `/servers/${serverId}/roles` }] : []),
    ...(canManageServer ? [{ icon: "flag" as const, title: "Moderasyon", href: `/servers/${serverId}/moderation` }] : []),
    ...(hasServerPermission(permissions, "VIEW_AUDIT_LOG") ? [{ icon: "list" as const, title: "Denetim Kaydı", href: `/servers/${serverId}/audit-log` }] : []),
  ];
  const savedAfkChannelId = server.afkChannelId ?? null;
  const savedAfkTimeout = server.afkTimeout ?? AFK_TIMEOUT_DEFAULT;
  // AFK kanalı olabilecekler: ses/görüntü kanalı; sahne ve alt başlık değil.
  const afkCandidates = (channels ?? []).filter((channel) => {
    const extras = channel as ChannelExtras;
    return channel.type !== ChannelType.TEXT && !extras.stage && !extras.parentChannelId;
  });
  const dirty =
    name !== server.name ||
    description !== (server.description ?? "") ||
    isPublic !== server.isPublic ||
    isDiscoverable !== server.isDiscoverable ||
    systemChannelId !== server.systemChannelId ||
    afkChannelId !== savedAfkChannelId ||
    afkTimeout !== savedAfkTimeout;

  const save = () => {
    if (!canEdit || !dirty || update.isPending) return;
    update.mutate({
      name: name.trim(),
      description: description.trim() || null,
      isPublic,
      isDiscoverable: isPublic && isDiscoverable,
      systemChannelId,
      ...(afkChannelId !== savedAfkChannelId ? { afkChannelId } : {}),
      ...(afkTimeout !== savedAfkTimeout ? { afkTimeout } : {}),
    });
  };

  const leaveOrDelete = () => {
    const destructive = isOwner ? remove : leave;
    showDialog(
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

  const changeMedia = async (kind: "image" | "banner") => {
    if (mediaBusy || update.isPending) return;
    setMediaBusy(kind);
    setMediaProgress(0);
    setMediaError(null);
    try {
      const url = await (kind === "image"
        ? pickAndUploadServerImage(setMediaProgress)
        : pickAndUploadServerBanner(setMediaProgress));
      if (url) await update.mutateAsync(kind === "image" ? { imageUrl: url } : { bannerUrl: url });
    } catch (reason) {
      setMediaError(reason instanceof Error ? reason.message : "Görsel değiştirilemedi.");
    } finally {
      setMediaBusy(null);
    }
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
              <View style={{ alignItems: "flex-start" }}>
                <Pressable
                  onPress={() => void changeMedia("banner")}
                  accessibilityRole="button"
                  accessibilityLabel="Sunucu afişini değiştir"
                  style={{ height: 112, alignSelf: "stretch", borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.brand }}
                >
                  {server.bannerUrl ? <Image source={{ uri: server.bannerUrl }} contentFit="cover" style={{ flex: 1 }} /> : null}
                  <View style={{ position: "absolute", right: spacing.sm, top: spacing.sm, width: 32, height: 32, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim }}>
                    {mediaBusy === "banner" ? <ActivityIndicator size="small" color={colors.bright} /> : <Icon name="pencil" size={15} color={colors.bright} />}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => void changeMedia("image")}
                  accessibilityRole="button"
                  accessibilityLabel="Sunucu ikonunu değiştir"
                  style={{ marginTop: -30, marginLeft: spacing.md }}
                >
                  <Avatar imageUrl={server.imageUrl} fallbackText={server.name} size={72} shape="squircle" backgroundColor={colors.panel} />
                  <View style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: radii.full, borderWidth: 2, borderColor: colors.panel, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand }}>
                    {mediaBusy === "image" ? <ActivityIndicator size="small" color={colors.onBrand} /> : <Icon name="pencil" size={14} color={colors.onBrand} />}
                  </View>
                </Pressable>
              </View>
              {mediaBusy ? <Text style={{ ...typography.caption, color: colors.muted }}>Görsel yükleniyor… %{Math.round(mediaProgress)}</Text> : mediaError ? <Text style={{ ...typography.caption, color: colors.danger }}>{mediaError}</Text> : null}
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

            <SectionHeader title="AFK KANALI" />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <ListGroup>
                <ListRow title="AFK kanalı yok" detail={!afkChannelId ? "Seçili" : undefined} chevron={false} onPress={() => setAfkChannelId(null)} />
                {afkCandidates.map((channel) => (
                  <View key={channel.id}>
                    <Divider inset={52} />
                    <ListRow icon="volume" title={channel.name} detail={afkChannelId === channel.id ? "Seçili" : undefined} chevron={false} onPress={() => setAfkChannelId(channel.id)} />
                  </View>
                ))}
              </ListGroup>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Sesli kanalda belirlenen süre boyunca boşta kalan üyeler bu kanala taşınır ve orada konuşamaz.
              </Text>
            </View>

            <SectionHeader title="AFK ZAMAN AŞIMI" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                {AFK_TIMEOUT_OPTIONS.map((option, index) => (
                  <View key={option.value}>
                    {index > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={option.label}
                      detail={afkTimeout === option.value ? "Seçili" : undefined}
                      chevron={false}
                      disabled={!afkChannelId}
                      onPress={() => setAfkTimeout(option.value)}
                    />
                  </View>
                ))}
              </ListGroup>
            </View>
          </>
        ) : null}

        {/* Web Sunucu Ayarları menüsünün grupları ve sekme izinleri
            (lib/role-permissions SERVER_SETTINGS_TAB_BITS) — her ekranın
            arkasındaki uç aynı bitleri yeniden denetler. */}
        {canManageServer ? (
          <>
            <SectionHeader title="GENEL" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SettingsLinks
                links={[
                  { icon: "home", title: "Karşılama Ekranı", href: `/servers/${serverId}/welcome-screen` },
                  { icon: "compass", title: "Katılım Soruları", href: `/servers/${serverId}/onboarding` },
                  { icon: "list", title: "Sunucu Rehberi", href: `/servers/${serverId}/guide-settings` },
                ]}
              />
            </View>
          </>
        ) : null}

        {moderationLinks.length > 0 ? (
          <>
            <SectionHeader title="MODERASYON" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SettingsLinks links={moderationLinks} />
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
            {canManageInvites ? (
              <>
                <Divider inset={52} />
                <ListRow icon="user-plus" title="Davetler" onPress={() => router.push(`/servers/${serverId}/invites`)} />
              </>
            ) : null}
            {canManageServer ? (
              <>
                <Divider inset={52} />
                <ListRow icon="copy" title="Şablonlar" onPress={() => router.push(`/servers/${serverId}/templates`)} />
              </>
            ) : null}
          </ListGroup>
        </View>

        {canManageServer || hasServerPermission(permissions, "MANAGE_WEBHOOKS") ? (
          <>
            <SectionHeader title="ENTEGRASYON" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                <ListRow icon="link" title="Entegrasyonlar" onPress={() => router.push(`/servers/${serverId}/integrations`)} />
              </ListGroup>
            </View>
          </>
        ) : null}

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

interface SettingsLink {
  icon: IconName;
  title: string;
  href: string;
}

function SettingsLinks({ links }: { links: SettingsLink[] }) {
  return (
    <ListGroup>
      {links.map((link, index) => (
        <View key={link.href}>
          {index > 0 ? <Divider inset={16} /> : null}
          <ListRow icon={link.icon} title={link.title} onPress={() => router.push(link.href as Href)} />
        </View>
      ))}
    </ListGroup>
  );
}

function ToggleRow({ title, value, onChange, disabled }: { title: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{title}</Text>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
    </View>
  );
}
