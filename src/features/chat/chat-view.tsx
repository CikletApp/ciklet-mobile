import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";
import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { useChatMessages, useMentolPlan, useMyMembership, type ChatKind } from "@/api/hooks";
import { EmptyState, ErrorState, ListSkeleton, showDialog, showToast } from "@/components/ui";
import { useChatStream } from "@/realtime/use-chat-stream";
import { useReadState } from "@/realtime/use-read-state";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useActiveChat } from "@/stores/active-chat";
import { useAuth } from "@/stores/auth";
import { useChatOutbox } from "@/stores/outbox";
import { usePreferences } from "@/stores/preferences";
import {
  captureFromCamera,
  pickDocument,
  pickFromGallery,
  uploadMessageAttachment,
  type MessageAttachment,
} from "@/lib/uploads";
import { OFFICIAL_FOOTER_TITLE } from "@/lib/official";
import { isAfterSnowflake } from "@/lib/snowflake";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { AttachmentSheet, type AttachmentSource } from "./components/attachment-sheet";
import { DaySeparator } from "./components/day-separator";
import { CommandSuggestions, matchCommands, useBotCommands } from "./components/command-suggestions";
import { Composer, type ComposerHandle } from "./components/composer";
import { ForwardSheet } from "./components/forward-sheet";
import { MessageContextMenu } from "./components/message-context-menu";
import { flashMessage } from "./components/message-flash";
import { MessageItem, type MessageAnchor } from "./components/message-item";
import { OutboxItem } from "./components/outbox-item";
import { PinnedBar, PinnedListSheet } from "./components/pinned-bar";
import { canForwardMessage } from "./forward";
import { canBePinned, pinnedAtOf, usePinAction, usePins } from "./pins";
import { useComposer } from "./use-composer";
import { authorIdOf, useChatItems, type ChatItem } from "./use-chat-items";
import { useMessageActions } from "./use-message-actions";
import { fw } from "@/theme/fonts";

/** Atlanacak mesaj bulunana kadar en çok bu kadar eski sayfa çekilir. */
const MAX_JUMP_PAGES = 15;

/**
 * Okunmamış ayracının tohumu — DM'de okundu imleci (snowflake), kanalda
 * okunmamış sayısı. `undefined` = kaynak henüz yüklenmedi, bekle.
 */
