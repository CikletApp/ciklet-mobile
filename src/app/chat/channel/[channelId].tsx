import { useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  useArchiveThread,
  useChannel,
  useMyMembership,
  useServerChannels,
  useServerSummary,
  useThreadParent,
  useThreadState,
  useUnreadCounts,
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
  RulesCurtain,
  useNsfwAcknowledged,
  useTimeoutNotice,
} from "@/features/server/channel-gates";
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
  const { data: membership } = useMyMembership(serverId);
  const timeoutNotice = useTimeoutNotice(
    (membership as { timedOutUntil?: string | null } | undefined)?.timedOutUntil
  );
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
        thread.archived
          ? { key: "unarchive", label: "Arşivden çıkar", icon: "rotate-ccw", onPress: () => setArchived(false) }
          : {
              key: "archive",
              label: "Arşivle",
              detail: "Açan kişi ya da moderatör arşivleyebilir",
              icon: "folder",
              onPress: () => setArchived(true),
            },
      ]
    : [];

  const lockedNotice = isForum
    ? undefined
    : thread.archived
      ? "Bu alt başlık arşivlendi; yazmak için menüden arşivden çıkar."
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
                  ? `${thread.archived ? "Arşivde · " : ""}#${parent?.name ?? "kanal"}`
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
        />
      )}
      {serverId && gate === "ready" ? <RulesCurtain serverId={serverId} /> : null}
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
