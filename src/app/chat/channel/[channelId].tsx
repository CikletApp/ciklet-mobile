import { useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType, MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  useArchiveThread,
  useChannel,
  useLockThread,
  useMyMembership,
  useMyPermissions,
  usePinForumPost,
  useServerChannels,
  useServerSummary,
  useThreadMembership,
  useThreadParent,
  useThreadState,
  useUnreadCounts,
  useGuideVisit,
} from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import {
  ActionSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListSkeleton,
  showToast,
  type ActionSheetItem,
  type IconName,
} from "@/components/ui";
import { ChatView } from "@/features/chat/chat-view";
import { ChatHeaderTitle } from "@/features/chat/components/chat-header-title";
import {
  NsfwCurtain,
  useNsfwAcknowledged,
  useTimeoutNotice,
} from "@/features/server/channel-gates";
import { ServerJoinGate } from "@/features/server/join-flow";
import { QuarantineBanner } from "@/features/server/quarantine-banner";
import { QUARANTINE_COMPOSER_PLACEHOLDER } from "@/lib/quarantine";
import { ForumView } from "@/features/server/forum-view";
import { MediaGallery } from "@/features/server/media-gallery";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kanal sohbeti. `serverId` sorgu parametresi olarak taşınır: mesaj
 * gönderim ucu (`/api/socket/messages`) hem kanal hem sunucu kimliği ister.
 *
 * Aynı rota alt başlıkları da açar (`parentId` + `threadName`): web'de alt
 * başlık üst kanala bağlı bir kanal satırı; mesajlaşma aynı, yalnızca
 * başlık, menü (üst kanala dön, arşivle) ve arşivde salt okunurluk farklı.
 * Forum kanalı sohbet yerine gönderi listesi, medya kanalı galeri
 * görünümüyle açılır.
 *
 * `parentId`'siz gelen bağlantılarda (bahsetme, kaydedilen, arama,
 * bildirim) kanal listede yoksa üst kanal alt başlık listelerinden çözülür.
 * Çözülene ve kapı kaynağı (kanal ya da üst kanal) bilinene kadar sohbet
 * gövdesi çizilmez: yaş sınırlı içerik perdesiz bir an bile görünmesin.
 */
