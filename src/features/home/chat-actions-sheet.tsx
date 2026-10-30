import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import {
  isDirectUnread,
  useAnnotations,
  useBlockUser,
  useMarkDirectRead,
  useSetIgnored,
  type DirectDisplay,
} from "@/api/hooks";
import type { DirectSummary } from "@/api/types";
import {
  ActionSheet,
  Avatar,
  GroupAvatar,
  showDialog,
  showToast,
  type ActionSheetItem,
} from "@/components/ui";
import { openNotificationSettings } from "@/features/notifications/notification-sheet";
import { isOfficialProfile } from "@/lib/official";
import { usePreferences } from "@/stores/preferences";
import { fw } from "@/theme/fonts";
import { colors, spacing, typography } from "@/theme/tokens";

export interface ChatActionsTarget {
  item: DirectSummary;
  display: DirectDisplay;
}

/**
 * Sohbet satırının basılı tutma menüsü.
 *
 * Yalnızca sunucunun gerçekten desteklediği eylemler var (web'deki
 * `direct-context-menu.tsx` ile aynı küme): arşiv, kilit, sohbet başına
 * sessize alma ve "sil" platformda YOK. "Yok say" kişi başınadır, sohbet
 * başına değil — o yüzden grupta gösterilmez. "Sabitle" bu cihaza özel.
 */
export function ChatActionsSheet({
  target,
  onClose,
  myId,
  unread: unreadState,
  onTogglePinned,
  onRemove,
}: {
  target: ChatActionsTarget | null;
  onClose: () => void;
  myId: string | undefined;
  /** `useDirectUnreadCounts()` — satır rozetiyle aynı karar verilsin. */
  unread: { counts: Record<string, number>; ready: boolean };
  onTogglePinned: (directId: string) => void;
  onRemove: (item: DirectSummary, display: DirectDisplay) => void;
}) {
  // Kapanış animasyonu sürerken içerik boşalmasın diye son hedef tutulur.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);

  const { data: annotations } = useAnnotations();
  const markRead = useMarkDirectRead();
  const setIgnored = useSetIgnored();
  const block = useBlockUser();
  const pinnedDirectIds = usePreferences((s) => s.pinnedDirectIds);

  const current = target ?? shown;
  if (!current) return <ActionSheet visible={false} onClose={onClose} items={[]} />;

  const { item, display } = current;
  const peer = display.peer;
  const isOfficial = !display.isGroup && isOfficialProfile(peer);
  const ignored = peer ? annotations?.[peer.id]?.ignored === true : false;
  const latestId = item.latestMessageId ?? item.latestMessage?.id ?? null;
  const unread = isDirectUnread(item, myId, unreadState);
  const pinned = pinnedDirectIds.includes(item.id);

  const items: (ActionSheetItem | "separator")[] = [];

  if (unread && latestId) {
    items.push({
      key: "read",
      label: "Okundu olarak işaretle",
      icon: "check",
      onPress: () => markRead.mutate({ directId: item.id, messageId: latestId }),
    });
  }

  items.push({
    key: "pin",
    label: pinned ? "Sabitlemeyi kaldır" : "Sabitle",
    icon: pinned ? "pin-off" : "pin",
    onPress: () => onTogglePinned(item.id),
  });

  // Sohbet başına süreli susturma (web: sağ tık → Bildirimler).
  items.push({
    key: "notifications",
    label: "Bildirimler",
    icon: "bell-off",
    onPress: () =>
      openNotificationSettings({ target: { directId: item.id }, kind: "direct", title: display.title }),
  });

  if (display.isGroup) {
    items.push(
      {
        key: "info",
        label: "Grup bilgisi",
        icon: "users",
        onPress: () => router.push(`/directs/${item.id}/info`),
      },
      "separator",
      {
        key: "leave",
        label: "Gruptan ayrıl",
        icon: "logout",
        destructive: true,
        onPress: () => onRemove(item, display),
      }
    );
  } else if (peer) {
    items.push({
      key: "profile",
      label: "Profili gör",
      icon: "user",
      onPress: () => router.push(`/profile/${peer.id}`),
    });

    if (!isOfficial) {
      items.push({
        key: "ignore",
        label: ignored ? "Yoksaymayı Bırak" : "Yoksay",
        detail: ignored ? undefined : "Mesajları daraltılır, bildirim gelmez. Ona haber verilmez.",
        icon: ignored ? "bell" : "bell-off",
        onPress: () =>
          setIgnored.mutate(
            { profileId: peer.id, ignored: !ignored },
            {
              onSuccess: () =>
                showToast(
                  ignored
                    ? `${display.title} artık yoksayılmıyor.`
                    : `${display.title} yoksayılıyor. Mesajları daraltılacak ve sana bildirim göndermeyecek.`
                ),
              onError: () => showToast("İşlem tamamlanamadı. Tekrar dene.", "error"),
            }
          ),
      });
    }

    items.push("separator", {
      key: "remove",
      label: "Sohbeti kaldır",
      icon: "trash",
      onPress: () => onRemove(item, display),
    });

    if (!isOfficial) {
      items.push({
        key: "block",
        label: "Engelle",
        icon: "shield",
        destructive: true,
        onPress: () =>
          showDialog(
            `${display.title} engellensin mi?`,
            "Engellediğin kişi sana mesaj gönderemez ve seni arayamaz; arkadaşlığınız da sona erer.",
            [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Engelle",
                style: "destructive",
                onPress: () =>
                  block.mutate(peer.id, {
                    onSuccess: () => showToast(`${display.title} engellendi.`),
                  }),
              },
            ]
          ),
      });
    }
  }

  const subtitle = display.isGroup
    ? `Grup · ${display.members.length} üye`
    : peer
      ? `@${peer.username}`
      : undefined;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {display.isGroup ? (
        <GroupAvatar
          members={display.members}
          excludeId={myId}
          imageUrl={display.imageUrl}
          name={display.title}
          size={44}
          backgroundColor={colors.panel}
        />
      ) : (
        <Avatar
          profileId={peer?.id}
          imageUrl={display.imageUrl}
          fallbackText={display.fallbackText}
          size={44}
          showPresence={false}
          backgroundColor={colors.panel}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.title, ...fw(700), fontSize: 16, color: colors.bright }} numberOfLines={1}>
          {display.title}
        </Text>
        {subtitle ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return <ActionSheet visible={target !== null} onClose={onClose} header={header} items={items} />;
}