export interface UnreadSeed {
  cursor?: string | null;
  count?: number;
}

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
  unreadSeed,
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
  /** "Yeni mesajlar" ayracı için okunmamış bilgisi; yoksa ayraç çizilmez. */
  unreadSeed?: UnreadSeed;
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
  const insets = useSafeAreaInsets();
  // "/" komutları yalnızca sunucu kanallarında (botlar orada).
  const commandBots = useBotCommands(
    kind === "channel" && !readOnlyOfficial ? serverId : undefined,
    kind === "channel" ? chatId : undefined
  );

  // Sabitlenen mesajlar. Yetki kuralı web'le aynı (sunucu yine denetler):
  // DM ve grupta herkes, kanalda yönetici ve moderatör.
  const pins = usePins(kind, chatId);
  const pinAction = usePinAction(kind, chatId);
  const membership = useMyMembership(kind === "channel" ? serverId : undefined);
  const canPin =
    !readOnlyOfficial &&
    (kind !== "channel" ||
      membership.data?.role === MemberRole.ADMIN ||
      membership.data?.role === MemberRole.MODERATOR);
  const [pinListOpen, setPinListOpen] = useState(false);

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır; kopuklukta telafi edilir.
  useChatStream(kind, chatId);

  // Açık sohbet: bildirim katmanı bu sohbetin mesajı için kart/ses üretmez.
  useEffect(() => {
    useActiveChat.getState().setActive(chatId);
    return () => {
      if (useActiveChat.getState().chatId === chatId) useActiveChat.getState().setActive(null);
    };
  }, [chatId]);

  /**
   * Sohbet arka planı — Mentol özelliği (yalnızca bu cihazda, bkz.
   * settings/chat). Plan bilgisi gelmeden görsel gizlenmez: açılışta bir
   * an boş zemin görünüp sonra görsel gelmesi göz yoruyordu; plan FREE'ye
   * düştüğü an zaten kaldırılıyor.
   */
  const chatBackgroundUri = usePreferences((state) => state.chatBackgroundUri);
  const chatBackgroundDim = usePreferences((state) => state.chatBackgroundDim);
  const plan = useMentolPlan();
  const showBackground = Boolean(chatBackgroundUri) && (plan.data?.features.customThemes ?? true);
  const surface = showBackground ? "transparent" : colors.chat;

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [attachmentSheet, setAttachmentSheet] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Basılı tutulan mesaj ve balonunun ekrandaki yeri (bağlam menüsü). */
  const [selected, setSelected] = useState<{ message: ChatMessagePayload; anchor: MessageAnchor } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessagePayload | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessagePayload | null>(null);
  const composerRef = useRef<TextInput>(null);
  /** Yazma çubuğunun paneline (emoji/GIF/aktivite) dışarıdan erişim. */
  const composerControl = useRef<ComposerHandle>(null);
  /** Bağlam menüsünün Android'de bulandırdığı yüzey — sohbet gövdesi. */
  const blurTargetRef = useRef<View>(null);
  /** Kaydırma yönünü anlamak için son dikey konum. */
  const lastOffset = useRef(0);
  const listRef = useRef<FlatList<ChatItem>>(null);
  /** Yüklü sayfalarda henüz bulunamayan atlama hedefi; eski sayfalar geldikçe yeniden denenir. */
  const pendingJump = useRef<{ id: string; pages: number } | null>(null);
  /** `scrollToIndex` henüz ölçülmemiş satırda başarısız olunca kaç kez yeniden denendi. */
  const scrollRetries = useRef(0);
  /**
   * Atlama zinciri olay işleyicilerinden ve karelerden yürüyor; en güncel
   * liste ve sayfa durumu buradan okunur (kapanıştaki eski değer değil).
   */
  const latest = useRef<{ items: ChatItem[]; hasNextPage: boolean; isFetchingNextPage: boolean }>({
    items: [],
    hasNextPage: false,
    isFetchingNextPage: false,
  });

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
   * Kullanıcı ESKİ mesajlara doğru kaydırdığında klavye VE emoji/GIF/aktivite
   * paneli kapanır, yazma çubuğu aşağı iner — okurken ekranın yarısı
   * klavyeyle ya da panelle kaplı olmamalı. Liste ters (`inverted`) olduğu
   * için ARTAN offset geçmişe gitmek demek.
   */
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const goingBack = y > lastOffset.current + 12;
      lastOffset.current = y;
      if (goingBack) {
        Keyboard.dismiss();
        composerControl.current?.closePanel();
      }
    },
    []
  );

  const messages = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  /**
   * "Yeni mesajlar" ayracı sohbet başına BİR KEZ tohumlanır (web
   * chat-message-list ile aynı): okundu imleci açılışta hemen ilerlediği
   * için canlı değerden türetilseydi ayraç bir kare sonra kaybolurdu.
   */
  const [unreadMarker, setUnreadMarker] = useState<string | null | undefined>(undefined);
  // Türetilmiş durum: koşullu, render sırasında ve yalnızca bir kez
  // (React'in "prop değişince durumu ayarla" deseni; efekt + setState
  // ardışık render üretirdi).
  if (unreadMarker === undefined && unreadSeed !== undefined && messages.length > 0) {
    setUnreadMarker(seedUnreadMarker(messages, myId, unreadSeed));
  }

  const items = useChatItems(messages, !hasNextPage && !isLoading, unreadMarker ?? null);

  // Okundu bilgisi — listedeki en yeni GERÇEK mesaj (outbox hariç).
  useReadState(chatId, kind, messages[0]?.id);

  useEffect(() => {
    latest.current = { items, hasNextPage: Boolean(hasNextPage), isFetchingNextPage };
  }, [items, hasNextPage, isFetchingNextPage]);

  /** Mesaj yüklü listedeyse ortasına kaydırır ve kısa vurgular. */
  const scrollToMessage = useCallback((messageId: string): boolean => {
    const index = latest.current.items.findIndex(
      (item) => item.kind === "message" && item.message.id === messageId
    );
    if (index < 0) return false;
    scrollRetries.current = 0;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    flashMessage(messageId);
    return true;
  }, []);

  /**
   * Hedef yüklü değil: bir eski sayfa daha çekilir. Cache yalnızca eskiye
   * doğru sayfalandığı için `?around=` yerine bu yol; en çok 15 sayfa.
   */
  const continueJump = useCallback(() => {
    const pending = pendingJump.current;
    if (!pending) return;
    if (!latest.current.hasNextPage || pending.pages >= MAX_JUMP_PAGES) {
      pendingJump.current = null;
      showToast("Mesaj bulunamadı");
      return;
    }
    pending.pages += 1;
    void fetchNextPage();
  }, [fetchNextPage]);

  /** Sabit çubuğu, sabit listesi, "bir mesajı sabitledi" satırı ve alıntılar buraya gelir. */
  const jumpToMessage = useCallback(
    (messageId: string) => {
      pendingJump.current = null;
      if (scrollToMessage(messageId)) return;
      pendingJump.current = { id: messageId, pages: 0 };
      if (!latest.current.isFetchingNextPage) continueJump();
    },
    [scrollToMessage, continueJump]
  );

  // Atlama hedefi eski sayfalardaysa her yeni sayfada yeniden denenir. Yeni
  // satırlar listeye yerleşsin diye bir kare beklenir.
  useEffect(() => {
    if (!pendingJump.current || isFetchingNextPage) return;
    const frame = requestAnimationFrame(() => {
      const pending = pendingJump.current;
      if (!pending) return;
      if (scrollToMessage(pending.id)) pendingJump.current = null;
      else continueJump();
    });
    return () => cancelAnimationFrame(frame);
  }, [items, isFetchingNextPage, scrollToMessage, continueJump]);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (text.length > 0) notifyTyping();
    },
    [notifyTyping]
  );

  const onSend = useCallback(() => {
    if (!draft.trim() && !attachment) return;
    send(draft, attachment ?? undefined, replyingTo?.id);
    setDraft("");
    setAttachment(null);
    setReplyingTo(null);
  }, [attachment, draft, replyingTo?.id, send]);

  const onSelectGif = useCallback((url: string) => {
    send("", { url, name: "GIF", mimeType: "image/gif" });
  }, [send]);

  const onSelectActivity = useCallback((activityId: string) => {
    router.push({
      pathname: "/activities/[clientId]",
      params: { clientId: activityId, chatId, ...(serverId ? { serverId } : {}) },
    });
  }, [chatId, serverId]);

  /**
   * "+" düğmesi: önce kaynak sorulur (Galeri / Kamera / Dosya), sonra seçilen
   * dosya yüklenir ve çubuğa ek olarak takılır. Eskiden doğrudan dosya
   * seçicisi açılıyordu; galeriden fotoğraf göndermek dolambaçlıydı.
   */
  const onPickAttachment = useCallback(() => {
    Keyboard.dismiss();
    setAttachmentSheet(true);
  }, []);

  const onAttachmentSource = useCallback(async (source: AttachmentSource) => {
    setUploadError(null);
    try {
      const picked =
        source === "gallery"
          ? await pickFromGallery({ videos: true })
          : source === "camera"
            ? await captureFromCamera()
            : await pickDocument();
      if (!picked) return;
      setUploadProgress(0);
      const file = await uploadMessageAttachment(picked, setUploadProgress);
      setAttachment(file);
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : "Dosya yüklenemedi."
      );
    } finally {
      setUploadProgress(null);
    }
  }, []);

  const onLongPressMessage = useCallback((message: ChatMessagePayload, anchor: MessageAnchor) => {
    setSelected({ message, anchor });
  }, []);

  /** Satır sola çekildi: alıntı takılır ve klavye gelir. */
  const onSwipeReply = useCallback((message: ChatMessagePayload) => {
    setReplyingTo(message);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  /** Komut önerisi seçildi: "/komut " yazılır, imleç sona geçer. */
  const onPickCommand = (name: string) => {
    const next = `/${name} `;
    setDraft(next);
    composerRef.current?.focus();
    requestAnimationFrame(() => composerRef.current?.setSelection(next.length, next.length));
  };

  const commandMatches = matchCommands(commandBots.data ?? [], draft);

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === "day" ? (
        <DaySeparator iso={item.iso} />
      ) : item.kind === "unread" ? (
        <UnreadDivider />
      ) : (
        <MessageItem
          oneToOne={oneToOne}
          message={item.message}
          grouped={item.grouped}
          onLongPress={readOnlyOfficial ? undefined : onLongPressMessage}
          onReply={readOnlyOfficial || item.message.deleted ? undefined : onSwipeReply}
          onReactionPress={(message, emoji) => {
            void actions.toggleReaction(message.id, emoji);
          }}
          onJumpToMessage={jumpToMessage}
        />
      ),
    [actions, readOnlyOfficial, oneToOne, onLongPressMessage, onSwipeReply, jumpToMessage]
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
    // Klavye ve emoji paneli boşluğunu yazma çubuğu kendisi ayırıyor
    // (bkz. components/composer.tsx); burada `KeyboardAvoider` YOK.
    <View style={{ flex: 1, backgroundColor: colors.chat }}>
      {/* Bağlam menüsü açılınca Android'de bulanıklaşan yüzey. Başlık bu
          ekranın dışında (yerel yığın başlığı); o yalnızca kararır. */}
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1, backgroundColor: colors.chat }}>
        {/* Sohbet arka planı: görsel + üstünde zemin renginde kararma katmanı
            (okunabilirlik). Liste bunun üstünde saydam çizilir. */}
        {showBackground && chatBackgroundUri ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
            <Image source={{ uri: chatBackgroundUri }} contentFit="cover" style={{ flex: 1 }} />
            <View style={{ position: "absolute", inset: 0, backgroundColor: colors.chat, opacity: chatBackgroundDim }} />
          </View>
        ) : null}

        {/* Telegram gibi başlığın hemen altında; sabit yoksa hiçbir şey çizmez. */}
        <PinnedBar pins={pins.data ?? []} onJump={jumpToMessage} onOpenList={() => setPinListOpen(true)} />

        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
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
             * bağımsız olarak doğru sonucu garanti eder. Arka plan görseli
             * varsa liste saydamdır; görsel BlurTargetView'ın altında durur.
             */
            style={{ backgroundColor: surface }}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            onScrollToIndexFailed={(info) => {
              // Hedef satır henüz ölçülmedi (sanallaştırma): önce tahmini
              // konuma gidilir, satırlar çizilince yeniden denenir.
              if (scrollRetries.current >= 3) return;
              scrollRetries.current += 1;
              listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true });
              }, 120);
            }}
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
                      onRetry={() => retry(message)}
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

          {/* "/" komut önerileri mesajların üstünde, yazma çubuğunun hemen
              üzerinde yüzer; listenin kabı içinde kaldığı için dokunuşlar
              kesin olarak ona gelir. */}
          {commandMatches.length > 0 ? (
            <CommandSuggestions matches={commandMatches} onPick={onPickCommand} />
          ) : null}
        </View>

        {typing && !readOnlyOfficial ? (
          <Text
            style={{
              ...typography.caption,
              color: colors.muted,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xs,
              backgroundColor: surface,
            }}
            accessibilityLiveRegion="polite"
            numberOfLines={1}
          >
            {typing}
          </Text>
        ) : null}

        {readOnlyOfficial ? (
          <>
            <OfficialFooter />
            <View style={{ height: insets.bottom }} />
          </>
        ) : (
          <Composer
            inputRef={composerRef}
            controlRef={composerControl}
            commandsAvailable={Boolean(commandBots.data?.length)}
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
      </BlurTargetView>

      <AttachmentSheet
        visible={attachmentSheet}
        onClose={() => setAttachmentSheet(false)}
        onPick={(source) => void onAttachmentSource(source)}
      />

      {selected ? (
        <MessageContextMenu
          key={selected.message.id}
          message={selected.message}
          anchor={selected.anchor}
          isMine={messageAuthorId(selected.message) === myId}
          oneToOne={oneToOne}
          pending={actions.pending}
          error={actions.error}
          blurTarget={blurTargetRef}
          onClose={() => {
            actions.clearError();
            setSelected(null);
          }}
          onReact={async (emoji) => {
            const ok = await actions.toggleReaction(selected.message.id, emoji);
            if (ok) setSelected(null);
          }}
          onReply={() => {
            setReplyingTo(selected.message);
            setSelected(null);
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
          onForward={
            canForwardMessage(selected.message)
              ? () => {
                  setForwarding(selected.message);
                  setSelected(null);
                }
              : undefined
          }
          onEdit={async (content) => {
            const ok = await actions.edit(selected.message.id, content);
            if (ok) setSelected(null);
          }}
          onDelete={() =>
            showDialog("Mesajı sil", "Bu mesaj herkes için silinecek.", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Sil",
                style: "destructive",
                onPress: () => {
                  void actions.remove(selected.message.id).then((ok) => {
                    if (ok) setSelected(null);
                  });
                },
              },
            ])
          }
          onReport={
            messageAuthorId(selected.message) === myId
              ? undefined
              : async (reason, detail) => {
                  const ok = await actions.report(
                    selected.message.id,
                    messageAuthorId(selected.message),
                    reason,
                    detail
                  );
                  if (ok) setSelected(null);
                }
          }
          pin={
            canPin && canBePinned(selected.message)
              ? {
                  pinned: Boolean(pinnedAtOf(selected.message)),
                  onToggle: () => {
                    const { id } = selected.message;
                    const pinned = Boolean(pinnedAtOf(selected.message));
                    // Menü hemen kapanır; hata olursa şerit söyler.
                    setSelected(null);
                    void pinAction(id, !pinned);
                  },
                }
              : undefined
          }
        />
      ) : null}

      {forwarding ? (
        <ForwardSheet message={forwarding} onClose={() => setForwarding(null)} />
      ) : null}

      <PinnedListSheet
        visible={pinListOpen}
        pins={pins.data ?? []}
        canUnpin={canPin}
        onClose={() => setPinListOpen(false)}
        onJump={jumpToMessage}
        onUnpin={(messageId) => void pinAction(messageId, false)}
      />
    </View>
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
        <Text style={{ ...typography.caption, ...fw(500), color: colors.muted }}>
          {OFFICIAL_FOOTER_TITLE}
        </Text>
      </View>
    </View>
  );
}

