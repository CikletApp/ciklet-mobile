import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { Image } from "expo-image";
import { ChannelType, MemberRole } from "@ciklet/embedded-activities-sdk/types";

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
import { pickAndUploadEventCover, pickAndUploadServerBanner, pickAndUploadServerImage } from "@/lib/uploads";
import {
  normalizeVanityCode,
  useServerNsfw,
  useUpdateServerOverview,
  type ServerOverviewExtras,
} from "@/api/hooks/use-server-overview";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import type { ChannelExtras } from "@/api/types";
import { AFK_TIMEOUT_DEFAULT, AFK_TIMEOUT_OPTIONS } from "@/lib/voice-settings";
import { DefaultNotificationsSection } from "@/features/server/default-notifications-section";
import { ServerTagSection } from "@/features/server-tag/server-tag-section";
import { BoostLockedPill } from "@/features/server-boost/boost-ui";
import { useT } from "@/lib/i18n";
import { BOOST_PINK, effectiveServerPerks, requiredTier } from "@/lib/server-boost";
import { userErrorMessage } from "@/lib/user-error";
import { siteHost, siteOrigin } from "@/lib/config";

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
  const overview = useUpdateServerOverview(serverId);
  const t = useT();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [systemChannelId, setSystemChannelId] = useState<string | null>(null);
  // AFK kanalı + zaman aşımı (web Sunucu Ayarları → Genel Görünüm ile aynı).
  const [afkChannelId, setAfkChannelId] = useState<string | null>(null);
  const [afkTimeout, setAfkTimeout] = useState(AFK_TIMEOUT_DEFAULT);
  // Özel davet adresi + yaş sınırlı sunucu (web Genel Görünüm; Kaydet ile).
  const [vanityCode, setVanityCode] = useState("");
  const [nsfw, setNsfw] = useState<boolean | null>(null);
  const [mediaBusy, setMediaBusy] = useState<"image" | "banner" | "splash" | null>(null);
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
    setVanityCode(server.vanityCode ?? "");
  }, [server?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedNsfwQuery = useServerNsfw(serverId, hasServerPermission(permissions, "MANAGE_SERVER") || server?.profileId === myId);
  const savedNsfw = savedNsfwQuery.data ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNsfw(savedNsfw);
  }, [savedNsfw]);

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
    ...(hasServerPermission(permissions, "BAN_MEMBERS") ? [{ icon: "lock" as const, title: "Yasaklar", href: `/servers/${serverId}/bans` }] : []),
    ...(canManageServer ? [{ icon: "flag" as const, title: "Moderasyon", href: `/servers/${serverId}/moderation` }] : []),
    ...(hasServerPermission(permissions, "VIEW_AUDIT_LOG") ? [{ icon: "list" as const, title: "Denetim Kaydı", href: `/servers/${serverId}/audit-log` }] : []),
    // "my-permissions" anahtarları tüm bit adlarını taşır (tip listesi daha dar).
    ...(permissions && (permissions.isOwner || permissions.keys.includes("VIEW_SERVER_INSIGHTS"))
      ? [{ icon: "trending-up" as const, title: "İstatistikler", href: `/servers/${serverId}/insights` }]
      : []),
  ];
  // İfadeler (web Sunucu Ayarları › Emoji): İfade Oluştur ya da İfadeleri Yönet.
  const canSeeEmojis = hasServerPermission(permissions, "MANAGE_EXPRESSIONS") || hasServerPermission(permissions, "CREATE_EXPRESSIONS");
  // Takviye kapıları (lib/server-boost; uç 403 premium_tier_required): afiş
  // Seviye 2. Seviyesi düşen sunucunun mevcut afişi kalır — kilit yalnızca
  // afiş yokken gösterilir (web ile aynı).
  // Etkin sınır sunucudan (premiumPerks); istemci seviyeden türetmez.
  const perks = effectiveServerPerks(server);
  const bannerLocked = !perks.banner && !server.bannerUrl;
  const splashUrl = (server as ServerOverviewExtras).inviteSplashUrl ?? null;
  const savedVanityCode = server.vanityCode ?? "";
  const vanityDisabled = !perks.vanityUrl && !savedVanityCode;
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
  const extrasDirty = vanityCode !== savedVanityCode || (nsfw !== null && savedNsfw !== null && nsfw !== savedNsfw);
  const saving = update.isPending || overview.isPending;

  const save = async () => {
    if (!canEdit || (!dirty && !extrasDirty) || saving) return;
    try {
      if (dirty) {
        await update.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
          isDiscoverable: isPublic && isDiscoverable,
          systemChannelId,
          ...(afkChannelId !== savedAfkChannelId ? { afkChannelId } : {}),
          ...(afkTimeout !== savedAfkTimeout ? { afkTimeout } : {}),
        });
      }
      if (extrasDirty) {
        await overview.mutateAsync({
          ...(vanityCode !== savedVanityCode ? { vanityCode } : {}),
          ...(nsfw !== null && nsfw !== savedNsfw ? { nsfw } : {}),
        });
        // Sunucu kanonik biçimi kaydeder (web: "Kaydedilince: …").
        setVanityCode(normalizeVanityCode(vanityCode));
      }
    } catch {
      // Hata metni ekranın altında (update / overview.error).
    }
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

  const changeMedia = async (kind: "image" | "banner" | "splash") => {
    if (mediaBusy || saving) return;
    setMediaBusy(kind);
    setMediaProgress(0);
    setMediaError(null);
    try {
      const url = await (kind === "image"
        ? pickAndUploadServerImage(setMediaProgress)
        : kind === "banner"
          ? pickAndUploadServerBanner(setMediaProgress)
          : // Davet arka planı: web ile aynı `serverBanner` rotası, 16:9.
            pickAndUploadEventCover(setMediaProgress));
      if (url && kind === "splash") await overview.mutateAsync({ inviteSplashUrl: url });
      else if (url) await update.mutateAsync(kind === "image" ? { imageUrl: url } : { bannerUrl: url });
    } catch (reason) {
      setMediaError(userErrorMessage(reason, "Görsel değiştirilemedi."));
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
                <Pressable onPress={() => void save()} disabled={(!dirty && !extrasDirty) || saving} accessibilityRole="button">
                  {saving ? <ActivityIndicator color={colors.brand} /> : <Text style={{ ...typography.bodyStrong, color: dirty || extrasDirty ? colors.brand : colors.muted }}>Kaydet</Text>}
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
                  disabled={bannerLocked}
                  accessibilityRole="button"
                  accessibilityLabel="Sunucu afişini değiştir"
                  accessibilityState={{ disabled: bannerLocked }}
                  style={{ height: 112, alignSelf: "stretch", borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.brand }}
                >
                  {server.bannerUrl ? <Image source={{ uri: server.bannerUrl }} contentFit="cover" style={{ flex: 1 }} /> : null}
                  {bannerLocked ? (
                    <View style={{ position: "absolute", right: spacing.sm, top: spacing.sm }}>
                      <BoostLockedPill tier={requiredTier("banner")} />
                    </View>
                  ) : (
                    <View style={{ position: "absolute", right: spacing.sm, top: spacing.sm, width: 32, height: 32, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim }}>
                      {mediaBusy === "banner" ? <ActivityIndicator size="small" color={colors.bright} /> : <Icon name="pencil" size={15} color={colors.bright} />}
                    </View>
                  )}
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

            <SectionHeader title="ÖZEL DAVET ADRESİ" />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {!perks.vanityUrl ? (
                <View style={{ alignSelf: "flex-start" }}>
                  <BoostLockedPill tier={requiredTier("vanityUrl")} />
                </View>
              ) : null}
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Akılda kalır bir bağlantı: harf, rakam ve tire; 3-32 karakter. Yalnızca sunucu sahibi değiştirebilir.
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, opacity: vanityDisabled ? 0.5 : 1 }}>
                <Text style={{ ...typography.body, color: colors.muted }}>{`${siteHost()}/i/`}</Text>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={vanityCode}
                    onChangeText={(value) => setVanityCode(value.slice(0, 40))}
                    maxLength={40}
                    placeholder="sunucum"
                    editable={!vanityDisabled}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              {vanityCode && normalizeVanityCode(vanityCode) !== vanityCode ? (
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.muted }}>
                  Kaydedilince: {normalizeVanityCode(vanityCode) || "—"}
                </Text>
              ) : null}
            </View>

            <SectionHeader title="DAVET ARKA PLANI" />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Davet bağlantısı açıldığında katılma kartının arkasında görünür. 1920x1080 önerilir.
              </Text>
              <Pressable
                onPress={() => void changeMedia("splash")}
                disabled={!perks.inviteSplash}
                accessibilityRole="button"
                accessibilityLabel={splashUrl ? "Davet arka planını değiştir" : "Davet arka planı yükle"}
                accessibilityState={{ disabled: !perks.inviteSplash }}
                style={{ aspectRatio: 16 / 9, alignSelf: "stretch", borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.deep, alignItems: "center", justifyContent: "center" }}
              >
                {splashUrl ? (
                  <Image source={{ uri: splashUrl }} contentFit="cover" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
                ) : mediaBusy === "splash" ? (
                  <ActivityIndicator color={colors.muted} />
                ) : (
                  <Icon name="image" size={30} color={colors.muted} />
                )}
                {!perks.inviteSplash ? (
                  <View style={{ position: "absolute", right: spacing.sm, top: spacing.sm }}>
                    <BoostLockedPill tier={requiredTier("inviteSplash")} />
                  </View>
                ) : (
                  <View style={{ position: "absolute", right: spacing.sm, bottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.md, backgroundColor: colors.scrim }}>
                    {mediaBusy === "splash" && splashUrl ? (
                      <ActivityIndicator size="small" color={colors.bright} />
                    ) : (
                      <Text style={{ ...typography.caption, color: colors.bright }}>{splashUrl ? "Değiştir" : "Yükle"}</Text>
                    )}
                  </View>
                )}
                {splashUrl ? (
                  <Pressable
                    onPress={() => overview.mutate({ inviteSplashUrl: null })}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Davet arka planını kaldır"
                    hitSlop={8}
                    style={{ position: "absolute", right: spacing.sm, top: spacing.sm, width: 26, height: 26, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger }}
                  >
                    <Icon name="close" size={14} color={colors.bright} />
                  </Pressable>
                ) : null}
              </Pressable>
            </View>

            <SectionHeader title="GİZLİLİK VE KEŞFET" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                <ToggleRow title="Herkese açık" value={isPublic} onChange={(value) => { setIsPublic(value); if (!value) setIsDiscoverable(false); }} />
                <Divider inset={16} />
                <ToggleRow title="Keşfette göster" value={isDiscoverable} disabled={!isPublic} onChange={setIsDiscoverable} />
                {nsfw !== null ? (
                  <>
                    <Divider inset={16} />
                    {/* Yaş sınırlı sunucu: yetişkinliği doğrulanmamış hesaplar
                        katılamaz ve kanallarını okuyamaz (web lib/age-policy). */}
                    <ToggleRow
                      title={t("compliance.serverNsfw.label")}
                      subtitle={t("compliance.serverNsfw.desc")}
                      value={nsfw}
                      onChange={setNsfw}
                      danger
                    />
                  </>
                ) : null}
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

            <DefaultNotificationsSection serverId={serverId} level={server.defaultNotificationLevel} />

            {/* Sunucu etiketi (web lib/server-tag): kendi Kaydet düğmesiyle. */}
            <ServerTagSection server={server} />

            {/* Sunucu Takviyesi: ilerleme çubuğu anahtarı hemen kaydedilir. */}
            <SectionHeader title={t("serverBoost.title").toLocaleUpperCase("tr-TR")} />
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <ListGroup>
                <ToggleRow
                  title={t("serverBoost.settings.progressBar")}
                  value={server.premiumProgressBarEnabled === true}
                  disabled={update.isPending}
                  onChange={(value) => update.mutate({ premiumProgressBarEnabled: value })}
                />
                <Divider inset={16} />
                <ListRow icon="gem" iconTint={BOOST_PINK} title={t("serverBoost.menuItem")} onPress={() => router.push(`/servers/${serverId}/boost`)} />
              </ListGroup>
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("serverBoost.settings.progressBarHint")}</Text>
            </View>
          </>
        ) : null}

        {canSeeEmojis ? (
          <>
            <SectionHeader title="İFADELER" />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SettingsLinks
                links={[
                  { icon: "emoji", title: "Emoji", href: `/servers/${serverId}/emojis` },
                  { icon: "image", title: "Çıkartmalar", href: `/servers/${serverId}/stickers` },
                  { icon: "volume", title: "Soundboard", href: `/servers/${serverId}/soundboard` },
                ]}
              />
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
              subtitle={`${siteOrigin()}/i/${server.inviteCode}`}
              onPress={() => void Share.share({ message: `${siteOrigin()}/i/${server.inviteCode}` })}
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
                <Divider inset={52} />
                <ListRow icon="monitor" title="Widget" onPress={() => router.push(`/servers/${serverId}/widget`)} />
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

        {update.isError || overview.isError ? (
          <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>
            {userErrorMessage(update.error ?? overview.error, "Sunucu kaydedilemedi.")}
          </Text>
        ) : null}
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

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
  danger,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Web yaş sınırı anahtarı açıkken kırmızı. */
  danger?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: danger ? colors.danger : colors.brand }} thumbColor="#ffffff" />
    </View>
  );
}
