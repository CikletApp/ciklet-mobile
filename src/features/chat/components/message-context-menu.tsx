import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";

import { EmojiImage, Icon, KeyboardAvoider, emojify, showToast, type IconName } from "@/components/ui";
import { classifyAttachment, readAttachmentInfo, type AttachmentInfo } from "@/lib/attachments";
import { emojiUrl } from "@/lib/emoji";
import type { ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { isForwardedMessage } from "../forward";
import type { ReportReason } from "../use-message-actions";
import { useDragToDismiss } from "./drag-dismiss";
import { EmojiPickerPanel } from "./emoji-picker";
import { saveAttachment } from "./message-attachment";
import { MessageItem, copyableText, type MessageAnchor } from "./message-item";

/**
 * Mesajın bağlam menüsü — Telegram düzeni.
 *
 * Arka plan bulanıklaşıp kararır; basılı tutulan balonun kopyası tam
 * yerinde odakta kalır, üstünde hızlı tepki çubuğu, altında eylem kartı
 * durur. Grup ekrandan taşacaksa (mesaj çok aşağıda ya da yukarıda) bütün
 * grup birlikte kayar ki çubuk da menü de görünür kalsın.
 *
 * Eylemlerin kendisi (tepki, yanıt, silme…) çağıranda; burası yalnızca
 * sunum ve düzenleme/şikâyet formları.
 */

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

/** Ekran kenarından bırakılan pay. */
const EDGE = spacing.sm;
/** Çubuk–balon ve balon–menü arası. */
const GAP = spacing.sm;
const REACTION_SIZE = 40;
const BAR_PADDING = 6;
const BAR_HEIGHT = REACTION_SIZE + BAR_PADDING * 2;
/** Hızlı tepkiler + "tümü" düğmesi. */
const BAR_WIDTH = BAR_PADDING * 2 + (QUICK_REACTIONS.length + 1) * REACTION_SIZE;
const MENU_WIDTH = 232;
const MENU_PADDING = 6;
const ROW_HEIGHT = 46;
const DIVIDER_HEIGHT = 1 + spacing.xs * 2;
const ERROR_HEIGHT = 48;
/** Ekrandan uzun mesajda kopyanın en az bu kadarı görünsün. */
const MIN_BUBBLE_HEIGHT = 72;

/**
 * Çubuk ve menü için kısa "büyüyerek belirme". ZoomIn sıfırdan büyüdüğü
 * için fazla sert duruyor; Telegram'daki gibi hafif ölçek + solma.
 */
const POP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.86 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(180);

type Mode = "menu" | "picker" | "edit" | "report";

interface MenuAction {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}

export function MessageContextMenu({
  message,
  anchor,
  isMine,
  oneToOne,
  pending,
  error,
  blurTarget,
  onClose,
  onReact,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReport,
  pin,
}: {
  message: ChatMessagePayload;
  /** Basılı tutulan balonun pencere koordinatları — kopya buraya çizilir. */
  anchor: MessageAnchor;
  isMine: boolean;
  oneToOne: boolean;
  pending: boolean;
  error: string | null;
  /**
   * Android'de bulanıklık yalnızca bir `BlurTargetView`'ın içeriğini
   * bulandırabilir; sohbet gövdesi o hedefin içinde durur.
   */
  blurTarget: RefObject<View | null>;
  onClose: () => void;
  onReact: (emoji: string) => Promise<void>;
  onReply: () => void;
  /** Yalnızca iletilebilir mesajlarda (bkz. `canForwardMessage`). */
  onForward?: () => void;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => void;
  onReport?: (reason: ReportReason, detail: string) => Promise<void>;
  /**
   * Yalnızca sabitlenebilir mesajda ve yetki varsa (DM/grup: herkes;
   * kanal: yönetici/moderatör). `pinned` ise eylem kaldırmadır.
   */
  pin?: { pinned: boolean; onToggle: () => void };
}) {
  const insets = useSystemInsets();
  const myId = useAuth((state) => state.profile?.id);
  const [mode, setMode] = useState<Mode>("menu");
  // Tam emoji sayfası tepeden aşağı çekilince kapanır (composer paneliyle aynı).
  const pickerDrag = useDragToDismiss(onClose);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [content, setContent] = useState(message.content);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetail, setReportDetail] = useState("");

  const text = copyableText(message);
  const attachment = savableAttachment(message);

  // Telegram sırası: yanıtla, kopyala, kaydet, sabitle, ilet, düzenle;
  // yıkıcı olan en altta, ayraçla ayrı.
  const actions: MenuAction[] = [{ key: "reply", icon: "reply", label: "Yanıtla", onPress: onReply }];
  if (text) {
    actions.push({
      key: "copy",
      icon: "copy",
      label: "Kopyala",
      onPress: () => {
        void copyText(text);
        onClose();
      },
    });
  }
  if (attachment) {
    actions.push({
      key: "save",
      icon: "download",
      label: attachment.label,
      onPress: () => {
        // Menü beklemeden kapanır; sonuç kökteki bildirim şeridinde.
        onClose();
        showToast("İndiriliyor…");
        void saveAttachment(attachment.url, attachment.info);
      },
    });
  }
  if (pin) {
    actions.push({
      key: "pin",
      icon: pin.pinned ? "pin-off" : "pin",
      label: pin.pinned ? "Sabitlemeyi kaldır" : "Sabitle",
      onPress: pin.onToggle,
    });
  }
  if (onForward) actions.push({ key: "forward", icon: "forward", label: "İlet", onPress: onForward });
  // İletilen mesaj düzenlenemez (web 403 döner): içerik başkasının sözü.
  if (isMine && !isForwardedMessage(message)) {
    actions.push({ key: "edit", icon: "pencil", label: "Düzenle", onPress: () => setMode("edit") });
  }

  const destructive: MenuAction[] = isMine
    ? [{ key: "delete", icon: "trash", label: "Sil", onPress: onDelete }]
    : onReport
      ? [{ key: "report", icon: "flag", label: "Bildir", onPress: () => setMode("report") }]
      : [];

  const reacted = new Set(
    (message.reactions ?? []).filter((reaction) => reaction.profileId === myId).map((reaction) => reaction.emoji)
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => (mode === "menu" ? onClose() : setMode("menu"))}
    >
      {/* Modal ayrı bir pencere: Android'de hareketlerin çalışması için kendi kökü gerekir. */}
      <GestureHandlerRootView
        style={{ flex: 1 }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame((current) =>
            current && current.width === width && current.height === height ? current : { width, height }
          );
        }}
      >
        {/* Android 12 altında (ve hedef bulunamazsa) yalnızca yarı saydam
            koyu katman kalır — menü yine okunur. */}
        <BlurView
          blurTarget={blurTarget}
          intensity={50}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          style={{ position: "absolute", inset: 0 }}
        />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Mesaj eylemlerini kapat"
          style={{ position: "absolute", inset: 0 }}
        />

        {mode === "menu" && frame ? (
          <FocusGroup
            message={message}
            anchor={anchor}
            isMine={isMine}
            oneToOne={oneToOne}
            frame={frame}
            insets={insets}
            actions={actions}
            destructive={destructive}
            reacted={reacted}
            pending={pending}
            error={error}
            onReact={onReact}
            onExpand={() => setMode("picker")}
          />
        ) : null}

        {mode === "picker" ? (
          <Sheet onDismiss={onClose} fill drag={pickerDrag}>
            <EmojiPickerPanel onEmoji={(emoji) => void onReact(emoji)} headerGesture={pickerDrag.header} />
            {error ? <ErrorText error={error} /> : null}
          </Sheet>
        ) : null}

        {mode === "edit" ? (
          <Sheet onDismiss={onClose}>
            <Text style={{ ...typography.display, color: colors.bright }}>Mesajı düzenle</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              maxLength={2000}
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 96,
                maxHeight: 180,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                backgroundColor: colors.panel,
                color: colors.bright,
                textAlignVertical: "top",
                ...typography.body,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
              <SheetButton label="Vazgeç" onPress={() => setMode("menu")} />
              <SheetButton
                label="Kaydet"
                primary
                disabled={!content.trim() || pending}
                onPress={() => void onEdit(content.trim())}
              />
            </View>
            {error ? <ErrorText error={error} /> : null}
          </Sheet>
        ) : null}

        {mode === "report" ? (
          <Sheet onDismiss={onClose}>
            <Text style={{ ...typography.display, color: colors.bright }}>Mesajı bildir</Text>
            <View style={{ gap: spacing.xs }}>
              {REPORT_REASONS.map((reason) => {
                const chosen = reportReason === reason.value;
                return (
                  <Pressable
                    key={reason.value}
                    onPress={() => setReportReason(reason.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: chosen }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      minHeight: 40,
                      paddingHorizontal: spacing.md,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: chosen ? colors.brand : colors.border,
                      backgroundColor: pressed || chosen ? colors.raised : colors.panel,
                    })}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: radii.full,
                        borderWidth: 2,
                        borderColor: chosen ? colors.brand : colors.muted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {chosen ? (
                        <View style={{ width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.brand }} />
                      ) : null}
                    </View>
                    <Text style={{ ...typography.caption, color: colors.text }}>{reason.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={reportDetail}
              onChangeText={setReportDetail}
              placeholder="Eklemek istediğin detay (isteğe bağlı)"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              style={{
                minHeight: 72,
                maxHeight: 120,
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.panel,
                color: colors.bright,
                textAlignVertical: "top",
                ...typography.body,
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
              <SheetButton label="Geri" onPress={() => setMode("menu")} />
              <SheetButton
                label="Bildir"
                destructive
                disabled={!reportReason || pending}
                onPress={() => reportReason && void onReport?.(reportReason, reportDetail)}
              />
            </View>
            {error ? <ErrorText error={error} /> : null}
          </Sheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Tepki çubuğu + balonun kopyası + eylem kartı; birlikte konumlanır ve kayar. */
function FocusGroup({
  message,
  anchor,
  isMine,
  oneToOne,
  frame,
  insets,
  actions,
  destructive,
  reacted,
  pending,
  error,
  onReact,
  onExpand,
}: {
  message: ChatMessagePayload;
  anchor: MessageAnchor;
  isMine: boolean;
  oneToOne: boolean;
  frame: { width: number; height: number };
  insets: EdgeInsets;
  actions: MenuAction[];
  destructive: MenuAction[];
  reacted: Set<string>;
  pending: boolean;
  error: string | null;
  onReact: (emoji: string) => Promise<void>;
  onExpand: () => void;
}) {
  // Satır yükseklikleri sabit; menü ölçülmeden önce konum hesaplanabilsin
  // diye yükseklik buradan çıkarılır (ilk karede zıplama olmaz).
  const menuHeight =
    MENU_PADDING * 2 +
    2 +
    (actions.length + destructive.length) * ROW_HEIGHT +
    (actions.length > 0 && destructive.length > 0 ? DIVIDER_HEIGHT : 0) +
    (error ? ERROR_HEIGHT : 0);
  const place = placeGroup(anchor, frame, insets, menuHeight, isMine);

  // Kopya balonun asıl yerinden başlar, grup ekrana sığacak yere kayar.
  const offset = useSharedValue(-place.shift);
  useEffect(() => {
    offset.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [offset]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  const shadow = `0 8px 24px ${colors.shadow}`;

  return (
    <Animated.View pointerEvents="box-none" style={[{ position: "absolute", inset: 0 }, slide]}>
      <Animated.View
        entering={POP_IN}
        style={{
          position: "absolute",
          top: place.bubbleTop - GAP - BAR_HEIGHT,
          left: place.barLeft,
          width: place.barWidth,
          height: BAR_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: BAR_PADDING,
          borderRadius: radii.full,
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
          boxShadow: shadow,
          transformOrigin: isMine ? "bottom right" : "bottom left",
        }}
      >
        {QUICK_REACTIONS.map((emoji) => {
          const chosen = reacted.has(emoji);
          return (
            <Pressable
              key={emoji}
              onPress={() => void onReact(emoji)}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={chosen ? `${emoji} tepkisini kaldır` : `${emoji} tepkisi ekle`}
              style={({ pressed }) => ({
                width: REACTION_SIZE,
                height: REACTION_SIZE,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.full,
                backgroundColor: chosen ? colors.brandSoft : pressed ? colors.raised : "transparent",
                opacity: pending ? 0.5 : 1,
              })}
            >
              <ReactionEmoji emoji={emoji} size={28} />
            </Pressable>
          );
        })}
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel="Başka bir emojiyle tepki ver"
          style={{ width: REACTION_SIZE, height: REACTION_SIZE, alignItems: "center", justifyContent: "center" }}
        >
          {({ pressed }) => (
            <View
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.full,
                backgroundColor: pressed ? colors.border : colors.raised,
              }}
            >
              <Icon name="chevron-down" size={18} color={colors.bright} />
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Odaktaki kopya dokunulmaz: dokunuş arkadaki katmana geçer ve menüyü
          kapatır (Telegram'da da öyle). */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: place.bubbleTop,
          left: anchor.x,
          width: anchor.width,
          height: place.bubbleHeight,
          overflow: "hidden",
        }}
      >
        <View style={{ transform: [{ translateY: -place.clip }] }}>
          <MessageItem preview message={message} grouped={anchor.grouped} oneToOne={oneToOne} />
        </View>
      </View>

      <Animated.View
        entering={POP_IN}
        style={{
          position: "absolute",
          top: place.bubbleTop + place.bubbleHeight + GAP,
          left: place.menuLeft,
          width: place.menuWidth,
          paddingVertical: MENU_PADDING,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
          boxShadow: shadow,
          transformOrigin: isMine ? "top right" : "top left",
        }}
      >
        {actions.map((action) => (
          <MenuRow key={action.key} action={action} />
        ))}
        {actions.length > 0 && destructive.length > 0 ? (
          <View style={{ height: 1, marginVertical: spacing.xs, backgroundColor: colors.border }} />
        ) : null}
        {destructive.map((action) => (
          <MenuRow key={action.key} action={action} destructive />
        ))}
        {error ? (
          <View style={{ height: ERROR_HEIGHT, justifyContent: "center", paddingHorizontal: spacing.lg }}>
            <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.danger }}>
              {error}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

interface Placement {
  /** Kopyanın (görünen diliminin) son konumdaki üst kenarı. */
  bubbleTop: number;
  bubbleHeight: number;
  /** Ekrandan uzun balonda kopyanın üstünden kırpılan kısım. */
  clip: number;
  /** Grubun asıl konumundan ne kadar kaydığı (açılış animasyonu). */
  shift: number;
  barLeft: number;
  barWidth: number;
  menuLeft: number;
  menuWidth: number;
}

/**
 * Telegram yerleşimi: çubuk balonun üstünde, menü altında. Grup ekranın
 * güvenli alanına sığmıyorsa önce alttan, sonra üstten itilerek kaydırılır;
 * balon ikisine de sığmayacak kadar uzunsa yalnızca bir dilimi gösterilir.
 */
function placeGroup(
  anchor: MessageAnchor,
  frame: { width: number; height: number },
  insets: EdgeInsets,
  menuHeight: number,
  isMine: boolean
): Placement {
  const minTop = insets.top + EDGE;
  const maxBottom = frame.height - insets.bottom - EDGE;
  const room = maxBottom - minTop - BAR_HEIGHT - GAP * 2 - menuHeight;
  const bubbleHeight = Math.min(anchor.height, Math.max(room, MIN_BUBBLE_HEIGHT));
  // Uzun balonun, çubuğun altına denk gelen görünür dilimi odaklanır.
  const clip = clamp(minTop + BAR_HEIGHT + GAP - anchor.y, 0, anchor.height - bubbleHeight);
  const naturalTop = anchor.y + clip;

  let top = naturalTop;
  const overflowBottom = top + bubbleHeight + GAP + menuHeight - maxBottom;
  if (overflowBottom > 0) top -= overflowBottom;
  const overflowTop = minTop + BAR_HEIGHT + GAP - top;
  if (overflowTop > 0) top += overflowTop;

  const barWidth = Math.min(BAR_WIDTH, frame.width - EDGE * 2);
  const menuWidth = Math.min(MENU_WIDTH, frame.width - EDGE * 2);
  // Çubuk ve menü balonun kuyruk tarafına hizalanır: kendi mesajında sağa,
  // gelende sola; ekran kenarını aşmaz.
  const align = (width: number) =>
    clamp(isMine ? anchor.x + anchor.width - width : anchor.x, EDGE, frame.width - width - EDGE);

  return {
    bubbleTop: top,
    bubbleHeight,
    clip,
    shift: top - naturalTop,
    barLeft: align(barWidth),
    barWidth,
    menuLeft: align(menuWidth),
    menuWidth,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sistem çubuklarının gerçek payı. Sohbet ekranındaki klavye takibi
 * (`useAnimatedKeyboard`) kök görünümü çubukların arasına sıkıştırıyor ve
 * orada güvenli alan sıfır dönüyor; menü ise çubukların altına uzanan tam
 * ekran bir pencerede. Uygulama açılışındaki ölçüm taban alınır.
 */
function useSystemInsets(): EdgeInsets {
  const insets = useSafeAreaInsets();
  const initial = initialWindowMetrics?.insets;
  return {
    top: Math.max(insets.top, initial?.top ?? 0),
    bottom: Math.max(insets.bottom, initial?.bottom ?? 0),
    left: insets.left,
    right: insets.right,
  };
}

function MenuRow({ action, destructive = false }: { action: MenuAction; destructive?: boolean }) {
  const tint = destructive ? colors.danger : colors.bright;
  return (
    <Pressable
      onPress={action.onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        height: ROW_HEIGHT,
        marginHorizontal: MENU_PADDING,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Icon name={action.icon} size={20} color={tint} />
      <Text numberOfLines={1} style={{ ...typography.body, color: tint, flex: 1 }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/** Tepki emojisi daima Twemoji görseli; tanınmayan bir şey gelirse metin. */
function ReactionEmoji({ emoji, size }: { emoji: string; size: number }) {
  const url = emojiUrl(emoji);
  if (url) return <EmojiImage url={url} size={size} label={emoji} />;
  return <Text style={{ fontSize: Math.round(size * 0.8) }}>{emojify(emoji, `q-${emoji}`, size)}</Text>;
}

/**
 * Alt sayfa — tüm emojiler, düzenleme ve şikâyet formu. Klavye açıldığında
 * yukarı kalkar (uygulama edge-to-edge; pencere kendiliğinden küçülmüyor).
 */
function Sheet({
  children,
  onDismiss,
  fill = false,
  drag,
}: {
  children: ReactNode;
  onDismiss: () => void;
  /** Emoji seçici: sabit yükseklik, kenar boşluğunu panel kendisi veriyor. */
  fill?: boolean;
  /** Verilirse tutamaçtan aşağı çekince kapanır (bkz. drag-dismiss.ts). */
  drag?: ReturnType<typeof useDragToDismiss>;
}) {
  const insets = useSystemInsets();
  return (
    <KeyboardAvoider applySafeArea={false} style={{ justifyContent: "flex-end" }}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ position: "absolute", inset: 0 }}
      />
      <Animated.View
        entering={SlideInDown.duration(200)}
        style={[{
          height: fill ? "62%" : undefined,
          padding: fill ? 0 : spacing.lg,
          paddingTop: fill ? spacing.sm : spacing.lg,
          paddingBottom: insets.bottom + (fill ? spacing.sm : spacing.lg),
          gap: fill ? 0 : spacing.lg,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderCurve: "continuous",
          backgroundColor: colors.bento,
          overflow: "hidden",
        }, drag?.style]}
      >
        {drag ? (
          <GestureDetector gesture={drag.grab}>
            <View style={{ alignSelf: "stretch", alignItems: "center", paddingVertical: spacing.xs, marginTop: -spacing.xs }}>
              <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border }} />
            </View>
          </GestureDetector>
        ) : (
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: radii.full,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: fill ? spacing.xs : 0,
            }}
          />
        )}
        {children}
      </Animated.View>
    </KeyboardAvoider>
  );
}

function ErrorText({ error }: { error: string }) {
  return (
    <Text style={{ ...typography.caption, color: colors.danger, paddingHorizontal: spacing.xs }}>{error}</Text>
  );
}

function SheetButton({
  label,
  onPress,
  primary,
  destructive,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        minHeight: 46,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: primary ? colors.brand : pressed ? colors.raised : colors.panel,
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text
        style={{
          ...typography.bodyStrong,
          color: primary ? colors.onBrand : destructive ? colors.danger : colors.bright,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "SPAM", label: "Spam veya reklam" },
  { value: "HARASSMENT", label: "Taciz veya zorbalık" },
  { value: "HATE_SPEECH", label: "Nefret söylemi" },
  { value: "VIOLENCE", label: "Şiddet veya tehdit" },
  { value: "SELF_HARM", label: "Kendine zarar / intihar" },
  { value: "CSAM", label: "Çocuk istismarı" },
  { value: "ILLEGAL", label: "Yasa dışı içerik" },
  { value: "IMPERSONATION", label: "Taklit / sahtecilik" },
  { value: "OTHER", label: "Diğer" },
];

/**
 * "Resmi kaydet" / "Videoyu kaydet" — ek uygulamanın içinde indirilir.
 * Ekin adresini kopyalatan ya da tarayıcıda açan bir eylem bilinçli olarak
 * YOK: kullanıcı Ciklet dışına gönderilmez.
 */
function savableAttachment(
  message: ChatMessagePayload
): { url: string; info: AttachmentInfo | null; label: string } | null {
  if (!message.fileUrl || message.deleted) return null;
  const info = readAttachmentInfo(message.metadata);
  const kind = classifyAttachment(message.fileUrl, info);
  const label =
    kind === "image" || kind === "probe"
      ? "Resmi kaydet"
      : kind === "video"
        ? "Videoyu kaydet"
        : "Dosyayı kaydet";
  return { url: message.fileUrl, info, label };
}

/**
 * Panoya kopyalar. expo-clipboard YEREL bir modül: modül üst düzeyde içe
 * aktarılsaydı bu JS bir OTA güncellemesiyle modülü içermeyen eski bir
 * APK'ya ulaştığında uygulama açılışta çökerdi. Tembel yükleme + yutulan
 * hata ile en kötü durumda yalnızca kopyalama çalışmaz.
 */
async function copyText(text: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(text);
  } catch {
    // Eski yerel derleme: kopyalama yok, ama uygulama ayakta.
  }
}
