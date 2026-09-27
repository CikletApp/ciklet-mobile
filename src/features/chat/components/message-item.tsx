import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, Keyframe } from "react-native-reanimated";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import { Avatar, Icon, emojify, type IconName } from "@/components/ui";
import { classifyAttachment, readAttachmentInfo } from "@/lib/attachments";
import { isEmojiOnly } from "@/lib/emoji";
import { formatTime } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { isForwardedMessage } from "../forward";
import { pinnedAtOf } from "../pins";
import { MessageEmbeds } from "./message-embeds";
import { MEDIA_BUBBLE_WIDTH, MessageAttachment } from "./message-attachment";
import { FLASH_DURATION, useMessageFlash } from "./message-flash";
import { MessageMarkdown } from "./message-markdown";
import { LinkPreviewCard } from "./link-preview-card";
import { fw } from "@/theme/fonts";
import { readable, senderColor } from "@/theme/palette";

/**
 * Tek mesaj satırı — baloncuk düzeni.
 *
 * Gönderdiğin mesajlar sağda ve marka tonlu, gelenler solda avatarıyla.
 * Bu ayrım okumayı hızlandırır: kimin yazdığını anlamak için ada bakmak
 * gerekmez.
 *
 * Kanal ve DM mesajları farklı şekle sahip: kanalda gönderen `member`
 * (sunucuya özel takma adıyla), DM'de doğrudan `profile`. Ayrım burada bir
 * kez yapılır, ekranlar bilmek zorunda kalmaz.
 */

const AVATAR_SIZE = 32;
const MAX_BUBBLE_WIDTH = "78%";
const inviteMonthFormat = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "numeric",
});

/**
 * Atlanılan mesajın vurgusu: marka tonu hızla gelir, kısa durur, söner.
 * Görünümün kendi saydamlığı 0 — animasyon bitince vurgu geri gelmez.
 */
const FLASH = new Keyframe({
  0: { opacity: 0 },
  12: { opacity: 1 },
  55: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.quad) },
}).duration(FLASH_DURATION);

/**
 * Basılı tutulan balonun pencere koordinatları (`measureInWindow`). Bağlam
 * menüsü balonun kopyasını tam bu dikdörtgene çizer; `grouped` kopyanın
 * köşeleri asıl balonla aynı olsun diye taşınır.
 */
export interface MessageAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
  grouped: boolean;
}

