import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageType } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { openApplicationIfRequired } from "@/features/join-application/join-application-sheet";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { Avatar, Icon, StyledName, emojify, type IconName } from "@/components/ui";
import { classifyAttachment, readAttachmentInfo } from "@/lib/attachments";
import { formatTime } from "@/lib/format";
import { formatMessagePreview } from "@/lib/message-preview";
import { readActivityReply } from "@/lib/activity-reply";
import { isOfficialProfile } from "@/lib/official";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { isEphemeralMessage, removeEphemeralMessage } from "@/stores/ephemeral";
import { usePreferences } from "@/stores/preferences";
import { useTheme } from "@/stores/theme";
import { BOOST_PINK } from "@/lib/server-boost";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { isForwardedMessage } from "../forward";
import { pinnedAtOf } from "../pins";
import { MessageEmbeds, hasEmbeds } from "./message-embeds";
import { MEDIA_BUBBLE_WIDTH, MessageAttachment } from "./message-attachment";
import { FLASH_DURATION, useMessageFlash } from "./message-flash";
import { InvisibleSpacer, MessageMarkdown, type EmojiScale } from "./message-markdown";
import { LinkPreviewCard } from "./link-preview-card";
import { PollCard } from "./poll-message";
import { MessageActivityReply } from "./message-activity-reply";
import { ActivityInviteMessage } from "@/features/activities/activity-invite-message";
import {
  describePollOutcome,
  extraAttachments,
  isSilent,
  possessiveName,
  readInteraction,
  readPoll,
  readPollResult,
  readSticker,
  readThread,
} from "@/lib/message-extras";
import { readMessageComponents } from "@/lib/message-components";
import { readSafetyAlert } from "@/lib/safety";
import { useT } from "@/lib/i18n";
import { SafetyAlertCard } from "./safety-alert-card";
import { EphemeralFooter, InteractionLabel, SilentLabel, ThreadLink } from "./message-labels";
import { MessageComponents } from "./message-components";
import { useChatScope } from "../chat-scope";
import { emojiOnlyCount, parseCustomEmojiToken } from "../message-markup";
import { groupReactions } from "../reaction-groups";
import { hadRecentBurst, subscribeReactionBurst } from "../reaction-burst";
import { useServerEmojis } from "../server-assets";
import { RoleIconBadge, memberRoleIcon } from "@/features/server/role-icon-badge";
import { ServerTagPill, primaryGuildOf } from "@/features/server-tag/server-tag-pill";
import { fw } from "@/theme/fonts";
import { readable, senderColor } from "@/theme/palette";

/**
 * Tek mesaj satırı — baloncuk düzeni (DM, grup ve sunucu kanalında aynı;
 * ayrı bir "kompakt" görünüm yok).
 *
 * Gönderdiğin mesajlar sağda ve marka tonlu, gelenler solda. Aynı kişinin
 * 5 dakika içindeki ardışık mesajları tek grup olur: ad ilk balonda,
 * avatar, saat ve kuyruk köşesi son balonda. Bu ayrım okumayı hızlandırır:
 * kimin yazdığını anlamak için ada bakmak gerekmez.
 *
 * Kanal ve DM mesajları farklı şekle sahip: kanalda gönderen `member`
 * (sunucuya özel takma adıyla), DM'de doğrudan `profile`. Ayrım burada bir
 * kez yapılır, ekranlar bilmek zorunda kalmaz.
 */

/** Gelen mesaj avatarı — "yazıyor" balonu da aynı sütunu kullanır. */
export const AVATAR_SIZE = 32;
const MAX_BUBBLE_WIDTH = "78%";
/**
 * Balon köşeleri (Telegram/WhatsApp): dışa bakan köşeler yuvarlak; gönderen
 * tarafında grup içi balonlar birbirine küçük köşeyle yaslanır, grubun son
 * balonu sivri "kuyruk" köşesini alır.
 */
export const BUBBLE_RADIUS = 18;
export const BUBBLE_JOINT_RADIUS = 6;
export const BUBBLE_TAIL_RADIUS = 4;
/** Sola çekerek yanıtlama: satırın en çok kayacağı mesafe ve tetikleme eşiği. */
const SWIPE_MAX = 76;
const SWIPE_TRIGGER = 56;
const SWIPE_SPRING = { damping: 18, stiffness: 240 } as const;
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
 * menüsü balonun kopyasını tam bu dikdörtgene çizer; `grouped` ve
 * `lastInGroup` kopyanın köşeleri ve saati asıl balonla aynı olsun diye taşınır.
 */
export interface MessageAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
  grouped: boolean;
  lastInGroup: boolean;
}

