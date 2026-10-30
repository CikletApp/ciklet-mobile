import { Text, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { isKnownThreadOf, useChannelThreads, useServerThreads } from "@/api/hooks";
import { Icon, Pressable, emojify } from "@/components/ui";
import type { InteractionMeta, ThreadMeta } from "@/lib/message-extras";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * Mesaj balonunun küçük üst/alt satırları — ciklet-web
 * `chat-message-group.tsx` (InteractionLabel, SilentLabel) ve
 * `message-thread-link.tsx` karşılıkları.
 */

const LABEL_TEXT = { fontSize: 11, lineHeight: 15, color: colors.muted } as const;

/** Bot yanıtı: "@kullanıcı /komut komutunu kullandı" (metadata.interaction). */
export function InteractionLabel({ interaction, pending }: { interaction: InteractionMeta; pending: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text style={{ ...LABEL_TEXT, ...fw(700), color: colors.muted }}>{"/"}</Text>
      <Text style={LABEL_TEXT} numberOfLines={1}>
        <Text style={{ ...fw(600), color: colors.text }}>@{interaction.username}</Text>
        {interaction.kind === "component" ? (
          " bir bileşenle etkileşime girdi"
        ) : interaction.kind === "modal" ? (
          " bir form gönderdi"
        ) : (
          <>
            {" "}
            <Text style={{ fontFamily: "monospace", color: colors.text }}>/{interaction.name}</Text>
            {" komutunu kullandı"}
          </>
        )}
        {pending ? " · bot düşünüyor…" : ""}
      </Text>
    </View>
  );
}

/**
 * Yalnızca bu kullanıcıya görünen mesaj (botun flags 64 yanıtı): sunucuda
 * geçmişi yok, uygulama yeniden açılınca kaybolur. "Bu mesajları kapat"
 * mesajı bellekten kaldırır (web `EphemeralFooter`, Discord "Dismiss message").
 */
export function EphemeralFooter({ onDismiss, inset = 0 }: { onDismiss: () => void; inset?: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
        marginLeft: inset,
      }}
    >
      <Icon name="eye" size={12} color={colors.muted} />
      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.muted }}>Yalnızca sen görebilirsin</Text>
      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.muted }}>·</Text>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Bu mesajları kapat" hitSlop={8}>
        <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: colors.brand }}>Bu mesajları kapat</Text>
      </Pressable>
    </View>
  );
}

/** `@sessiz` ile gönderilen mesaj: bildirim üretmedi. */
export function SilentLabel() {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      accessibilityLabel="Sessiz mesaj: bildirim gönderilmedi"
    >
      <Icon name="bell-off" size={11} color={colors.muted} />
      <Text style={LABEL_TEXT}>Sessiz</Text>
    </View>
  );
}

/**
 * Alt başlık açılmış mesajın altındaki bağlantı; dokununca alt başlığın
 * sohbeti açılır. `metadata.thread` mesajla gelen veri: yalnızca hedef
 * gerçekten bu kanalın alt başlığı olarak bilinen bir listede geçiyorsa
 * çizilir — sahte bir kimlik başka (ör. yaş sınırlı) kanala götürmesin.
 */
export function ThreadLink({ serverId, parentId, thread }: { serverId: string; parentId: string; thread: ThreadMeta }) {
  const queryClient = useQueryClient();
  // Listeler değişince yeniden çizilsin diye abone olunur; karar önbellekten.
  // Kenar listesi yalnızca açık alt başlıkları taşır: orada yoksa kanalın
  // arşiv listesi (kanal başına tek, paylaşılan sorgu) çekilir.
  const sidebar = useServerThreads(serverId);
  const inSidebar = Boolean(sidebar.data?.some((row) => row.id === thread.id && row.parentChannelId === parentId));
  useChannelThreads(serverId, parentId, true, Boolean(sidebar.data) && !inSidebar);
  if (!isKnownThreadOf(queryClient, serverId, parentId, thread.id)) return null;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/chat/channel/[channelId]",
          params: { channelId: thread.id, serverId, parentId, threadName: thread.name },
        })
      }
      accessibilityRole="link"
      accessibilityLabel={`${thread.name} alt başlığına git`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        maxWidth: "100%",
        gap: spacing.sm,
        marginTop: 2,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      <Icon name="message" size={14} color={colors.brand} />
      <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, ...fw(600), color: colors.bright, flexShrink: 1 }}>
        {emojify(thread.name, `thread-${thread.id}`, 14)}
      </Text>
      <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }}>Alt başlığa git</Text>
    </Pressable>
  );
}
