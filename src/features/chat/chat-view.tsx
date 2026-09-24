import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";

import { ApiError } from "@/api/client";
import { useChatMessages, type ChatKind } from "@/api/hooks";
import {
  EmptyState,
  ErrorState,
  IconButton,
  KeyboardAvoider,
  ListSkeleton,
} from "@/components/ui";
import { useChatStream } from "@/realtime/use-chat-stream";
import { useReadState } from "@/realtime/use-read-state";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { useChatOutbox } from "@/stores/outbox";
import { pickAndUploadMessageFile, type MessageAttachment } from "@/lib/uploads";
import { OFFICIAL_FOOTER_TITLE } from "@/lib/official";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { DaySeparator } from "./components/day-separator";
import { ComposerPicker, type ComposerPickerTab } from "./components/composer-picker";
import { MessageItem } from "./components/message-item";
import { OutboxItem } from "./components/outbox-item";
import { useComposer } from "./use-composer";
import { useChatItems, type ChatItem } from "./use-chat-items";
import { useMessageActions, type ReportReason } from "./use-message-actions";

/**
 * Kanal ve DM sohbetlerinin ortak gövdesi.
 *
 * İkisi arasındaki tek fark uç noktalar; hem geçmiş sayfalaması hem canlı
 * akış aynı `chatId` üzerinden çalışır. Bu yüzden ayrı iki ekran yerine
 * tek görünüm iki rota tarafından kullanılır.
 */
