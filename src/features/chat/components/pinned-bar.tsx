import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Icon, IconButton, ToastHost, emojify } from "@/components/ui";
import { formatChatListTime } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { pinAttachment, pinAuthor, pinPreview, type PinnedMessage } from "../pins";

/**
 * Sabitlenen mesaj çubuğu — Telegram'daki gibi sohbet başlığının altında.
 *
 * Soldaki parçalı çizgi sabit sayısını ve hangisinde olunduğunu gösterir
 * (en yeni en altta, en çok dört parça görünür). Çubuğa dokununca gösterilen
 * sabite gidilir ve çubuk bir öncekine geçer; son sabitten sonra başa döner.
 * Mesajda görsel ya da video varsa solda küçük kare önizleme durur.
 */
export function PinnedBar({
  pins,
  onJump,
  onOpenList,
}: {
  /** En son sabitlenen başta (`usePins`). */
  pins: PinnedMessage[];
  onJump: (messageId: string) => void;
  onOpenList: () => void;
}) {
  const [index, setIndex] = useState(0);
  if (pins.length === 0) return null;

  // Liste kısalınca (kaldırma) dizin taşmasın; durum effect'le düzeltilmez.
  const current = Math.min(index, pins.length - 1);
  const message = pins[current];
  const title = pins.length > 1 ? `Sabitlenen Mesaj #${pins.length - current}` : "Sabitlenen Mesaj";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.sm,
        marginTop: spacing.xs,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        backgroundColor: colors.panel,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => {
          onJump(message.id);
          setIndex((current + 1) % pins.length);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${pinPreview(message)}. Mesaja git`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingLeft: spacing.md,
          backgroundColor: pressed ? colors.raised : "transparent",
        })}
      >
        <PinSegments count={pins.length} active={current} />
        <PinThumb message={message} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }} numberOfLines={1}>
            {title}
          </Text>
          <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={1}>
            {emojify(pinPreview(message), `pin-${message.id}`, 16)}
          </Text>
        </View>
      </Pressable>
      <IconButton icon="list" label="Tüm sabitlenen mesajlar" background="transparent" tint={colors.muted} size={40} onPress={onOpenList} />
    </View>
  );
}

/** Parçalı dikey çizgi. Dizin 0 (en yeni) en altta — Telegram'daki sıra. */
function PinSegments({ count, active }: { count: number; active: number }) {
  const height = 34;
  const gap = 2;
  const visible = Math.min(count, 4);
  const start = Math.min(Math.max(active - 1, 0), count - visible);
  const segment = (height - gap * (visible - 1)) / visible;
  return (
    <View style={{ width: 3, height, gap }}>
      {Array.from({ length: visible }, (_, slot) => {
        const pinIndex = start + (visible - 1 - slot);
        return (
          <View
            key={slot}
            style={{ height: segment, borderRadius: 2, backgroundColor: pinIndex === active ? colors.brand : colors.border }}
          />
        );
      })}
    </View>
  );
}

/** Görsel/video ekinin küçük karesi; ek yoksa hiçbir şey. */
function PinThumb({ message, size }: { message: PinnedMessage; size: number }) {
  const attachment = pinAttachment(message);
  if (!attachment) return null;
  if (attachment.kind === "image" || attachment.kind === "probe") {
    return (
      <Image
        source={{ uri: attachment.url }}
        recyclingKey={attachment.url}
        contentFit="cover"
        cachePolicy="memory-disk"
        style={{ width: size, height: size, borderRadius: radii.sm, backgroundColor: colors.deep }}
      />
    );
  }
  if (attachment.kind === "video") {
    return (
      <View style={{ width: size, height: size, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.deep }}>
        <Icon name="play" size={size * 0.45} color={colors.bright} />
      </View>
    );
  }
  return null;
}

/**
 * Tüm sabitler — çubuğun sağındaki liste simgesinden açılır. Satıra dokununca
 * mesaja gidilir; yetkisi olan satırdaki simgeyle sabitlemeyi kaldırır.
 */
export function PinnedListSheet({
  visible,
  pins,
  canUnpin,
  onClose,
  onJump,
  onUnpin,
}: {
  visible: boolean;
  pins: PinnedMessage[];
  /** Kanalda ADMIN/MODERATOR, DM ve grupta herkes (sunucu yine denetler). */
  canUnpin: boolean;
  onClose: () => void;
  onJump: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} accessibilityLabel="Kapat" style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }} />
        <View
          style={{
            maxHeight: "75%",
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
            overflow: "hidden",
          }}
        >
          <View style={{ width: 38, height: 4, alignSelf: "center", borderRadius: radii.full, backgroundColor: colors.border, marginBottom: spacing.sm }} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ ...typography.title, color: colors.bright, flex: 1 }}>
              {pins.length > 0 ? `${pins.length} sabitlenen mesaj` : "Sabitlenen mesaj yok"}
            </Text>
            <IconButton icon="close" label="Kapat" background="transparent" tint={colors.muted} onPress={onClose} />
          </View>
          <FlatList
            data={pins}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.md }}
            renderItem={({ item }) => {
              const author = pinAuthor(item);
              return (
                <Pressable
                  onPress={() => {
                    onClose();
                    onJump(item.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${author.name}: ${pinPreview(item)}. Mesaja git`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.sm,
                    borderRadius: radii.lg,
                    backgroundColor: pressed ? colors.raised : "transparent",
                  })}
                >
                  <Avatar profileId={author.id} imageUrl={author.imageUrl} fallbackText={author.name} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                      <Text style={{ ...typography.bodyStrong, color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
                        {author.name}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.muted }}>{formatChatListTime(item.createdAt)}</Text>
                    </View>
                    <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={2}>
                      {emojify(pinPreview(item), `pins-${item.id}`, 16)}
                    </Text>
                  </View>
                  <PinThumb message={item} size={44} />
                  {canUnpin ? (
                    <IconButton icon="pin-off" label="Sabitlemeyi kaldır" background="transparent" tint={colors.muted} onPress={() => onUnpin(item.id)} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
        {/* Modal ayrı pencere: kökteki şerit bunun arkasında kalırdı. */}
        <ToastHost />
      </View>
    </Modal>
  );
}