export function MessageItem({
  message,
  grouped = false,
  lastInGroup = true,
  oneToOne = false,
  preview = false,
  onLongPress,
  onReactionPress,
  onJumpToMessage,
  onReply,
}: {
  message: ChatMessagePayload;
  /** Üstteki (daha eski) mesajla aynı grupta: ad tekrarlanmaz, araları sıkı. */
  grouped?: boolean;
  /** Grubun son mesajı: kuyruk köşesi, saat ve (gelen mesajda) avatar. */
  lastInGroup?: boolean;
  /** Birebir sohbet: gelen mesajlarda ad ve avatar gösterilmez. */
  oneToOne?: boolean;
  /**
   * Yalnızca balonun kendisi — satır, avatar ve basılı tutma yok. Bağlam
   * menüsünde odaklanan kopya bu; genişliği çağıran belirler.
   */
  preview?: boolean;
  onLongPress?: (message: ChatMessagePayload, anchor: MessageAnchor) => void;
  /** `burst`: süper tepki çipine basıldı (süper tepki ekler/kaldırır). */
  onReactionPress?: (message: ChatMessagePayload, emoji: string, options?: { burst?: boolean }) => void;
  /** Alıntıya ya da "bir mesajı sabitledi" satırına dokununca o mesaja git. */
  onJumpToMessage?: (messageId: string) => void;
  /** Satırı sola çekince yanıtla (WhatsApp/Telegram). Verilmezse çekiş kapalı. */
  onReply?: (message: ChatMessagePayload) => void;
}) {
  const myId = useAuth((s) => s.profile?.id);
  const bigEmoji = usePreferences((state) => state.bigEmoji);
  const linkPreviews = usePreferences((state) => state.linkPreviews);
  const flash = useMessageFlash(message.id);
  const scope = useChatScope();
  const bubbleRef = useRef<View>(null);
  // Sohbetten açılan profil, "Uygulamalar" (USER komutları) için sohbeti bilir.
  const openProfile = (profileId: string) =>
    router.push(scope ? { pathname: "/profile/[profileId]", params: { profileId, chatId: scope.chatId } } : `/profile/${profileId}`);

  // ── Sola çekerek yanıtla ──────────────────────────────────────────
  // Yatay çekiş satırı parmakla taşır; eşiği geçince dokunsal geri bildirim
  // ve bırakınca yanıt. Dikey hareket hareketi düşürür ki liste kaydırması
  // bozulmasın. Geri çağrılar JS'te (drag-dismiss ile aynı desen).
  const swipeX = useSharedValue(0);
  const swipeArmed = useSharedValue(false);
  // Geçici bot yanıtı (flags 64): yalnızca bu cihazın belleğinde; yanıtlanamaz,
  // menüsü yok (web'de de hover/sağ tık kapalı).
  const ephemeral = isEphemeralMessage(message);
  const canSwipe = Boolean(onReply) && !preview && !ephemeral;
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwipe)
        .runOnJS(true)
        .activeOffsetX(-18)
        .failOffsetX(12)
        .failOffsetY([-14, 14])
        .onUpdate((event) => {
          const pulled = Math.min(SWIPE_MAX, Math.max(0, -event.translationX) * 0.75);
          swipeX.set(-pulled);
          const armed = pulled >= SWIPE_TRIGGER;
          if (armed !== swipeArmed.get()) {
            swipeArmed.set(armed);
            if (armed) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        })
        .onEnd(() => {
          const armed = swipeArmed.get();
          swipeArmed.set(false);
          swipeX.set(withSpring(0, SWIPE_SPRING));
          if (armed) onReply?.(message);
        })
        .onFinalize((_event, success) => {
          if (!success) swipeX.set(withSpring(0, SWIPE_SPRING));
        }),
    [canSwipe, message, onReply, swipeArmed, swipeX]
  );
  const swipeRowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.get() }] }));
  const swipeHintStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, -swipeX.get() / SWIPE_TRIGGER);
    return { opacity: progress, transform: [{ scale: 0.6 + 0.4 * progress }] };
  });

  // "X bir mesajı sabitledi." — içerik ham gösterilmez, satır kurulur.
  // (SDK'nın tür listesinde henüz yok; bu yüzden düz metinle karşılaştırılır.)
  if ((message.type as string) === "MESSAGE_PINNED") {
    return <PinnedNotice message={message} onJump={onJumpToMessage} />;
  }
  // Sunucu Takviyesi (web SERVER_BOOST): pembe taş + "{Ad} sunucuya takviye yaptı!".
  if ((message.type as string) === "SERVER_BOOST") {
    return <BoostNotice message={message} />;
  }
  // Anket sonucu (web POLL_RESULT): "Ali'nin anketi sona erdi: Soru ·
  // Kazanan: … Anketi gör". Özet bozuksa genel sistem satırına düşer.
  if ((message.type as string) === "POLL_RESULT" && readPollResult(message.metadata)) {
    return <PollResultNotice message={message} onJump={onJumpToMessage} />;
  }

  // Anket (ciklet-web POLL): normal balon yolundan geçer (uzun basma menüsü,
  // tepkiler, silinmiş görünümü); gövdesi oy verilebilir kart.
  const isPoll = (message.type as string) === "POLL";
  // Etkinliğe yanıt/tepki (web ACTIVITY_REPLY): normal balon + etkinlik kartı.
  // Özet bozuksa kart çizilmez, mesaj düz balon kalır.
  const isActivityReply = (message.type as string) === "ACTIVITY_REPLY";

  // Sistem mesajları (çağrı, aktivite daveti) tarafsızdır — ortada çizilir.
  if (message.type !== MessageType.DEFAULT && !isPoll && !isActivityReply) {
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
  // Grupta (sunucu kanalı, DM grubu) gelen mesaj: ad grubun ilk balonunda,
  // avatar son balonun yanında (Telegram/WhatsApp). Ara satırlarda avatar
  // sütunu boş kalır ki balonlar hizalı dursun.
  const showHeader = !grouped && !isMine && !oneToOne;
  const avatarColumn = !isMine && !oneToOne;
  const isOfficial = isOfficialProfile(profile);
  // Bot bileşenleri (web lib/message-components). Components V2 mesajında
  // metin/ek yok: dosyalar yalnızca Dosya/Galeri bileşenleriyle görünür.
  const componentData =
    profile.isBot === true && !message.deleted && scope ? readMessageComponents(message.metadata) : null;
  const componentsV2 = Boolean(componentData?.v2);
  const inviteCode = !message.fileUrl && !message.deleted && !isPoll
    ? extractInviteCode(message.content)
    : null;
  const hideAttachmentUrl = Boolean(
    message.fileUrl && isAttachmentUrlContent(message.content, message.fileUrl)
  );
  const linkUrl = !message.fileUrl && !inviteCode && !message.deleted && !isPoll
    ? extractFirstWebUrl(message.content)
    : null;
  const attachmentKind = message.fileUrl && !message.deleted && !componentsV2
    ? classifyAttachment(message.fileUrl, readAttachmentInfo(message.metadata))
    : null;
  const visualMedia =
    attachmentKind === "image" || attachmentKind === "probe" || attachmentKind === "video";
  const hasQuote = Boolean(message.replyTo && !message.replyTo.deleted);
  const sticker = readSticker(message.metadata);
  const forwarded = isForwardedMessage(message) && !message.deleted;

  // Komut yanıtı ve sessiz mesaj işaretleri — web'de mesajın üstünde.
  // Etiket ve bileşenler yalnızca bot yazarlı mesajda: kullanıcının mesajına
  // eklenmiş sahte metadata "X /komut kullandı" ya da buton çizdirmesin.
  const fromBot = profile.isBot === true;
  const interaction = fromBot ? readInteraction(message.metadata) : null;
  const silent = isSilent(message.metadata) && !message.deleted;

  // Yalnızca emojiden oluşan mesaj (web gibi 1–8 emoji): 1–3 emoji dev ve
  // balonsuz (Telegram), 4–8 emoji balon içinde büyük.
  const emojiCount =
    bigEmoji && !message.deleted && !message.fileUrl && !sticker && !isPoll && !isActivityReply
      ? emojiOnlyCount(message.content)
      : 0;
  const emojiScale: EmojiScale | undefined =
    emojiCount >= 1 && emojiCount <= 3 ? "jumbo" : emojiCount >= 4 && emojiCount <= 8 ? "large" : undefined;

  // WhatsApp gibi: altyazısız görsel/video balonsuz çizilir, saat medyanın
  // üstüne biner. Gönderen adı, alıntı ya da "İletildi" varsa balon kalır —
  // o bilgilerin duracağı bir zemin gerekiyor. Dev emoji de aynı kuralla.
  const needsSurface = showHeader || hasQuote || forwarded || Boolean(interaction) || silent;
  const bareMedia = visualMedia && hideAttachmentUrl && !needsSurface;
  const bareEmoji = emojiScale === "jumbo" && !needsSurface;
  // Telegram gibi: altyazılı görsel/video TEK balondur. Medya balonun üst ve
  // yan kenarlarına yaslanır (köşeyi balon kırpar); altyazı ve saat altında
  // normal boşlukla durur. Balonun genişliği medyanınki, altyazı ona sarar.
  const captionedMedia = visualMedia && !hideAttachmentUrl;
  const flat = Boolean(inviteCode) || bareMedia || bareEmoji;

  // Balonun kendi renkleri: metin ve soluk metin balona göre okunur.
  const bubbleColor = isMine ? colors.bubbleOwn : colors.bubbleOther;
  const textColor = isMine ? colors.bubbleOwnText : colors.bubbleOtherText;
  const mutedColor = isMine ? colors.bubbleOwnMuted : colors.bubbleOtherMuted;

  // Saat yalnızca grubun son balonunda; düzenlenmiş ya da sabitlenmiş ara
  // mesaj işaretini yine taşır (saatiyle birlikte).
  const edited = message.createdAt !== message.updatedAt && !message.deleted;
  const pinned = Boolean(pinnedAtOf(message)) && !message.deleted;
  const showMeta = lastInGroup || edited || pinned;

  // Konum satırdan değil balonun kendisinden ölçülür: bağlam menüsü
  // kopyayı tam üstüne çizer. Ters (inverted) listede de pencere
  // koordinatı doğru gelir; dönüşümü Fabric hesaba katıyor.
  const handleLongPress = onLongPress && !ephemeral
    ? () => {
        bubbleRef.current?.measureInWindow((x, y, width, height) => {
          onLongPress(message, { x, y, width, height, grouped, lastInGroup });
        });
      }
    : undefined;

  const header = showHeader ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 1 }}>
      {/* Ad stili (web StyledName): renk efekti rol rengini ezer; listede durağan. */}
      <StyledName
        profileId={profile.id}
        name={name}
        onPress={() => openProfile(profile.id)}
        textStyle={{ ...typography.caption, ...fw(700), color: nameColor(message, profile.id) }}
        numberOfLines={1}
      />
      {/* Rol simgesi (web RoleIconBadge): en yüksek simgeli rol. */}
      {isChannel ? (
        <RoleIconBadge icon={memberRoleIcon((message as { member?: Parameters<typeof memberRoleIcon>[0] }).member)} size={14} />
      ) : null}
      {/* Sunucu etiketi (web ServerTagPill): Discord "Server Tag". */}
      <ServerTagPill guild={primaryGuildOf(profile)} size="sm" />
      {isOfficial || profile.isBot ? (
        <View
          style={{
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: colors.brand,
          }}
        >
          <Text style={{ fontSize: 9, lineHeight: 12, ...fw(700), color: colors.onBrand }}>
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
      <Icon name="forward" size={12} color={mutedColor} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontStyle: "italic", color: mutedColor }}>
        İletildi
      </Text>
    </View>
  ) : null;

  const metaLabels = interaction || silent ? (
    <>
      {interaction ? <InteractionLabel interaction={interaction.interaction} pending={interaction.pending} /> : null}
      {silent ? <SilentLabel /> : null}
    </>
  ) : null;
  // Alt başlık bağlantısı ThreadLink içinde ayrıca doğrulanır (bu kanalın alt başlığı mı).
  const thread = !message.deleted && scope?.serverId ? readThread(message.metadata) : null;
  const components = componentData?.components ?? [];
  const extras = message.deleted || componentsV2 ? [] : extraAttachments(message.metadata, message.fileUrl);
  const embeds = !message.deleted && hasEmbeds(message.metadata);

  const replyTarget = message.replyTo && !message.replyTo.deleted ? message.replyTo : null;
  const quote = replyTarget ? (
    // Alıntı: balonun içinde hafif tonlu kutu + vurgu çizgisi + yazarın adı.
    // Dokununca alıntılanan mesaja gidilir.
    <Pressable
      onPress={onJumpToMessage ? () => onJumpToMessage(replyTarget.id) : undefined}
      onLongPress={handleLongPress}
      delayLongPress={280}
      disabled={!onJumpToMessage && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Alıntılanan mesaja git"
      style={{
        borderRadius: radii.md,
        borderCurve: "continuous",
        borderLeftWidth: 3,
        borderLeftColor: colors.brand,
        backgroundColor: colors.bubbleInset,
        paddingLeft: spacing.sm,
        paddingRight: spacing.md,
        paddingVertical: 5,
        gap: 1,
        marginTop: 2,
        marginBottom: 3,
      }}
    >
      {replyAuthor(replyTarget) ? (
        <Text style={{ ...typography.caption, ...fw(700), color: readable(colors.brand, bubbleColor) }} numberOfLines={1}>
          {replyAuthor(replyTarget)}
        </Text>
      ) : null}
      <Text style={{ ...typography.caption, color: textColor, opacity: 0.85 }} numberOfLines={2}>
        {formatMessagePreview(replyTarget)}
      </Text>
    </Pressable>
  ) : null;

  const reactions = message.reactions?.length ? (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: isMine ? "flex-end" : "flex-start",
        gap: spacing.xs,
        marginTop: 3,
        marginLeft: avatarColumn ? AVATAR_SIZE + spacing.sm : 0,
      }}
    >
      {groupReactions(message.reactions, myId).map(({ key, emoji, count, mine, burst, burstColors }) =>
        burst ? (
          <BurstReactionChip
            key={key}
            messageId={message.id}
            emoji={emoji}
            count={count}
            mine={mine}
            colors={burstColors}
            onPress={() => onReactionPress?.(message, emoji, { burst: true })}
          />
        ) : (
        <Pressable
          key={key}
          onPress={() => onReactionPress?.(message, emoji)}
          accessibilityRole="button"
          accessibilityState={{ selected: mine }}
          accessibilityLabel={`${parseCustomEmojiToken(emoji) ? `:${parseCustomEmojiToken(emoji)?.name}:` : emoji} tepkisi, ${count}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 26,
            paddingHorizontal: spacing.sm,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: mine ? colors.brand : colors.border,
            backgroundColor: pressed ? colors.raised : mine ? colors.brandSoft : colors.panel,
          })}
        >
          <ReactionGlyph emoji={emoji} size={16} />
          <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: mine ? colors.brand : colors.muted }}>{count}</Text>
        </Pressable>
        )
      )}
    </View>
  ) : null;

  // Silinmiş anket çizilmez ("Bu mesaj silindi." kalır); içerik soru metni,
  // kart zaten gösteriyor.
  const poll = isPoll && !message.deleted ? readPoll(message.metadata) : null;
  const activityReply =
    isActivityReply && !message.deleted ? readActivityReply({ type: "ACTIVITY_REPLY", metadata: message.metadata }) : null;

  // Metinden sonra balonda başka bir şey var mı. Yoksa saat metnin son
  // satırına, sağ alta biner (WhatsApp/Telegram); varsa kendi satırında durur.
  const contentAfterText = captionedMedia
    ? embeds || Boolean(thread) || components.length > 0
    : Boolean(activityReply) ||
      Boolean(message.fileUrl && !message.deleted && !componentsV2) ||
      extras.length > 0 ||
      Boolean(sticker && !message.deleted) ||
      Boolean(inviteCode) ||
      Boolean(linkPreviews && linkUrl) ||
      embeds ||
      Boolean(thread) ||
      components.length > 0;
  const textCaption = !poll && !sticker && Boolean(message.content) && !inviteCode && !hideAttachmentUrl;
  const inlineMeta =
    showMeta && !flat && !contentAfterText && (message.deleted ? !inviteCode && !hideAttachmentUrl : textCaption);
  const metaInfo = { message, edited, pinned };
  const spacerText = inlineMeta ? metaSpacerText(metaInfo) : undefined;
  const metaRow = showMeta && !inlineMeta ? <MessageMeta {...metaInfo} tint={mutedColor} /> : null;

  // Çıkartma mesajının içeriği çıkartmanın adı; görsel zaten ad taşıyor (web gibi).
  const caption = poll ? (
    <PollCard message={message} poll={poll} />
  ) : message.content && !sticker ? (
    <MessageMarkdown value={message.content} color={textColor} emojiScale={emojiScale} trailing={spacerText} />
  ) : null;

  // Köşeler: grubun dışa bakan köşeleri yuvarlak; gönderen tarafında balonlar
  // birbirine yaslanır (küçük köşe), grubun son balonu "kuyruk" köşesini alır.
  const sideTop = grouped ? BUBBLE_JOINT_RADIUS : BUBBLE_RADIUS;
  const sideBottom = lastInGroup ? BUBBLE_TAIL_RADIUS : BUBBLE_JOINT_RADIUS;

  const bubble = (
    <View
      ref={bubbleRef}
      collapsable={false}
      style={{
        width: captionedMedia ? MEDIA_BUBBLE_WIDTH : undefined,
        maxWidth: preview || inviteCode ? "100%" : MAX_BUBBLE_WIDTH,
        minWidth: flat || captionedMedia ? undefined : 44,
        paddingHorizontal: flat || captionedMedia ? 0 : spacing.md,
        paddingTop: flat || captionedMedia ? 0 : 7,
        paddingBottom: flat || captionedMedia ? 0 : 7,
        borderCurve: "continuous",
        borderTopLeftRadius: isMine ? BUBBLE_RADIUS : sideTop,
        borderTopRightRadius: isMine ? sideTop : BUBBLE_RADIUS,
        borderBottomLeftRadius: isMine ? BUBBLE_RADIUS : sideBottom,
        borderBottomRightRadius: isMine ? sideBottom : BUBBLE_RADIUS,
        backgroundColor: flat ? "transparent" : bubbleColor,
        // Altyazılı medyada köşeleri balon belirler; medyanın kendi köşesi yok.
        overflow: captionedMedia ? "hidden" : undefined,
        gap: captionedMedia ? 0 : 2,
      }}
    >
      {captionedMedia && message.fileUrl ? (
        <>
          {header || metaLabels || forwardedLabel || quote ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingTop: spacing.sm,
                paddingBottom: spacing.xs,
                gap: 2,
              }}
            >
              {header}
              {metaLabels}
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
          {extras.map((a) => (
            <View key={a.url} style={{ marginTop: 2 }}>
              <MessageAttachment
                url={a.url}
                metadata={{ attachment: { name: a.name, type: a.type, size: a.size }, sensitive: (message.metadata as { sensitive?: unknown } | null)?.sensitive }}
                variant="bubble"
                onLongPress={handleLongPress}
              />
            </View>
          ))}

          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingTop: 6,
              paddingBottom: 7,
              gap: 2,
            }}
          >
            {caption}
            {embeds ? <MessageEmbeds metadata={message.metadata} /> : null}
            {thread && scope?.serverId ? <ThreadLink serverId={scope.serverId} parentId={scope.chatId} thread={thread} /> : null}
            {components.length > 0 ? <MessageComponents message={message} components={components} /> : null}
            {metaRow}
          </View>
          {inlineMeta ? <MessageMeta {...metaInfo} tint={mutedColor} inline /> : null}
        </>
      ) : (
        <>
          {header}
          {metaLabels}
          {forwardedLabel}
          {quote}

          {!inviteCode && !hideAttachmentUrl && message.deleted ? (
            <Text style={{ ...typography.body, lineHeight: 22, color: mutedColor, fontStyle: "italic" }}>
              Bu mesaj silindi.
              {spacerText ? <InvisibleSpacer text={spacerText} /> : null}
            </Text>
          ) : null}

          {!inviteCode && !hideAttachmentUrl && !message.deleted ? caption : null}

          {activityReply ? (
            <MessageActivityReply activity={activityReply} content={message.content} isMine={isMine} />
          ) : null}

          {message.fileUrl && !message.deleted && !componentsV2 ? (
            <MessageAttachment
              url={message.fileUrl}
              metadata={message.metadata}
              overlay={bareMedia && showMeta ? <MessageMeta {...metaInfo} tint={colors.mediaText} /> : undefined}
              onLongPress={handleLongPress}
            />
          ) : null}

          {/* Çoklu ek (ciklet-web metadata.attachments): ilki yukarıda. */}
          {extras.map((a) => (
            <MessageAttachment
              key={a.url}
              url={a.url}
              metadata={{ attachment: { name: a.name, type: a.type, size: a.size }, sensitive: (message.metadata as { sensitive?: unknown } | null)?.sensitive }}
              onLongPress={handleLongPress}
            />
          ))}

          {/* Çıkartma (ciklet-web metadata.sticker). */}
          {sticker && !message.deleted ? (
            <Image source={{ uri: sticker.imageUrl }} style={{ width: 160, height: 160 }} contentFit="contain" accessibilityLabel={sticker.name} />
          ) : null}

          {inviteCode ? (
            <ServerInviteCard inviteCode={inviteCode} />
          ) : null}

          {linkPreviews && linkUrl ? <LinkPreviewCard url={linkUrl} /> : null}

          {embeds ? <MessageEmbeds metadata={message.metadata} /> : null}

          {thread && scope?.serverId ? <ThreadLink serverId={scope.serverId} parentId={scope.chatId} thread={thread} /> : null}
          {components.length > 0 ? <MessageComponents message={message} components={components} /> : null}

          {bareMedia ? null : bareEmoji && showMeta ? (
            <MessageMeta {...metaInfo} tint={mutedColor} pill={bubbleColor} />
          ) : (
            metaRow
          )}
          {inlineMeta ? <MessageMeta {...metaInfo} tint={mutedColor} inline /> : null}
        </>
      )}
    </View>
  );

  if (preview) return bubble;

  const row = (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={280}
      style={{
        paddingHorizontal: spacing.md,
        paddingTop: grouped ? 2 : spacing.sm,
        paddingBottom: 1,
      }}
      accessibilityRole="button"
      accessibilityHint={canSwipe ? "Mesaj eylemleri için basılı tut, yanıtlamak için sola çek" : "Mesaj eylemlerini açmak için basılı tut"}
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

      <View
        style={{
          flexDirection: "row",
          justifyContent: isMine ? "flex-end" : "flex-start",
          alignItems: "flex-end",
          gap: spacing.sm,
        }}
      >
        {/* Gelen mesajlarda avatar grubun son balonunun yanında; diğerlerinde
            sütun hizası korunur. Dokunma üye kartına (profil ekranı) gider —
            web'deki üye kartının mobil karşılığı. */}
        {avatarColumn ? (
          lastInGroup ? (
            <Pressable
              onPress={() => openProfile(profile.id)}
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
          ) : (
            <View style={{ width: AVATAR_SIZE }} />
          )
        ) : null}

        {bubble}
      </View>

      {/* Tepkiler balonun altında, balonla aynı kenarda. */}
      {reactions}
      {ephemeral && scope ? (
        <EphemeralFooter
          onDismiss={() => removeEphemeralMessage(scope.chatId, message.id)}
          inset={avatarColumn ? AVATAR_SIZE + spacing.sm : 0}
        />
      ) : null}
    </Pressable>
  );

  if (!canSwipe) return row;

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View>
        {/* Çekerken sağda beliren yanıt işareti. */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", right: spacing.md, top: 0, bottom: 0, justifyContent: "center" },
            swipeHintStyle,
          ]}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.panel,
            }}
          >
            <Icon name="reply" size={16} color={colors.brand} />
          </View>
        </Animated.View>
        <Animated.View style={swipeRowStyle}>{row}</Animated.View>
      </Animated.View>
    </GestureDetector>
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

interface MetaInfo {
  message: ChatMessagePayload;
  edited: boolean;
  pinned: boolean;
}

const META_TEXT = { fontSize: 11, lineHeight: 14 } as const;

/**
 * Saat, "düzenlendi" ve sabit raptiyesi.
 *
 * - `inline`: balonun sağ alt köşesine biner; metnin son satırında ona yer
 *   açan `MetaSpacer` durur (WhatsApp/Telegram).
 * - `pill`: balonsuz dev emojinin altında küçük zeminli rozet.
 * - varsayılan: kendi satırında sağa yaslı (kartlardan sonra, medya üstü).
 */
function MessageMeta({
  message,
  edited,
  pinned,
  tint,
  inline = false,
  pill,
}: MetaInfo & { tint: string; inline?: boolean; pill?: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        ...(inline
          ? { position: "absolute", right: 10, bottom: 5 }
          : { alignSelf: "flex-end", marginTop: pill ? 2 : 1 }),
        ...(pill ? { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.full, backgroundColor: pill } : null),
      }}
    >
      {/* Telegram gibi: sabit mesajın saatinin yanında küçük raptiye. */}
      {pinned ? <Icon name="pin" size={11} color={tint} /> : null}
      {edited ? <Text style={{ ...META_TEXT, color: tint }}>düzenlendi</Text> : null}
      <Text style={{ ...META_TEXT, color: tint }}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}

/**
 * Metnin son satırına eklenen görünmez yer tutucunun metni — `MessageMeta
 * inline` ile aynı içerik ve yazı boyu (bkz. `InvisibleSpacer`), böylece
 * genişlikleri örtüşür. Kısa son satırda saat metnin yanına oturur; satır
 * doluysa yer tutucu alta kayar ve balon bir satır uzar. Bölünmez
 * boşluklarla tek parça kalır; baştaki düz boşluk satır kırılabilsin diye.
 */
function metaSpacerText({ message, edited, pinned }: MetaInfo): string {
  const pin = pinned ? "\u00A0\u00A0\u00A0\u00A0\u00A0" : "";
  const edit = edited ? "düzenlendi\u00A0" : "";
  return ` \u00A0${pin}${edit}${formatTime(message.createdAt)}\u00A0\u00A0`;
}

/**
 * "X bir mesajı sabitledi." — ortada soluk satır. Yazar sabitleyen kişi;
 * içerik ham gösterilmez. Dokununca sabitlenen mesaja gidilir. Tepki,
 * yanıt ve bağlam menüsü yok; diğer mesajlarla gruplanmaz.
 */
/**
 * "X sunucuya takviye yaptı! Sunucu Seviye 2'ye ulaştı!" — web
 * chat-message-group SERVER_BOOST satırı: pembe taş + kalın ad + içerik
 * (metin sunucuda kurulur; metadata.boost yalnızca bilgi).
 */
function BoostNotice({ message }: { message: ChatMessagePayload }) {
  const isChannel = isChannelMessage(message);
  const profile = (isChannel ? message.member?.profile : message.profile) as
    | { name?: string | null; username?: string | null }
    | null
    | undefined;
  const name =
    (isChannel ? message.member?.nickname?.trim() : null) ||
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "Bir kullanıcı";
  return (
    <View
      accessible
      accessibilityLabel={`${name} ${message.content}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
      }}
    >
      <Icon name="gem" size={14} color={BOOST_PINK} />
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }} numberOfLines={3}>
        <Text style={{ ...fw(700), color: colors.text }}>{emojify(name, `boost-${message.id}`, 16)}</Text>
        {` ${message.content}`}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}

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