export function ChatView({
  kind,
  chatId,
  serverId,
  placeholder,
  readOnlyOfficial = false,
  oneToOne = false,
}: {
  kind: ChatKind;
  chatId: string;
  /** Kanal mesajı gönderimi sunucu kimliğini de ister. */
  serverId?: string;
  placeholder: string;
  /** Ciklet resmî bildirim sohbeti tek yönlüdür. */
  readOnlyOfficial?: boolean;
  /**
   * Birebir sohbet (ve Notlarım): karşı tarafın adı ve avatarı her
   * baloncukta tekrarlanmaz — kim olduğu başlıkta zaten yazıyor.
   */
  oneToOne?: boolean;
}) {
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatMessages(kind, chatId);

  const { typers, notifyTyping } = useTyping(chatId);
  const { send, retry, discard } = useComposer(kind, chatId, serverId);
  const outbox = useChatOutbox(chatId);
  const myId = useAuth((state) => state.profile?.id);
  const actions = useMessageActions(kind, chatId, serverId);

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır.
  useChatStream(chatId);

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessagePayload | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessagePayload | null>(null);
  const composerRef = useRef<TextInput>(null);
  /** Kaydırma yönünü anlamak için son dikey konum. */
  const lastOffset = useRef(0);

  /**
   * Sohbete girer girmez klavye açılır — mesaj yazmak birincil eylem.
   * Kısa gecikme ekran geçiş animasyonunun bitmesini bekler; animasyon
   * sırasında odaklanınca klavye yarı yolda takılıyor.
   */
  useEffect(() => {
    // İlk yükleme 350 ms'den uzun sürerse composer henüz bağlı değildir.
    // Yükleme bittiğinde efekt yeniden çalışır ve klavye güvenilir açılır.
    if (isLoading || readOnlyOfficial) return;
    const timer = setTimeout(() => composerRef.current?.focus(), 220);
    return () => clearTimeout(timer);
  }, [chatId, isLoading, readOnlyOfficial]);

  /**
   * Kullanıcı ESKİ mesajlara doğru kaydırdığında klavye kapanır ve yazma
   * çubuğu aşağı iner — okurken ekranın yarısı klavyeyle kaplı olmamalı.
   * Liste ters (`inverted`) olduğu için ARTAN offset geçmişe gitmek demek.
   */
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const goingBack = y > lastOffset.current + 12;
      lastOffset.current = y;
      if (goingBack) Keyboard.dismiss();
    },
    []
  );

  const messages = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );
  const items = useChatItems(messages, !hasNextPage && !isLoading);

  // Okundu bilgisi — listedeki en yeni GERÇEK mesaj (outbox hariç).
  useReadState(chatId, kind, messages[0]?.id);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (text.length > 0) notifyTyping();
    },
    [notifyTyping]
  );

  const onSend = useCallback(() => {
    if (!draft.trim() && !attachment) return;
    send(draft, attachment?.url, attachment?.name, replyingTo?.id);
    setDraft("");
    setAttachment(null);
    setReplyingTo(null);
  }, [attachment, draft, replyingTo?.id, send]);

  const onSelectGif = useCallback((url: string) => {
    send("", url, "GIF");
  }, [send]);

  const onSelectActivity = useCallback((activityId: string) => {
    router.push({
      pathname: "/activities/[clientId]",
      params: { clientId: activityId, chatId },
    });
  }, [chatId]);

  const onPickAttachment = useCallback(async () => {
    setUploadError(null);
    setUploadProgress(0);
    try {
      const file = await pickAndUploadMessageFile(setUploadProgress);
      if (file) setAttachment(file);
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : "Dosya yüklenemedi."
      );
    } finally {
      setUploadProgress(null);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === "day" ? (
        <DaySeparator iso={item.iso} />
      ) : (
        <MessageItem
          oneToOne={oneToOne}
          message={item.message}
          grouped={item.grouped}
          onLongPress={readOnlyOfficial ? undefined : setSelectedMessage}
          onReactionPress={(message, emoji) => {
            void actions.toggleReaction(message.id, emoji);
          }}
        />
      ),
    [actions, readOnlyOfficial, oneToOne]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.chat }}>
        <ListSkeleton rows={8} />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof ApiError ? error.message : "Mesajlar yüklenemedi."}
        onRetry={() => void refetch()}
      />
    );
  }

  // DM başlığı "yazıyor…"u zaten gösteriyor; alt satır yalnızca kanallarda.
  const typing = kind === "channel" ? typingLabel(typers) : null;

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.chat }}>
      <FlatList
        inverted
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        /**
         * Zemin rengi listenin KENDİSİNDE açıkça verilir.
         * Ölçümle görüldü: bazı ekranlarda liste yüzeyi kap rengini değil,
         * altındaki native ekran yüzeyini gösteriyordu (#313235 — hiçbir
         * token'a karşılık gelmeyen, üzerine beyaz katman binmiş bir ton).
         * Rengi burada sabitlemek, react-native-screens'in ne yaptığından
         * bağımsız olarak doğru sonucu garanti eder.
         */
        style={{ backgroundColor: colors.chat }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardDismissMode="interactive"
        onScroll={onScroll}
        scrollEventThrottle={64}
        /**
         * Uzun sohbetlerde bellek ve kare süresi ayarı. Değerler ölçülerek
         * değil, mesaj satırının yüksekliği (~56pt) ve tipik ekran boyu
         * baz alınarak seçildi; cihazda profillenmeleri gerekir.
         *
         * NOT: `@shopify/flash-list` bilinçli olarak KULLANILMADI —
         * v2 tersine (inverted) listelerde farklı davranıyor ve fiziksel
         * cihazda doğrulanmadan geçilmesi sohbet kaydırmasında regresyon
         * riski taşıyor.
         */
        initialNumToRender={16}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        /**
         * Ters listede "header" görsel olarak EN ALTTA durur — bekleyen
         * mesajların doğru yeri burası (en yeni içerik altta).
         */
        ListHeaderComponent={
          outbox.length > 0 ? (
            <View>
              {/* Ters çizimde sıra da tersine döner; en yenisi altta kalsın. */}
              {[...outbox].reverse().map((message) => (
                <OutboxItem
                  key={message.id}
                  message={message}
                  onRetry={() => retry(message.id, message.content)}
                  onDiscard={() => discard(message.id)}
                />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.muted}
              style={{ marginVertical: spacing.lg }}
            />
          ) : null
        }
        contentContainerStyle={
          items.length === 0 && outbox.length === 0
            ? { flex: 1 }
            : { paddingVertical: spacing.sm }
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            <EmptyState
              icon="message"
              title="Sohbet burada başlıyor"
              description="İlk mesajı sen gönder."
            />
          </View>
        }
      />

      {typing && !readOnlyOfficial ? (
        <Text
          style={{
            ...typography.caption,
            color: colors.muted,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xs,
            backgroundColor: colors.chat,
          }}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
        >
          {typing}
        </Text>
      ) : null}

      {readOnlyOfficial ? (
        <OfficialFooter />
      ) : (
        <Composer
          ref={composerRef}
          value={draft}
          onChangeText={onChangeDraft}
          onSend={onSend}
          attachment={attachment}
          replyingTo={replyingTo}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          onPickAttachment={onPickAttachment}
          onRemoveAttachment={() => setAttachment(null)}
          onCancelReply={() => setReplyingTo(null)}
          onSelectGif={onSelectGif}
          onSelectActivity={onSelectActivity}
          placeholder={placeholder}
        />
      )}

      {selectedMessage ? (
        <MessageActionsSheet
          key={selectedMessage.id}
          message={selectedMessage}
          isMine={messageAuthorId(selectedMessage) === myId}
          pending={actions.pending}
          error={actions.error}
          onClose={() => {
            actions.clearError();
            setSelectedMessage(null);
          }}
          onReact={async (emoji) => {
            const ok = await actions.toggleReaction(selectedMessage.id, emoji);
            if (ok) setSelectedMessage(null);
          }}
          onReply={() => {
            setReplyingTo(selectedMessage);
            setSelectedMessage(null);
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
          onEdit={async (content) => {
            const ok = await actions.edit(selectedMessage.id, content);
            if (ok) setSelectedMessage(null);
          }}
          onDelete={() =>
            Alert.alert("Mesajı sil", "Bu mesaj herkes için silinecek.", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Sil",
                style: "destructive",
                onPress: () => {
                  void actions.remove(selectedMessage.id).then((ok) => {
                    if (ok) setSelectedMessage(null);
                  });
                },
              },
            ])
          }
          onReport={
            messageAuthorId(selectedMessage) === myId
              ? undefined
              : async (reason, detail) => {
                  const ok = await actions.report(
                    selectedMessage.id,
                    messageAuthorId(selectedMessage),
                    reason,
                    detail
                  );
                  if (ok) setSelectedMessage(null);
                }
          }
        />
      ) : null}
    </KeyboardAvoider>
  );
}

/** Webde input'un yerine geçen tek yönlü resmî bildirim bandı. */
function OfficialFooter() {
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xs }}>
      <View
        style={{
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
        }}
      >
        <Text style={{ ...typography.caption, fontWeight: "500", color: colors.muted }}>
          {OFFICIAL_FOOTER_TITLE}
        </Text>
      </View>
    </View>
  );
}