export default function ChannelChatScreen() {
  const {
    channelId,
    serverId,
    parentId: parentIdParam,
    threadName,
  } = useLocalSearchParams<{
    channelId: string;
    serverId?: string;
    parentId?: string;
    threadName?: string;
  }>();

  const channelsQuery = useServerChannels(serverId);
  // Sunucu Rehberi: bu kanala bağlı yapılacaklar açılınca tamamlanır (web kanal sayfası).
  useGuideVisit(serverId, channelId);
  const resolved = useThreadParent(serverId, channelId, parentIdParam, channelsQuery);
  const parentId = resolved.parentId;
  const isThread = resolved.status === "thread";

  const channel = useChannel(serverId, channelId);
  const parent = useChannel(serverId, parentId);
  const { data: server } = useServerSummary(serverId);
  // "Yeni mesajlar" ayracı: kanalda imleç yerine okunmamış SAYISI var.
  const unreadCounts = useUnreadCounts();

  // Kanal ayarlarındaki bayraklar (konu, NSFW, forum, medya…). SDK'nın
  // Channel tipi taşımıyor; uç Prisma satırını olduğu gibi döndürüyor.
  const extras = channel as ChannelExtras | undefined;
  // Alt başlık izinleri ve yaş sınırı üst kanaldan miras (web ile aynı).
  const gateSource = (isThread ? parent : channel) as ChannelExtras | undefined;
  const topic = extras?.topic?.trim();
  const isForum = !isThread && extras?.forum === true;
  const isMedia = !isThread && extras?.mediaOnly === true;
  const [view, setView] = useState<"chat" | "gallery">("chat");

  const thread = useThreadState(serverId, isThread ? parentId : undefined, channelId);
  const archive = useArchiveThread(serverId ?? "");
  const lock = useLockThread(serverId ?? "");
  const pin = usePinForumPost(serverId ?? "");
  const follow = useThreadMembership(serverId ?? "", channelId);
  // "Alt Başlıkları Yönet" (web `canManageThreads`: moderatör+ ya da bit).
  // Yalnızca arayüz ipucu; kanal geçersiz kılmalarını uç denetler.
  const { data: actor } = useMyPermissions(serverId);
  const canManageThreads = Boolean(
    actor &&
      (actor.isOwner ||
        actor.memberRole === MemberRole.ADMIN ||
        actor.memberRole === MemberRole.MODERATOR ||
        actor.keys.includes("MANAGE_THREADS") ||
        actor.keys.includes("ADMINISTRATOR"))
  );
  const threadLocked = thread.thread?.locked === true;
  const forumPinned = thread.thread?.forumPinned === true;
  // Takip = alt başlık üyeliği (web lib/threads); eski sunucuda alan yok → menü öğesi gizli.
  const threadJoined = thread.thread?.joined;
  const threadPrivate = thread.thread?.private === true;
  const isForumPost = isThread && (parent as ChannelExtras | undefined)?.forum === true;
  const [menuOpen, setMenuOpen] = useState(false);
  const title = isThread ? (thread.thread?.name ?? threadName ?? "Alt başlık") : (channel?.name ?? "");

  // Kapılar: yaş sınırı perdesi, kural kabulü, kendi zaman aşımın.
  const nsfw = useNsfwAcknowledged(isThread ? parentId : channelId, gateSource?.nsfw === true);
  // Kapı kaynağı bilinmeden gövde yok. Sunucusuz açılışta bakılacak liste yok.
  const gate: "ready" | "pending" | "unknown" | "error" =
    resolved.status === "pending" || resolved.status === "unknown" || resolved.status === "error"
      ? resolved.status
      : !serverId || gateSource
        ? "ready"
        : channelsQuery.data
          ? "unknown"
          : channelsQuery.isError
            ? "error"
            : "pending";
  const { data: membership, refetch: refetchMembership } = useMyMembership(serverId);
  const timeoutNotice = useTimeoutNotice(membership?.timedOutUntil);
  // AutoMod karantinası (web kanal sayfası): yazma çubuğu kapanır, üstünde bant.
  const quarantined = Boolean(membership?.quarantinedAt);
  // Yalnızca dinler; yazma bildirimi ChatView'daki örnekten gider.
  const { typers } = useTyping(channelId);
  const typing = typingLabel(typers, { ellipsis: false });

  const setArchived = (archived: boolean) => {
    if (!serverId) return;
    archive.mutate(
      { threadId: channelId, archived },
      {
        onSuccess: () => showToast(archived ? "Alt başlık arşivlendi." : "Alt başlık yeniden açıldı."),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Alt başlık güncellenemedi.", "error"),
      }
    );
  };

  const setLocked = (locked: boolean) => {
    if (!serverId) return;
    lock.mutate(
      { threadId: channelId, locked },
      {
        onSuccess: () => showToast(locked ? "Alt başlık kilitlendi." : "Alt başlığın kilidi açıldı."),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Alt başlık güncellenemedi.", "error"),
      }
    );
  };

  const setFollowing = (join: boolean) => {
    if (!serverId) return;
    follow.mutate(
      { userId: "@me", add: join },
      {
        onSuccess: () => {
          showToast(join ? "Alt başlık takip ediliyor." : "Alt başlık takibi bırakıldı.");
          // Özel alt başlıktan ayrılan (moderatör değilse) onu artık göremez.
          if (!join && threadPrivate && !canManageThreads) router.replace(`/chat/channel/${parentId}?serverId=${serverId}`);
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Alt başlık güncellenemedi.", "error"),
      }
    );
  };

  const setPinned = (pinned: boolean) => {
    if (!serverId) return;
    pin.mutate(
      { postId: channelId, pinned },
      {
        onSuccess: () => showToast(pinned ? "Gönderi sabitlendi." : "Gönderinin sabiti kaldırıldı."),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Gönderi güncellenemedi.", "error"),
      }
    );
  };

  // Kilitli alt başlığı yalnızca "Alt Başlıkları Yönet" arşivden çıkarır (uç da reddeder).
  const archiveItem: ActionSheetItem | null = thread.archived
    ? threadLocked && !canManageThreads
      ? null
      : { key: "unarchive", label: "Arşivden çıkar", icon: "rotate-ccw", onPress: () => setArchived(false) }
    : {
        key: "archive",
        label: "Arşivle",
        detail: "Açan kişi ya da moderatör arşivleyebilir",
        icon: "folder",
        onPress: () => setArchived(true),
      };
  const moderationItems: ActionSheetItem[] = canManageThreads
    ? [
        ...(isForumPost
          ? [
              forumPinned
                ? { key: "unpin", label: "Sabitlemeyi kaldır", icon: "pin-off" as const, onPress: () => setPinned(false) }
                : {
                    key: "pin",
                    label: "Sabitle",
                    detail: "Forumun en üstünde durur; öncekinin sabiti kalkar",
                    icon: "pin" as const,
                    onPress: () => setPinned(true),
                  },
            ]
          : []),
        threadLocked
          ? { key: "unlock", label: "Kilidi aç", icon: "unlock", onPress: () => setLocked(false) }
          : {
              key: "lock",
              label: "Kilitle",
              detail: "Yalnızca alt başlıkları yönetebilenler yazabilir",
              icon: "lock",
              onPress: () => setLocked(true),
            },
      ]
    : [];

  const menuItems: ActionSheetItem[] = isThread
    ? [
        {
          key: "parent",
          label: parent ? `#${parent.name} kanalına dön` : "Üst kanala dön",
          icon: "arrow-left",
          onPress: () => router.replace(`/chat/channel/${parentId}?serverId=${serverId}`),
        },
        {
          key: "threads",
          label: "Tüm alt başlıklar",
          icon: "list",
          onPress: () => router.push(`/servers/${serverId}/threads/${parentId}`),
        },
        ...(threadJoined === undefined
          ? []
          : [
              threadJoined
                ? {
                    key: "unfollow",
                    label: "Takibi Bırak",
                    detail: threadPrivate ? "Özel alt başlıktan ayrılırsın" : undefined,
                    icon: "bell-off" as const,
                    onPress: () => setFollowing(false),
                  }
                : {
                    key: "follow",
                    label: "Takip Et",
                    detail: "Kenar listesinde görünür, bildirim gelir",
                    icon: "bell" as const,
                    onPress: () => setFollowing(true),
                  },
            ]),
        {
          key: "members",
          label: "Üyeler",
          icon: "users",
          onPress: () => router.push(`/servers/${serverId}/thread-members/${channelId}`),
        },
        ...moderationItems,
        ...(archiveItem ? [archiveItem] : []),
      ]
    : [];

  const lockedNotice = isForum
    ? undefined
    : quarantined
      ? QUARANTINE_COMPOSER_PLACEHOLDER
      : thread.archived
        ? "Bu alt başlık arşivlendi; yazmak için menüden arşivden çıkar."
        : threadLocked && !canManageThreads
          ? "Bu alt başlık kilitli; yalnızca alt başlıkları yönetebilenler yazabilir."
          : timeoutNotice;

  const headerIcon: IconName = isThread ? "message" : isForum ? "list" : isMedia ? "image" : "hash";

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: title ? `# ${title}` : "",
          headerStyle: { backgroundColor: colors.panel },
          headerTitleAlign: "left",
          headerTitle: () => (
            <ChatHeaderTitle
              avatar={
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radii.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <Icon name={headerIcon} size={19} color={colors.brand} />
                </View>
              }
              title={title}
              subtitle={
                typing ??
                (isThread
                  ? `${threadPrivate ? "Özel · " : ""}${forumPinned ? "Sabitlendi · " : ""}${threadLocked ? "Kilitli · " : ""}${thread.archived ? "Arşivde · " : ""}#${parent?.name ?? "kanal"}`
                  : topic || server?.name)
              }
              subtitleTone={typing ? "live" : "muted"}
              typing={Boolean(typing)}
              onPress={serverId ? () => router.back() : undefined}
              accessibilityLabel={server ? `${server.name} kanal listesine dön` : undefined}
            />
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {isMedia ? (
                <IconButton
                  icon={view === "chat" ? "image" : "message"}
                  label={view === "chat" ? "Galeri görünümü" : "Sohbet görünümü"}
                  background="transparent"
                  tint={colors.bright}
                  onPress={() => setView((current) => (current === "chat" ? "gallery" : "chat"))}
                />
              ) : null}
              <IconButton
                icon="search"
                label="Sunucuda ara"
                background="transparent"
                tint={colors.bright}
                onPress={() =>
                  serverId
                    ? router.push(`/servers/${serverId}/search?channel=${channelId}`)
                    : router.push("/search")
                }
              />
              {isThread ? (
                <IconButton
                  icon="more"
                  label="Alt başlık seçenekleri"
                  background="transparent"
                  tint={colors.bright}
                  onPress={() => setMenuOpen(true)}
                />
              ) : !isForum && serverId ? (
                <IconButton
                  icon="list"
                  label="Alt başlıklar"
                  background="transparent"
                  tint={colors.bright}
                  onPress={() => router.push(`/servers/${serverId}/threads/${channelId}`)}
                />
              ) : null}
              {!isForum ? (
                <IconButton
                  icon="compass"
                  label="Aktiviteler"
                  background="transparent"
                  tint={colors.bright}
                  onPress={() => router.push(`/activities?chatId=${channelId}&serverId=${serverId ?? ""}`)}
                />
              ) : null}
            </View>
          ),
        }}
      />
      {gate === "pending" ? (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ListSkeleton rows={7} />
        </View>
      ) : gate === "error" ? (
        <ErrorState message="Kanal bilgisi yüklenemedi." onRetry={() => void channelsQuery.refetch()} />
      ) : gate === "unknown" ? (
        <EmptyState
          icon="eye-off"
          title="Kanal bulunamadı"
          description="Bu kanal silinmiş ya da artık göremiyor olabilirsin."
          action={<Button label="Geri dön" variant="ghost" onPress={() => router.back()} />}
        />
      ) : isForum && serverId ? (
        <ForumView serverId={serverId} channelId={channelId} />
      ) : isMedia && view === "gallery" ? (
        <MediaGallery channelId={channelId} />
      ) : (
        <ChatView
          kind="channel"
          chatId={channelId}
          serverId={serverId}
          unreadSeed={unreadCounts.data ? { count: unreadCounts.data.channelUnreads?.[channelId]?.count ?? 0 } : undefined}
          placeholder={
            isMedia
              ? `#${channel?.name ?? "kanal"} · bir görsel ya da dosya ekle`
              : isThread
                ? `${title} alt başlığına yaz`
                : `#${channel?.name ?? "kanal"} kanalına yaz`
          }
          requireAttachment={isMedia}
          canStartThread={channel?.type === ChannelType.TEXT && !isThread && !isForum}
          lockedNotice={lockedNotice}
          lockedBanner={
            quarantined && !isForum ? (
              <QuarantineBanner quarantine={membership?.quarantine} onRefresh={refetchMembership} />
            ) : undefined
          }
        />
      )}
      {/* Katılım soruları + kural perdesi (web server-join-gate; sıra `beforeRules`). */}
      {serverId && gate === "ready" ? <ServerJoinGate serverId={serverId} channels={channelsQuery.data} /> : null}
      {gate === "ready" && !nsfw.acknowledged ? (
        <NsfwCurtain
          channelName={(isThread ? parent?.name : channel?.name) ?? "kanal"}
          onAccept={nsfw.acknowledge}
          onBack={() => router.back()}
        />
      ) : null}

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {title}
          </Text>
        }
        items={menuItems}
      />
    </View>
  );
}