/**
 * Tepki çipindeki emoji: Unicode emoji Twemoji görseli, `<:ad:id>` sunucu
 * emojisi kendi görseli; emoji silindiyse `:ad:` metni (web `ReactionRow`).
 */
function ReactionGlyph({ emoji, size }: { emoji: string; size: number }) {
  const scope = useChatScope();
  const custom = parseCustomEmojiToken(emoji);
  const emojis = useServerEmojis(custom ? scope?.serverId : undefined);
  if (!custom) return <Text style={{ fontSize: 14 }}>{emojify(emoji, `r-${emoji}`, size)}</Text>;
  const found = emojis.find((item) => item.id === custom.id);
  if (!found) return <Text style={{ fontSize: 12, color: colors.muted }}>{`:${custom.name}:`}</Text>;
  return <Image source={{ uri: found.imageUrl }} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel={`:${found.name}:`} />;
}

const BURST_PARTICLES = [
  { dx: -14, delay: 0 },
  { dx: 10, delay: 90 },
  { dx: -4, delay: 180 },
  { dx: 16, delay: 260 },
  { dx: -18, delay: 340 },
];

/**
 * Süper tepki çipi (web: ReactionRow'daki süper tepki hapı). Renkli çerçeve
 * ve ışıma `burstColors`'tan; canlı süper tepki gelince ya da çipe basınca
 * kısa bir büyüme + yukarı uçuşan emoji patlaması oynar.
 */