function messageAuthorId(message: ChatMessagePayload) {
  return isChannelMessage(message) ? message.member.profile.id : message.profile.id;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function MessageActionsSheet({
  message,
  isMine,
  pending,
  error,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onReport,
}: {
  message: ChatMessagePayload;
  isMine: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onReact: (emoji: string) => Promise<void>;
  onReply: () => void;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => void;
  onReport?: (reason: ReportReason, detail: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [content, setContent] = useState(message.content);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetail, setReportDetail] = useState("");

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Mesaj eylemlerini kapat"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: colors.scrim,
          }}
        />
        <View
          style={{
            padding: spacing.lg,
            paddingBottom: spacing["3xl"],
            gap: spacing.lg,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: radii.full,
              backgroundColor: colors.border,
              alignSelf: "center",
            }}
          />

          {reporting ? (
            <View style={{ gap: spacing.md }}>
              <Text style={{ ...typography.display, color: colors.bright }}>Mesajı şikâyet et</Text>
              <View style={{ gap: spacing.xs }}>
                {REPORT_REASONS.map((reason) => (
                  <Pressable
                    key={reason.value}
                    onPress={() => setReportReason(reason.value)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      minHeight: 40,
                      paddingHorizontal: spacing.md,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: reportReason === reason.value ? colors.brand : colors.border,
                      backgroundColor: pressed || reportReason === reason.value ? colors.raised : colors.panel,
                    })}
                  >
                    <View style={{ width: 14, height: 14, borderRadius: radii.full, borderWidth: 2, borderColor: reportReason === reason.value ? colors.brand : colors.muted, alignItems: "center", justifyContent: "center" }}>
                      {reportReason === reason.value ? <View style={{ width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.brand }} /> : null}
                    </View>
                    <Text style={{ ...typography.caption, color: colors.text }}>{reason.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reportDetail}
                onChangeText={setReportDetail}
                placeholder="Eklemek istediğin detay (isteğe bağlı)"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                style={{ minHeight: 72, maxHeight: 120, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.panel, color: colors.bright, textAlignVertical: "top", ...typography.body }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <SheetButton label="Geri" onPress={() => setReporting(false)} />
                <SheetButton label="Şikâyet Et" destructive disabled={!reportReason || pending} onPress={() => reportReason && void onReport?.(reportReason, reportDetail)} />
              </View>
            </View>
          ) : editing ? (
            <View style={{ gap: spacing.md }}>
              <Text style={{ ...typography.display, color: colors.bright }}>
                Mesajı düzenle
              </Text>
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
                <SheetButton label="Vazgeç" onPress={() => setEditing(false)} />
                <SheetButton
                  label="Kaydet"
                  primary
                  disabled={!content.trim() || pending}
                  onPress={() => void onEdit(content.trim())}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => void onReact(emoji)}
                    disabled={pending}
                    accessibilityRole="button"
                    accessibilityLabel={`${emoji} tepkisi ekle veya kaldır`}
                    style={({ pressed }) => ({
                      width: 46,
                      height: 46,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radii.full,
                      backgroundColor: pressed ? colors.raised : colors.panel,
                      opacity: pending ? 0.5 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 23 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <SheetButton label="Yanıtla" onPress={onReply} />

              {isMine ? (
                <View style={{ gap: spacing.sm }}>
                  <SheetButton label="Mesajı düzenle" onPress={() => setEditing(true)} />
                  <SheetButton label="Mesajı sil" destructive onPress={onDelete} />
                </View>
              ) : onReport ? (
                <SheetButton label="Şikâyet et" destructive onPress={() => setReporting(true)} />
              ) : null}
            </>
          )}

          {error ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
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
        backgroundColor: primary
          ? colors.brand
          : destructive
            ? colors.panel
            : pressed
              ? colors.raised
              : colors.panel,
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

/** Mesaj yazma çubuğu. */
const Composer = forwardRef<
  TextInput,
  {
    value: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    placeholder: string;
    attachment: MessageAttachment | null;
    replyingTo: ChatMessagePayload | null;
    uploadProgress: number | null;
    uploadError: string | null;
    onPickAttachment: () => void;
    onRemoveAttachment: () => void;
    onCancelReply: () => void;
    onSelectGif: (url: string) => void;
    onSelectActivity: (activityId: string) => void;
  }
>(function Composer(
  {
    value,
    onChangeText,
    onSend,
    placeholder,
    attachment,
    replyingTo,
    uploadProgress,
    uploadError,
    onPickAttachment,
    onRemoveAttachment,
    onCancelReply,
    onSelectGif,
    onSelectActivity,
  },
  ref
) {
  const canSend = value.trim().length > 0 || Boolean(attachment);
  const isUploading = uploadProgress !== null;
  const [picker, setPicker] = useState<ComposerPickerTab | null>(null);

  const openPicker = (tab: ComposerPickerTab) => {
    Keyboard.dismiss();
    setPicker(tab);
  };

  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.deep,
        gap: spacing.sm,
      }}
    >
      {attachment ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            borderCurve: "continuous",
            backgroundColor: colors.panel,
          }}
        >
          <IconButton
            icon="attachment"
            label="Ek"
            background="transparent"
            tint={colors.brand}
            disabled
            size={28}
          />
          <Text style={{ ...typography.caption, color: colors.text, flex: 1 }} numberOfLines={1}>
            {attachment.name}
          </Text>
          <IconButton
            icon="close"
            label="Eki kaldır"
            background="transparent"
            tint={colors.muted}
            onPress={onRemoveAttachment}
            size={28}
          />
        </View>
      ) : null}

      {replyingTo ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderLeftWidth: 2,
            borderLeftColor: colors.brand,
            borderRadius: radii.sm,
            backgroundColor: colors.panel,
          }}
        >
          <IconButton
            icon="reply"
            label="Yanıt"
            background="transparent"
            tint={colors.brand}
            disabled
            size={28}
          />
          <Text style={{ ...typography.caption, color: colors.text, flex: 1 }} numberOfLines={1}>
            {replyingTo.content}
          </Text>
          <IconButton
            icon="close"
            label="Yanıtı iptal et"
            background="transparent"
            tint={colors.muted}
            onPress={onCancelReply}
            size={28}
          />
        </View>
      ) : null}

      {isUploading || uploadError ? (
        <Text style={{ ...typography.caption, color: uploadError ? colors.danger : colors.muted }}>
          {uploadError ?? `Dosya yükleniyor… %${Math.round(uploadProgress ?? 0)}`}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <IconButton
          icon="plus"
          label="Dosya ekle"
          background="transparent"
          tint={colors.muted}
          disabled={isUploading}
          onPress={onPickAttachment}
        />

        <IconButton
          icon="compass"
          label="Aktivite seç"
          background="transparent"
          tint={colors.muted}
          onPress={() => openPicker("activity")}
        />

        <Pressable
          onPress={() => openPicker("gif")}
          accessibilityRole="button"
          accessibilityLabel="GIF seç"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.full,
            backgroundColor: pressed ? colors.raised : "transparent",
          })}
        >
          <Text style={{ fontSize: 11, fontWeight: "900", color: colors.muted }}>GIF</Text>
        </Pressable>

        <View style={{ flex: 1, minHeight: 40, maxHeight: 120, flexDirection: "row", alignItems: "flex-end", borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
          <TextInput
            ref={ref}
            autoFocus
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 40,
              paddingLeft: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.bright,
              ...typography.body,
            }}
            accessibilityLabel="Mesaj yaz"
          />
          <IconButton
            icon="emoji"
            label="Emoji seç"
            background="transparent"
            tint={colors.muted}
            size={36}
            onPress={() => openPicker("emoji")}
          />
        </View>

        <IconButton
          icon="send"
          label="Gönder"
          onPress={onSend}
          disabled={!canSend || isUploading}
          background={canSend ? colors.brand : colors.panel}
          tint={canSend ? colors.onBrand : colors.muted}
          size={40}
          haptic="light"
        />
      </View>

      <ComposerPicker
        key={picker ?? "closed"}
        visible={picker !== null}
        initialTab={picker ?? "emoji"}
        onClose={() => setPicker(null)}
        onEmoji={(emoji) => onChangeText(`${value}${emoji}`)}
        onGif={(url) => {
          setPicker(null);
          onSelectGif(url);
        }}
        onActivity={(activityId) => {
          setPicker(null);
          onSelectActivity(activityId);
        }}
      />
    </View>
  );
});