export function MessageItem({
  message,
  grouped = false,
  oneToOne = false,
  preview = false,
  onLongPress,
  onReactionPress,
  onJumpToMessage,
}: {
  message: ChatMessagePayload;
  grouped?: boolean;
  /** Birebir sohbet: gelen mesajlarda ad ve avatar gösterilmez. */
  oneToOne?: boolean;
  /**
   * Yalnızca balonun kendisi — satır, avatar ve basılı tutma yok. Bağlam
   * menüsünde odaklanan kopya bu; genişliği çağıran belirler.
   */
  preview?: boolean;
  onLongPress?: (message: ChatMessagePayload, anchor: MessageAnchor) => void;
  onReactionPress?: (message: ChatMessagePayload, emoji: string) => void;
  /** Alıntıya ya da "bir mesajı sabitledi" satırına dokununca o mesaja git. */
  onJumpToMessage?: (messageId: string) => void;
}) {
  const myId = useAuth((s) => s.profile?.id);
  const density = usePreferences((state) => state.chatDensity);
  const bigEmoji = usePreferences((state) => state.bigEmoji);
  const linkPreviews = usePreferences((state) => state.linkPreviews);
  const flash = useMessageFlash(message.id);
  const bubbleRef = useRef<View>(null);
  const compact = density === "compact";
  const largeEmoji = bigEmoji && !compact && isEmojiOnly(message.content);

  // "X bir mesajı sabitledi." — içerik ham gösterilmez, satır kurulur.
  // (SDK'nın tür listesinde henüz yok; bu yüzden düz metinle karşılaştırılır.)
  if ((message.type as string) === "MESSAGE_PINNED") {
    return <PinnedNotice message={message} onJump={onJumpToMessage} />;
  }

  // Sistem mesajları (çağrı, aktivite daveti) tarafsızdır — ortada çizilir.
  if (message.type !== MessageType.DEFAULT) {
    return message.type === MessageType.ACTIVITY_INVITE
      ? <ActivityInviteMessage message={message} />
      : <SystemMessage message={message} />;
  }

  const isChannel = isChannelMessage(message);
  const profile = isChannel ? message.member.profile : message.profile;
  const name = isChannel
    ? message.member.nickname?.trim() || profile.name?.trim() || profile.username
    : profile.name?.trim() || profile.username;

  const isMine = profile.id === myId;
  const showHeader = !grouped && !isMine && !oneToOne;
  const showAvatar = !isMine && !oneToOne;
  const isOfficial = isOfficialProfile(profile);
  const inviteCode = !message.fileUrl && !message.deleted
    ? extractInviteCode(message.content)
    : null;
  const hideAttachmentUrl = Boolean(
    message.fileUrl && isAttachmentUrlContent(message.content, message.fileUrl)
  );
  const linkUrl = !message.fileUrl && !inviteCode && !message.deleted
    ? extractFirstWebUrl(message.content)
    : null;
  const attachmentKind = message.fileUrl && !message.deleted
    ? classifyAttachment(message.fileUrl, readAttachmentInfo(message.metadata))
    : null;
  const visualMedia =
    attachmentKind === "image" || attachmentKind === "probe" || attachmentKind === "video";
  const hasQuote = Boolean(message.replyTo && !message.replyTo.deleted);
  const forwarded = isForwardedMessage(message) && !message.deleted;
  // WhatsApp gibi: altyazısız görsel/video balonsuz çizilir, saat medyanın
  // üstüne biner. Gönderen adı, alıntı ya da "İletildi" varsa balon kalır —
  // o bilgilerin duracağı bir zemin gerekiyor.
  const bareMedia = visualMedia && hideAttachmentUrl && !showHeader && !hasQuote && !forwarded;
  // Telegram gibi: altyazılı görsel/video TEK balondur. Medya balonun üst ve
  // yan kenarlarına yaslanır (köşeyi balon kırpar); altyazı ve saat altında
  // normal boşlukla durur. Balonun genişliği medyanınki, altyazı ona sarar.
  const captionedMedia = visualMedia && !hideAttachmentUrl;
  const flat = Boolean(inviteCode) || bareMedia;

  // Konum satırdan değil balonun kendisinden ölçülür: bağlam menüsü
  // kopyayı tam üstüne çizer. Ters (inverted) listede de pencere
  // koordinatı doğru gelir; dönüşümü Fabric hesaba katıyor.
  const handleLongPress = onLongPress
    ? () => {
        bubbleRef.current?.measureInWindow((x, y, width, height) => {
          onLongPress(message, { x, y, width, height, grouped });
        });
      }
    : undefined;

  const header = showHeader ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Text
        onPress={() => router.push(`/profile/${profile.id}`)}
        style={{ ...typography.caption, ...fw(700), color: nameColor(message, profile.id) }}
        numberOfLines={1}
      >
        {name}
      </Text>
      {isOfficial || profile.isBot ? (
        <View
          style={{
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: colors.brand,
          }}
        >
          <Text style={{ fontSize: 9, ...fw(700), color: colors.onBrand }}>
            {isOfficial ? "RESMÎ" : "UYG"}
          </Text>
        </View>
      ) : null}
    </View>
  ) : null;

  const forwardedLabel = forwarded ? (
    // İletilen mesaj kaynağını taşımaz (Discord kuralı); yalnızca
    // iletilmiş olduğu işaretlenir.
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="forward" size={12} color={colors.muted} />
      <Text style={{ fontSize: 11, lineHeight: 15, fontStyle: "italic", color: colors.muted }}>
        İletildi
      </Text>
    </View>
  ) : null;

  const replyTarget = message.replyTo && !message.replyTo.deleted ? message.replyTo : null;
  const quote = replyTarget ? (
    // Alıntı: tonlu kutu + vurgu çizgisi + yazarın adı. Yalnızca çizgi
    // ve soluk metin, alıntının mesajın parçası mı ayrı bir şey mi
    // olduğunu ayırt ettirmiyordu. Dokununca alıntılanan mesaja gidilir.
    <Pressable
      onPress={onJumpToMessage ? () => onJumpToMessage(replyTarget.id) : undefined}
      onLongPress={handleLongPress}
      delayLongPress={280}
      disabled={!onJumpToMessage && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Alıntılanan mesaja git"
      style={{
        borderRadius: radii.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.brand,
        backgroundColor: isMine ? colors.bubbleOther : colors.deep,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        gap: 1,
        marginTop: 2,
        marginBottom: spacing.xs,
      }}
    >
      {replyAuthor(replyTarget) ? (
        <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }} numberOfLines={1}>
          {replyAuthor(replyTarget)}
        </Text>
      ) : null}
      <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={2}>
        {replyTarget.content}
      </Text>
    </Pressable>
  ) : null;

  const reactions = message.reactions?.length ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {groupReactions(message.reactions).map(({ emoji, count }) => (
        <Pressable
          key={emoji}
          onPress={() => onReactionPress?.(message, emoji)}
          accessibilityRole="button"
          accessibilityLabel={`${emoji} tepkisi, ${count}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.raised : colors.panel,
          })}
        >
          <Text style={{ fontSize: 14 }}>{emojify(emoji, `r-${emoji}`, 17)}</Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>{count}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  const caption = message.content ? (
    <MessageMarkdown
      value={message.content}
      compact={compact}
      style={largeEmoji ? { fontSize: 28, lineHeight: 34 } : undefined}
    />
  ) : null;

  const bubble = (
    <View
      ref={bubbleRef}
      collapsable={false}
      style={{
        width: captionedMedia ? MEDIA_BUBBLE_WIDTH : undefined,
        maxWidth: preview || inviteCode ? "100%" : MAX_BUBBLE_WIDTH,
        paddingHorizontal: flat || captionedMedia ? 0 : spacing.md,
        paddingVertical: flat || captionedMedia ? 0 : spacing.sm,
        borderRadius: radii.lg,
        // Baloncuğun "kuyruk" tarafı köşesi küçültülür; grup içindeki
        // ardışık mesajlarda düz kalır ki blok tek parça görünsün.
        borderBottomRightRadius: isMine && !grouped ? radii.sm : radii.lg,
        borderBottomLeftRadius: !isMine && !grouped ? radii.sm : radii.lg,
        backgroundColor: flat
          ? "transparent"
          : isMine
            ? colors.bubbleOwn
            : colors.bubbleOther,
        // Altyazılı medyada köşeleri balon belirler; medyanın kendi köşesi yok.
        overflow: captionedMedia ? "hidden" : undefined,
        gap: captionedMedia ? 0 : 2,
      }}
    >
      {captionedMedia && message.fileUrl ? (
        <>
          {header || forwardedLabel || quote ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                paddingBottom: spacing.xs,
                gap: 2,
              }}
            >
              {header}
              {forwardedLabel}
              {quote}
            </View>
          ) : null}

          <MessageAttachment
            url={message.fileUrl}
            metadata={message.metadata}
            variant="bubble"
            onLongPress={handleLongPress}
          />

          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingTop: 6,
              paddingBottom: spacing.sm,
              gap: 2,
            }}
          >
            {caption}
            <MessageEmbeds metadata={message.metadata} />
            <MessageTime message={message} />
            {reactions}
          </View>
        </>
      ) : (
        <>
          {header}
          {forwardedLabel}
          {quote}

          {!inviteCode && !hideAttachmentUrl && message.deleted ? (
            <Text
              style={{
                ...typography.body,
                color: colors.muted,
                fontStyle: "italic",
              }}
            >
              Bu mesaj silindi.
            </Text>
          ) : null}

          {!inviteCode && !hideAttachmentUrl && !message.deleted ? caption : null}

          {message.fileUrl && !message.deleted ? (
            <MessageAttachment
              url={message.fileUrl}
              metadata={message.metadata}
              overlay={bareMedia ? <MessageTime message={message} onMedia /> : undefined}
              onLongPress={handleLongPress}
            />
          ) : null}

          {inviteCode ? (
            <ServerInviteCard inviteCode={inviteCode} />
          ) : null}

          {linkPreviews && linkUrl ? <LinkPreviewCard url={linkUrl} /> : null}

          {!message.deleted ? <MessageEmbeds metadata={message.metadata} /> : null}

          {bareMedia ? null : <MessageTime message={message} />}

          {reactions}
        </>
      )}
    </View>
  );

  if (preview) return bubble;

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={280}
      style={{
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: compact ? 1 : grouped ? 2 : spacing.sm,
        paddingBottom: compact ? 1 : 2,
      }}
      accessibilityRole="button"
      accessibilityHint="Mesaj eylemlerini açmak için basılı tut"
      accessibilityLabel={`${isMine ? "Sen" : name}: ${
        message.deleted ? "silinmiş mesaj" : message.content
      }`}
    >
      {flash !== null ? (
        <Animated.View
          key={flash}
          entering={FLASH}
          pointerEvents="none"
          style={{ position: "absolute", inset: 0, opacity: 0, backgroundColor: colors.brandSoft }}
        />
      ) : null}

      {/* Gelen mesajlarda avatar; gruplananlarda sütun hizası korunur.
          Dokunma üye kartına (profil ekranı) gider — web'deki üye kartının
          mobil karşılığı. */}
      {showAvatar ? (
        grouped ? (
          <View style={{ width: AVATAR_SIZE }} />
        ) : (
          <Pressable
            onPress={() => router.push(`/profile/${profile.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${name} profilini görüntüle`}
          >
            <Avatar
              profileId={profile.id}
              imageUrl={profile.imageUrl}
              fallbackText={profile.username}
              size={AVATAR_SIZE}
            />
          </Pressable>
        )
      ) : null}

      {bubble}
    </Pressable>
  );
}

/**
 * Menüdeki "Kopyala"nın metni; kopyalanacak bir şey yoksa null. Ekin ham
 * CDN adresi metin sayılmaz — dosya bağlantısını kopyalatmak kullanıcıyı
 * uygulama dışına çıkarmanın bir yolu olurdu.
 */
export function copyableText(message: ChatMessagePayload): string | null {
  if (message.deleted || !message.content.trim()) return null;
  if (message.fileUrl && isAttachmentUrlContent(message.content, message.fileUrl)) return null;
  return message.content;
}

/** Saat ve "düzenlendi" — balonun altında ya da medyanın üstünde. */
function MessageTime({ message, onMedia = false }: { message: ChatMessagePayload; onMedia?: boolean }) {
  const tint = onMedia ? "rgba(255,255,255,0.92)" : colors.muted;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-end",
        gap: spacing.xs,
      }}
    >
      {/* Telegram gibi: sabit mesajın saatinin yanında küçük raptiye. */}
      {pinnedAtOf(message) && !message.deleted ? <Icon name="pin" size={11} color={tint} /> : null}
      {message.createdAt !== message.updatedAt && !message.deleted ? (
        <Text style={{ fontSize: 10, color: tint }}>düzenlendi</Text>
      ) : null}
      <Text style={{ fontSize: 10, lineHeight: 14, color: tint }}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

/**
 * "X bir mesajı sabitledi." — ortada soluk satır. Yazar sabitleyen kişi;
 * içerik ham gösterilmez. Dokununca sabitlenen mesaja gidilir. Tepki,
 * yanıt ve bağlam menüsü yok; diğer mesajlarla gruplanmaz.
 */
function PinnedNotice({ message, onJump }: { message: ChatMessagePayload; onJump?: (messageId: string) => void }) {
  const isChannel = isChannelMessage(message);
  // Silinmiş hesapta profil ve adlar boş gelebiliyor.
  const profile = (isChannel ? message.member?.profile : message.profile) as
    | { name?: string | null; username?: string | null }
    | null
    | undefined;
  const name =
    (isChannel ? message.member?.nickname?.trim() : null) ||
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "Bir kullanıcı";
  const target = message.metadata?.pinnedMessageId;
  const targetId = typeof target === "string" && target ? target : null;
  const canJump = Boolean(targetId && onJump);

  return (
    <Pressable
      onPress={targetId && onJump ? () => onJump(targetId) : undefined}
      disabled={!canJump}
      accessibilityRole="button"
      accessibilityLabel={`${name} bir mesajı sabitledi. Mesaja git`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name="pin" size={14} color={colors.muted} />
      {/* Web'le aynı: "{Ad} bir mesajı sabitledi. Mesaja git" — satırın
          tamamı dokunulabilir, "Mesaja git" marka renginde ipucu. */}
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }} numberOfLines={2}>
        <Text style={{ ...fw(700), color: colors.text }}>{emojify(name, `pin-${message.id}`, 16)}</Text>
        {" bir mesajı sabitledi."}
        {canJump ? <Text style={{ ...fw(600), color: colors.brand }}>{" Mesaja git"}</Text> : null}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(message.createdAt)}</Text>
    </Pressable>
  );
}

/**
 * Gönderen adının rengi. Kanalda üyenin en üst renkli rolü (web'deki
 * `getMessageNameColor`); yoksa ya da DM grubunda kişiye özgü kararlı renk.
 * İkisi de baloncuk zemininde okunur hâle getirilir.
 */
function nameColor(message: ChatMessagePayload, profileId: string): string {
  const member = (message as { member?: { roleColor?: string | null; roles?: { color?: string | null; position?: number }[] } }).member;
  const roleColor =
    member?.roleColor ??
    [...(member?.roles ?? [])]
      .filter((role) => role.color && /^#[0-9a-f]{6}$/i.test(role.color))
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))[0]?.color;
  if (roleColor && /^#[0-9a-f]{6}$/i.test(roleColor)) return readable(roleColor, colors.bubbleOther);
  return senderColor(profileId, colors.bubbleOther);
}

/** Alıntılanan mesajın yazarı — kanal ve DM yanıtlarının şekli farklı. */
function replyAuthor(reply: unknown): string | null {
  const value = reply as {
    profile?: { name?: string | null; username?: string } | null;
    member?: { nickname?: string | null; profile?: { name?: string | null; username?: string } } | null;
  };
  const profile = value.member?.profile ?? value.profile;
  return value.member?.nickname?.trim() || profile?.name?.trim() || profile?.username || null;
}

/**
 * Ek içeriği yalnızca dosyanın ham adresiyse gizlenir. Dosya adı veya
 * kullanıcının yazdığı gerçek açıklama korunur; böylece medya mesajı URL
 * balonuna dönüşmez ama caption kaybolmaz.
 */
function isAttachmentUrlContent(content: string, fileUrl: string): boolean {
  const value = content.trim();
  if (!value) return true;
  if (value === fileUrl) return true;
  // Eski web/mobil istemcileri yüklenen dosyanın CDN adresini content'e de
  // yazıyordu. Ek alanı varken tek başına duran hiçbir http(s) adresini
  // ikinci kez metin olarak göstermeyiz. Gerçek açıklamalar korunur.
  return /^https?:\/\/\S+$/i.test(value);
}

function extractFirstWebUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s<>]+/i)?.[0];
  if (!match) return null;
  const trimmed = match.replace(/[),.!?;:'"\]]+$/g, "");
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function groupReactions(reactions: NonNullable<ChatMessagePayload["reactions"]>) {
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

/**
 * Sistem mesajı — çağrı kayıtları ve aktivite davetleri.
 * Kimseye ait olmadığı için ortada, baloncuksuz çizilir.
 */
function SystemMessage({ message }: { message: ChatMessagePayload }) {
  const { icon, tint } = systemStyle(message.type);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
      }}
    >
      <Icon name={icon} size={14} color={tint} />
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
        {message.content}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

function systemStyle(type: MessageType): { icon: IconName; tint: string } {
  if (type === MessageType.CALL_STARTED) return { icon: "phone", tint: colors.success };
  if (type === MessageType.CALL_ENDED) return { icon: "phone", tint: colors.muted };
  if (type === MessageType.CALL_MISSED) return { icon: "phone", tint: colors.danger };
  if (type === MessageType.ACTIVITY_INVITE) return { icon: "compass", tint: colors.brand };
  if (type === MessageType.ACTIVITY_REPLY) return { icon: "compass", tint: colors.muted };
  return { icon: "message", tint: colors.muted };
}

function ActivityInviteMessage({ message }: { message: ChatMessagePayload }) {
  const metadata = message.metadata ?? {};
  const [contentName, contentDescription] = message.content.split("|");
  const activityName = String(metadata.activityName || contentName?.trim() || "Aktivite");
  const description = String(metadata.activityDescription || contentDescription?.trim() || "Arkadaşlarınla birlikte katıl!");
  const activityIcon = typeof metadata.activityIcon === "string" ? metadata.activityIcon : undefined;
  const activityColor = typeof metadata.activityColor === "string" ? metadata.activityColor : undefined;
  const activityId = typeof metadata.activityId === "string" ? metadata.activityId : undefined;
  const chatId = isChannelMessage(message) ? message.channelId : message.directId;
  const profile = isChannelMessage(message) ? message.member.profile : message.profile;
  const name = profile.name?.trim() || profile.username;
  const scheme = useTheme((s) => s.scheme);
  const hasRemoteIcon = Boolean(activityIcon?.startsWith("http") || activityIcon?.startsWith("data:image/"));
  const isActive = Boolean(message.fileUrl) && !description.includes("Aktivite sona erdi");
  const accent = safeActivityColor(activityColor) ?? colors.brand;
  const { data: activities } = useActivities();
  const isAvailable = Boolean(activities?.some((activity) => activity.id === activityId));

  const openActivity = () => {
    if (activityId && isAvailable) {
      router.push({
        pathname: "/activities/[clientId]",
        params: { clientId: activityId, chatId },
      });
      return;
    }

    router.push({ pathname: "/activities", params: { chatId } });
  };

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <Avatar profileId={profile.id} imageUrl={profile.imageUrl} fallbackText={profile.username} size={40} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{name}</Text>
          <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(message.createdAt)}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: colors.bubbleOwn }}>
            <Icon name="compass" size={14} color={colors.brand} />
            <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Aktivite</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }}>kullanıldı,</Text>
          <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.brand }}>
            <Text style={{ fontSize: 9, lineHeight: 13, ...fw(700), color: colors.onBrand }}>UYG</Text>
          </View>
          <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>• {activityName}</Text>
        </View>
        <View
          style={{
            width: 320,
            maxWidth: "100%",
            padding: spacing.md,
            gap: spacing.md,
            borderRadius: radii.bento,
            borderCurve: "continuous",
            backgroundColor: hasRemoteIcon ? colors.deep : accent,
            overflow: "hidden",
            shadowColor: colors.shadow,
            shadowOpacity: 1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          {hasRemoteIcon ? (
            <>
              <Image source={{ uri: activityIcon }} contentFit="cover" style={{ position: "absolute", inset: -64, opacity: 0.9, transform: [{ scale: 1.6 }] }} />
              <BlurView
                intensity={80}
                tint={scheme}
                blurMethod="dimezisBlurViewSdk31Plus"
                style={{ position: "absolute", inset: 0 }}
              />
              <View style={{ position: "absolute", inset: 0, backgroundColor: colors.mediaScrim }} />
            </>
          ) : null}
          <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: colors.mediaMuted }}>
            Etkinlik Daveti
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            {hasRemoteIcon ? (
              <Image source={{ uri: activityIcon }} contentFit="cover" style={{ width: 56, height: 56, borderRadius: radii.bento, backgroundColor: colors.mediaText }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: radii.bento, alignItems: "center", justifyContent: "center", backgroundColor: colors.mediaText }}>
                <Icon name="compass" size={28} color={accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, lineHeight: 20, ...fw(800), color: colors.mediaText }} numberOfLines={1}>{activityName}</Text>
              <Text style={{ fontSize: isActive ? 13 : 11, lineHeight: 16, ...fw(600), color: colors.mediaMuted }} numberOfLines={2}>
                {isActive ? "1 Katıldı" : description}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={openActivity}
            accessibilityRole="button"
            accessibilityLabel={isActive ? "Etkinliğe Katıl" : "Aktiviteyi başlat"}
            style={({ pressed }) => ({
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.md,
              backgroundColor: colors.mediaText,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ fontSize: 14, lineHeight: 18, ...fw(700), color: colors.mediaButtonText }}>
              {isActive ? "Etkinliğe Katıl" : "Başlat"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function safeActivityColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
}

interface InvitePreview {
  id: string;
  name: string;
  imageUrl: string;
  memberCount: number;
  onlineCount: number;
  ownerName: string;
  createdAt?: string;
}

interface JoinInviteResponse {
  ok: boolean;
  serverId: string;
}

function extractInviteCode(content: string): string | null {
  return content.match(/\/i\/([a-zA-Z0-9]{9})/)?.[1] ?? null;
}

function ServerInviteCard({ inviteCode }: { inviteCode: string | null }) {
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ["chat-invite", inviteCode],
    queryFn: () => api<InvitePreview>(endpoints.invite(inviteCode!)),
    enabled: Boolean(inviteCode),
    staleTime: 5 * 60 * 1000,
  });
  const join = useMutation({
    mutationFn: () => api<JoinInviteResponse>(endpoints.invite(inviteCode!), { method: "POST" }),
    onSuccess: async ({ serverId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.memberships });
      router.replace(`/servers/${serverId}`);
    },
  });
  if (!inviteCode) return null;

  return (
    <View
      style={{
        width: 280,
        maxWidth: "100%",
        height: 164,
        marginTop: spacing.xs,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      {invite.isLoading ? (
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>Davet yükleniyor…</Text>
      ) : invite.isError || !invite.data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
          <Icon name="shield" size={22} color={colors.muted} />
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>Bu davet geçersiz veya süresi dolmuş.</Text>
        </View>
      ) : (
        <>
          {invite.data.imageUrl ? (
            <>
              <Image
                source={{ uri: invite.data.imageUrl }}
                contentFit="cover"
                style={{ position: "absolute", inset: -40, opacity: 0.72 }}
              />
              <BlurView
                intensity={72}
                tint={useTheme.getState().scheme}
                blurMethod="dimezisBlurViewSdk31Plus"
                style={{ position: "absolute", inset: 0 }}
              />
              <View style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }} />
            </>
          ) : null}
          <Text style={{ ...typography.overline, color: colors.muted }}>SUNUCU DAVETİ</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar imageUrl={invite.data.imageUrl} fallbackText={invite.data.name} size={54} shape="squircle" backgroundColor={colors.deep} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.title, color: colors.bright }} numberOfLines={1}>{invite.data.name}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{invite.data.ownerName} adlı kullanıcının sunucusu</Text>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>
                <Text style={{ color: colors.success }}>●</Text> {invite.data.onlineCount} Aktif
              </Text>
              <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>
                <Text style={{ color: colors.success }}>●</Text> {invite.data.memberCount} Üye
              </Text>
            </View>
            {invite.data.createdAt ? (
              <Text style={{ fontSize: 11, lineHeight: 14, ...fw(500), color: colors.muted }}>
                {inviteMonthFormat.format(new Date(invite.data.createdAt))} tarihinde oluşturuldu
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => join.mutate()}
            disabled={join.isSuccess || join.isPending}
            accessibilityRole="button"
            accessibilityLabel="Sunucuya katıl"
            style={({ pressed }) => ({
              height: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.md,
              backgroundColor: colors.brand,
              opacity: join.isSuccess ? 0.55 : pressed ? 0.86 : 1,
            })}
          >
            <Text style={{ fontSize: 13, lineHeight: 17, ...fw(700), color: colors.onBrand }}>
              {join.isPending ? "Katılıyor…" : join.isSuccess ? "Açılıyor…" : "Sunucuya Katıl"}
            </Text>
          </Pressable>
          {join.isError ? (
            <Text style={{ fontSize: 10, color: colors.danger, textAlign: "center" }} numberOfLines={1}>
              Sunucuya katılınamadı. Lütfen tekrar dene.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