function BurstReactionChip({
  messageId,
  emoji,
  count,
  mine,
  colors: burstColors,
  onPress,
}: {
  messageId: string;
  emoji: string;
  count: number;
  mine: boolean;
  colors: string[];
  onPress: () => void;
}) {
  const reduceMotion = usePreferences((s) => s.reduceMotion);
  const scale = useSharedValue(1);
  const progress = useSharedValue(1);
  const [a = "#ff73fa", b = "#5865f2"] = burstColors;

  const play = useCallback(() => {
    if (reduceMotion) return;
    scale.set(withSequence(withTiming(1.18, { duration: 140 }), withSpring(1)));
    progress.set(0);
    progress.set(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
  }, [progress, reduceMotion, scale]);

  useEffect(() => {
    if (hadRecentBurst(messageId, emoji)) play();
    return subscribeReactionBurst((id, e) => {
      if (id === messageId && e === emoji) play();
    });
  }, [emoji, messageId, play]);

  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={chipStyle}>
      <Pressable
        onPress={() => {
          play();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: mine }}
        accessibilityLabel={`${parseCustomEmojiToken(emoji) ? `:${parseCustomEmojiToken(emoji)?.name}:` : emoji} süper tepki, ${count}`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          height: 26,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.full,
          borderWidth: mine ? 2 : 1,
          borderColor: a,
          backgroundColor: pressed ? `${b}55` : `${a}2e`,
          boxShadow: `0 0 ${mine ? 8 : 5}px ${b}`,
        })}
      >
        <Icon name="sparkles" size={11} color={a} />
        <ReactionGlyph emoji={emoji} size={16} />
        <Text style={{ fontSize: 12, lineHeight: 16, ...fw(700), color: mine ? a : colors.bright }}>{count}</Text>
      </Pressable>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, alignItems: "center" }}>
        {BURST_PARTICLES.map((p, i) => (
          <BurstParticle key={i} progress={progress} dx={p.dx} delay={p.delay} emoji={emoji} glow={i % 2 ? b : a} />
        ))}
      </View>
    </Animated.View>
  );
}

