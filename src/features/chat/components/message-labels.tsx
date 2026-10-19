import { Text, View } from "react-native";
import { router } from "expo-router";

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

/** Alt başlık açılmış mesajın altındaki bağlantı; dokununca alt başlığın sohbeti açılır. */
export function ThreadLink({ serverId, thread }: { serverId: string; thread: ThreadMeta }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/chat/channel/[channelId]",
          params: { channelId: thread.id, serverId, name: thread.name },
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