function messageAuthorId(message: ChatMessagePayload) {
  return isChannelMessage(message) ? message.member.profile.id : message.profile.id;
}

/**
 * En eski okunmamış mesaj — liste yeniden eskiye sıralı, kendi mesajımız
 * görülünce ondan eskisi okunmuş sayılır (sunucudaki `unreadCounts` kuralı).
 */
function seedUnreadMarker(
  messages: ChatMessagePayload[],
  myId: string | undefined,
  seed: UnreadSeed
): string | null {
  let oldest: string | null = null;
  if (seed.cursor !== undefined) {
    for (const message of messages) {
      if (authorIdOf(message) === myId) break;
      if (seed.cursor && !isAfterSnowflake(message.id, seed.cursor)) break;
      if (!message.deleted) oldest = message.id;
    }
    return oldest;
  }
  let remaining = seed.count ?? 0;
  for (const message of messages) {
    if (remaining <= 0 || authorIdOf(message) === myId) break;
    if (message.deleted) continue;
    oldest = message.id;
    remaining -= 1;
  }
  return oldest;
}

/** Web'deki "yeni mesajlar" çizgisi — ilk okunmamış mesajın üstünde, marka tonunda. */
function UnreadDivider() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
      accessibilityRole="header"
      accessibilityLabel="Yeni mesajlar"
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.brand, opacity: 0.6 }} />
      <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Yeni mesajlar</Text>
      <View style={{ width: 24, height: 1, backgroundColor: colors.brand, opacity: 0.6 }} />
    </View>
  );
}