function BurstParticle({
  progress,
  dx,
  delay,
  emoji,
  glow,
}: {
  progress: SharedValue<number>;
  dx: number;
  delay: number;
  emoji: string;
  glow: string;
}) {
  const style = useAnimatedStyle(() => {
    // Gecikmeli başlangıç: her parçacık aynı ilerlemenin kaydırılmış dilimi.
    const t = Math.min(1, Math.max(0, (progress.get() * 1100 - delay) / 800));
    const visible = progress.get() < 1 && t > 0;
    return {
      opacity: visible ? 1 - t : 0,
      transform: [{ translateY: -t * 46 }, { translateX: dx * t }, { scale: 0.7 + t * 0.6 }],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", bottom: 0, boxShadow: `0 0 6px ${glow}`, borderRadius: radii.full }, style]}>
      <ReactionGlyph emoji={emoji} size={14} />
    </Animated.View>
  );
}

/**
 * Sistem mesajı — çağrı kayıtları ve aktivite davetleri.
 * Kimseye ait olmadığı için ortada, baloncuksuz çizilir.
 */
function PollResultNotice({ message, onJump }: { message: ChatMessagePayload; onJump?: (messageId: string) => void }) {
  const result = readPollResult(message.metadata);
  const isChannel = isChannelMessage(message);
  const profile = (isChannel ? message.member?.profile : message.profile) as
    | { name?: string | null; username?: string | null }
    | null
    | undefined;
  const name =
    (isChannel ? message.member?.nickname?.trim() : null) ||
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "Bir kullanıcı";
  if (!result) return null;
  const targetId = result.pollMessageId;
  const canJump = Boolean(onJump);
  const outcome = describePollOutcome(result);

  return (
    <Pressable
      onPress={onJump ? () => onJump(targetId) : undefined}
      disabled={!canJump}
      accessibilityRole="button"
      accessibilityLabel={`${possessiveName(name)} anketi sona erdi: ${result.question}. ${outcome}. Anketi gör`}
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
      <Icon name="list" size={14} color={colors.brand} />
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }} numberOfLines={3}>
        <Text style={{ ...fw(700), color: colors.text }}>{emojify(possessiveName(name), `poll-result-${message.id}`, 16)}</Text>
        {" anketi sona erdi: "}
        <Text style={{ ...fw(700), color: colors.text }}>{result.question}</Text>
        {" · "}
        {emojify(outcome, `poll-outcome-${message.id}`, 14)}
        {canJump ? <Text style={{ ...fw(600), color: colors.brand }}>{" Anketi gör"}</Text> : null}
      </Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(message.createdAt)}</Text>
    </Pressable>
  );
}

function SystemMessage({ message }: { message: ChatMessagePayload }) {
  const scope = useChatScope();
  // Güvenlik uyarısı (web lib/safety): eylem düğmeli kart.
  const safetyAlert = (message.type as string) === "AUTOMOD_ALERT" ? readSafetyAlert(message.metadata) : null;
  if (safetyAlert) return <SafetyAlertCard serverId={scope?.serverId} messageId={message.id} alert={safetyAlert} createdAt={message.createdAt} />;
  return <PlainSystemMessage message={message} />;
}

/** AutoMod v2 uyarısının kural etiketi (web chat-message-group ile aynı: ad · gönderildi · karantina). */
function automodRuleTag(metadata: unknown, t: ReturnType<typeof useT>): string | null {
  const automod = metadata && typeof metadata === "object" ? (metadata as { automod?: unknown }).automod : null;
  if (!automod || typeof automod !== "object") return null;
  const a = automod as { ruleName?: unknown; allowed?: unknown; quarantined?: unknown };
  if (typeof a.ruleName !== "string") return null;
  return `${a.ruleName}${a.allowed === true ? ` · ${t("safety.alert.allowedTag")}` : ""}${a.quarantined === true ? ` · ${t("safety.alert.quarantinedTag")}` : ""}`;
}

function PlainSystemMessage({ message }: { message: ChatMessagePayload }) {
  const t = useT();
  const { icon, tint } = systemStyle(message.type);
  const ruleTag = (message.type as string) === "AUTOMOD_ALERT" ? automodRuleTag(message.metadata, t) : null;

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
        {ruleTag ? <Text style={{ ...fw(600) }}>{`  [${ruleTag}]`}</Text> : null}
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
    // Katılım başvurusu gerekiyorsa form açılır (web davet sayfası ile aynı).
    onError: (reason) => {
      if (invite.data) openApplicationIfRequired(reason, invite.data.id, inviteCode);
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
