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
import { router, useFocusEffect, useNavigation } from "expo-router";
import type { NativeStackNavigationProp } from "expo-router/build/react-navigation/native-stack";
import { BlurTargetView } from "expo-blur";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { hasServerPermission, useChatMessages, useIgnoredIds, useMentolPlan, useMyMembership, useMyPermissions, type ChatKind } from "@/api/hooks";
import { EmptyState, ErrorState, Icon, ListSkeleton, Pressable, showDialog, showToast } from "@/components/ui";
import { launchActivityById } from "@/features/activities/launch";
import { useChatStream } from "@/realtime/use-chat-stream";
import { useReadState } from "@/realtime/use-read-state";
import { useTyping } from "@/realtime/use-typing";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useActiveChat } from "@/stores/active-chat";
import { useAuth } from "@/stores/auth";
import { useChatOutbox } from "@/stores/outbox";
import { useChatEphemerals } from "@/stores/ephemeral";
import { usePreferences } from "@/stores/preferences";
import {
  captureFromCamera,
  pickDocuments,
  pickManyFromGallery,
  uploadMessageAttachment,
  type PickedAsset,
} from "@/lib/uploads";
import { isOnline } from "@/lib/network";
import { readThread, type Poll, type VoiceMeta } from "@/lib/message-extras";
import { OFFICIAL_FOOTER_TITLE } from "@/lib/official";
import { isAfterSnowflake } from "@/lib/snowflake";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { AttachmentSheet, type AttachmentSource } from "./components/attachment-sheet";
import { DaySeparator } from "./components/day-separator";
import { CommandSuggestions, matchCommands, type CommandMatch } from "./components/command-suggestions";
import { CommandBar, CommandPicker, commandInputProps, useCommandMode } from "./command-mode";
import { Composer, type ComposerHandle, type PendingFile } from "./components/composer";
import {
  ComposerSuggestions,
  encodeComposerTokens,
  findSuggestionTrigger,
  useComposerSuggestions,
  type ComposerSuggestion,
  type SuggestionTrigger,
} from "./components/composer-suggestions";
import { PollComposer } from "./components/poll-composer";
import { ForwardSheet } from "./components/forward-sheet";
import { MessageContextMenu } from "./components/message-context-menu";
import { flashMessage } from "./components/message-flash";
import { MessageItem, type MessageAnchor } from "./components/message-item";
import { OutboxItem } from "./components/outbox-item";
import { PinnedBar, PinnedListSheet } from "./components/pinned-bar";
import { TypingBubble } from "./components/typing-bubble";
import { ChatScopeProvider, type ChatScope } from "./chat-scope";
import { canForwardMessage } from "./forward";
import { dropExpired, nextExpiry } from "./message-expiry";
import { canBePinned, pinnedAtOf, usePinAction, usePins } from "./pins";
import { localize } from "./app-commands";
import {
  contextMenuCommands,
  matchSlashCommand,
  runContextMenuCommand,
  runSlashCommand,
  silentNotice,
  useAppCommands,
  waitForAck,
} from "./interactions";
import { useLocale, useT } from "@/lib/i18n";
import { SILENT_PREFIX } from "./message-markup";
import { useServerEmojis, type ServerStickerLite } from "./server-assets";
import { useComposer, type ComposerAttachment } from "./use-composer";
import { authorIdOf, useChatItems, type ChatItem } from "./use-chat-items";
import { useMessageActions } from "./use-message-actions";
import { SelectableRow, SelectionBar, selectionBlock, useMessageSelection } from "./message-selection";
import { fw } from "@/theme/fonts";

/** Atlanacak mesaj bulunana kadar en çok bu kadar eski sayfa çekilir. */
const MAX_JUMP_PAGES = 15;

/** Ters listede en alttan bu kadar yukarıya kadar "en yenilerde" sayılır. */
const NEAR_BOTTOM_PX = 160;

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
/** Yazılmakta olan mesajlar, sohbet kimliğine göre (bkz. ChatView taslağı). */
const draftMemory = new Map<string, string>();

/** Mesaj başına ek sınırı (web `MAX_ATTACHMENTS`). */
const MAX_ATTACHMENTS = 10;

let pendingCounter = 0;

export function ChatView({
  kind,
  chatId,
  serverId,
  placeholder,
  readOnlyOfficial = false,
  lockedNotice,
  requireAttachment = false,
  oneToOne = false,
  unreadSeed,
  intro,
  canStartThread = false,
}: {
  kind: ChatKind;
  chatId: string;
  /** Kanal mesajı gönderimi sunucu kimliğini de ister. */
  serverId?: string;
  placeholder: string;
  /** Ciklet resmî bildirim sohbeti tek yönlüdür. */
  readOnlyOfficial?: boolean;
  /**
   * Yazma çubuğu yerine gösterilecek not (ör. forum kanalı: gönderi açmak
   * şimdilik web'de). Mesajlar okunur, yazılamaz.
   */
  lockedNotice?: string;
  /**
   * Medya kanalı: yalnızca ekli mesaj gönderilir (sunucu eksiz mesajı
   * reddediyor; burada gönderilmeden önce söylenir).
   */
  requireAttachment?: boolean;
  /**
   * Birebir sohbet (ve Notlarım): karşı tarafın adı ve avatarı her
   * baloncukta tekrarlanmaz — kim olduğu başlıkta zaten yazıyor.
   */
  oneToOne?: boolean;
  /** "Yeni mesajlar" ayracı için okunmamış bilgisi; yoksa ayraç çizilmez. */
  unreadSeed?: UnreadSeed;
  /** Boş sohbetin karşılaması (DM: avatar + ad); yoksa genel boş durum. */
  intro?: React.ReactNode;
  /** Sunucu metin kanalı (alt başlık ya da forum değil): mesajdan alt başlık açılabilir. */
  canStartThread?: boolean;
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

  const { typers, notifyTyping, stopTyping } = useTyping(chatId);
  const { send, sendLocalFile, retry, discard } = useComposer(kind, chatId, serverId);
  const outbox = useChatOutbox(chatId);
  const myId = useAuth((state) => state.profile?.id);
  const actions = useMessageActions(kind, chatId, serverId);
  const insets = useSafeAreaInsets();
  const scope = useMemo<ChatScope>(() => ({ kind, chatId, serverId }), [kind, chatId, serverId]);
  // Uygulama komutları: sunucu kanalında ve botla birebir DM'de (insanla
  // DM'de sunucu boş liste döndürür). "/" listesi, komut kipi ve mesaj
  // eylemlerindeki "Uygulamalar" bölümü buradan beslenir.
  const commandBots = useAppCommands(readOnlyOfficial ? undefined : chatId);
  const locale = useLocale();
  const t = useT();
  const commandMode = useCommandMode({ chatId });

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

  // Mesajları Yönet (web kuralı: yönetici/moderatör ya da rol/kanal izni;
  // sunucu yine denetler): başkasının mesajını silme ve toplu silme.
  const permissions = useMyPermissions(kind === "channel" && !readOnlyOfficial ? serverId : undefined);
  const canManageMessages =
    kind === "channel" &&
    !readOnlyOfficial &&
    Boolean(serverId) &&
    (membership.data?.role === MemberRole.ADMIN ||
      membership.data?.role === MemberRole.MODERATOR ||
      hasServerPermission(permissions.data, "MANAGE_MESSAGES"));
  const selection = useMessageSelection(chatId, serverId);

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır; kopuklukta telafi edilir.
  useChatStream(kind, chatId);

  // Açık sohbet: bildirim katmanı bu sohbetin mesajı için kart/ses üretmez.
  // Odak bazlı — üstüne profil/ayar itilince sohbet "açık" sayılmaz (web:
  // sayfa görünür ve odaktayken).
  useFocusEffect(
    useCallback(() => {
      useActiveChat.getState().setActive(chatId);
      return () => {
        if (useActiveChat.getState().chatId === chatId) useActiveChat.getState().setActive(null);
      };
    }, [chatId])
  );

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

  // Taslak sohbet başına bellekte de tutulur: tema değişimi (telefonun açık/
  // koyu moduna geçmesi dahil) gezinme ağacını yeniden kurar ve yarım
  // kalmış mesaj silinirdi.
  const [draft, setDraftState] = useState(() => draftMemory.get(chatId) ?? "");
  const setDraft = useCallback(
    (text: string) => {
      if (text) draftMemory.set(chatId, text);
      else draftMemory.delete(chatId);
      setDraftState(text);
    },
    [chatId]
  );
  const [attachments, setAttachments] = useState<PendingFile[]>([]);
  const [attachmentSheet, setAttachmentSheet] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  /** Yükleme sürerken yazma çubuğundaki ilerleme metni. */
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  /**
   * İmleç ref'te: her imleç hareketi sohbeti yeniden çizmesin. Yalnızca
   * `@`/`:` öneri tetikleyicisi DEĞİŞİNCE state güncellenir.
   */
  const caretRef = useRef(0);
  const [suggestionTrigger, setSuggestionTrigger] = useState<SuggestionTrigger | null>(null);
  /** Yükleme ya da eğik çizgi komutu sürerken ikinci gönderim/ek seçimi engellenir. */
  const uploadingRef = useRef(false);
  const commandRunningRef = useRef(false);
  /** Öneriden seçilen roller: yazı kutusunda `@Ad`, gönderimde `<@&id>`. */
  const pickedRoles = useRef(new Map<string, string>());
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
  /**
   * Liste en yeni mesajlarda mı. "Yazıyor" balonu yalnızca o zaman çizilir
   * (web'le aynı): yukarıdayken eklenip çıkması okunan yeri kaydırırdı.
   */
  const nearBottomRef = useRef(true);
  const [nearBottom, setNearBottom] = useState(true);
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
   * Ekran geçişi bitti mi. Yerel yığın `transitionEnd`'i itme animasyonu
   * bitince yayar; olay kaçarsa (animasyonsuz açılış) yedek süre devreye
   * girer — iOS itmesinden uzun, hata geri gelmez.
   */
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) setEntered(true);
    });
    const fallback = setTimeout(() => setEntered(true), 700);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);

  /**
   * Sohbete girer girmez klavye açılır — mesaj yazmak birincil eylem.
   * Odak geçiş BİTTİKTEN sonra verilir: itme sırasında odaklanınca iOS
   * klavyeyi ekranla birlikte sağdan kaydırıyordu (aşağıdan gelmeliydi).
   */
  useEffect(() => {
    // Yükleme bitince composer bağlanır ve efekt yeniden çalışır.
    if (!entered || isLoading || readOnlyOfficial) return;
    const frame = requestAnimationFrame(() => {
      // Kullanıcı bu arada paneli açtıysa, kutu zaten odaktaysa ya da üstüne
      // başka ekran itildiyse (yükleme geç bitti) dokunma.
      if (!navigation.isFocused()) return;
      if (composerControl.current?.isPanelOpen() || composerRef.current?.isFocused()) return;
      composerRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [chatId, entered, isLoading, navigation, readOnlyOfficial]);

  /**
   * Kullanıcı ESKİ mesajlara doğru kaydırdığında klavye VE emoji/GIF/aktivite
   * paneli kapanır, yazma çubuğu aşağı iner — okurken ekranın yarısı
   * klavyeyle ya da panelle kaplı olmamalı. Liste ters (`inverted`) olduğu
   * için ARTAN offset geçmişe gitmek demek.
   *
   * Yalnızca KULLANICININ kaydırması sayılır (parmakla sürükleme ve onun
   * savurma devamı). Mesaj gönderince/gelince liste kendiliğinden kayıyor;
   * eskiden bu da "geçmişe gitti" sanılıp klavye her gönderimde kapanıyordu
   * (Android'de kapanan klavyenin yeri bir an boş da kalıyordu).
   */
  const userScrolling = useRef(false);
  const dragEndedAt = useRef(0);
  const onScrollBeginDrag = useCallback(() => {
    userScrolling.current = true;
  }, []);
  const onScrollEndDrag = useCallback(() => {
    userScrolling.current = false;
    dragEndedAt.current = Date.now();
  }, []);
  const onMomentumScrollBegin = useCallback(() => {
    // Savurma sürüklemenin devamıysa kullanıcınındır; programatik kaydırma değil.
    if (Date.now() - dragEndedAt.current < 150) userScrolling.current = true;
  }, []);
  const onMomentumScrollEnd = useCallback(() => {
    userScrolling.current = false;
  }, []);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const goingBack = userScrolling.current && y > lastOffset.current + 12;
      lastOffset.current = y;
      // Yalnızca eşik geçilince çizim — kaydırma ekranı yeniden çizdirmesin.
      const near = y < NEAR_BOTTOM_PX;
      if (near !== nearBottomRef.current) {
        nearBottomRef.current = near;
        setNearBottom(near);
      }
      if (goingBack) {
        Keyboard.dismiss();
        composerControl.current?.closePanel();
      }
    },
    []
  );

  const allMessages = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );
  // Süreli DM: ekranda duran mesaj silinme anı gelince listeden düşer.
  const expiryClock = useExpiryClock(allMessages);
  const messages = useMemo(() => dropExpired(allMessages, expiryClock), [allMessages, expiryClock]);

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

  // Geçici bot yanıtları (flags 64) sunucu geçmişinde yok: en yeni uca eklenir
  // (web chat-message-list gibi). Okundu ve "yeni mesajlar" ayracı yalnızca
  // gerçek mesajlara bakar.
  const ephemerals = useChatEphemerals(chatId);
  const listed = useMemo(
    () => (ephemerals.length > 0 ? [...[...ephemerals].reverse(), ...messages] : messages),
    [ephemerals, messages]
  );
  const items = useChatItems(listed, !hasNextPage && !isLoading, unreadMarker ?? null);

  // Yoksaydığın kişinin mesaj grupları daraltılır (Discord "Ignore"; web
  // chat-message-group ile aynı): grubun ilk mesajının yerinde "Yoksaydığın
  // bir kullanıcıdan gelen mesaj — Göster", diğerleri çizilmez. Açılan grup
  // bu ekranda açık kalır. Kendi mesajın daraltılmaz.
  const ignoredIds = useIgnoredIds();
  const [revealedGroups, setRevealedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const ignoredGroups = useMemo(() => {
    const byMessage = new Map<string, { start: string; isStart: boolean }>();
    const counts = new Map<string, number>();
    if (ignoredIds.size === 0) return { byMessage, counts };
    // Dizi en yeniden en eskiye; grup başı (en eski) `grouped=false`.
    let start: string | null = null;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.kind !== "message") continue;
      const author = authorIdOf(item.message);
      if (!item.grouped) start = item.message.id;
      if (author === myId || !ignoredIds.has(author) || !start) continue;
      byMessage.set(item.message.id, { start, isStart: !item.grouped });
      counts.set(start, (counts.get(start) ?? 0) + 1);
    }
    return { byMessage, counts };
  }, [items, ignoredIds, myId]);
  const toggleIgnoredGroup = useCallback((start: string) => {
    setRevealedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(start)) next.delete(start);
      else next.add(start);
      return next;
    });
  }, []);

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

  /** Tetikleyici yalnızca değiştiyse state'e yazılır (aynı sorguda yeniden çizim yok). */
  const syncTrigger = useCallback((text: string, caret: number) => {
    const next = findSuggestionTrigger(text, caret);
    setSuggestionTrigger((current) =>
      current === next ||
      (current &&
        next &&
        current.char === next.char &&
        current.query === next.query &&
        current.start === next.start &&
        current.end === next.end)
        ? current
        : next
    );
  }, []);

  const onCaretChange = useCallback(
    (caret: number) => {
      caretRef.current = caret;
      syncTrigger(draft, caret);
    },
    [draft, syncTrigger]
  );

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      // İmleç olayı metinden önce ya da sonra gelebilir; ikisi de eşitler.
      syncTrigger(text, Math.min(caretRef.current, text.length));
      if (text.length > 0) notifyTyping();
      else stopTyping();
    },
    [notifyTyping, setDraft, stopTyping, syncTrigger]
  );

  const serverEmojis = useServerEmojis(serverId);

  /**
   * Eğik çizgi komutu: metin kurulu bir botun komutuna uyuyorsa düz mesaj
   * yerine etkileşim açılır (web chat-input-area). Uymuyorsa metin eskisi
   * gibi gider. Bot 3 sn içinde yanıtlamazsa kullanıcıya söylenir.
   */
  const runCommand = useCallback(
    async (text: string): Promise<false | "sent" | "failed"> => {
      if (!text.startsWith("/")) return false;
      const match = matchSlashCommand(text, commandBots.data ?? []);
      if (!match) return false;
      stopTyping();
      setDraft("");
      // Yazılmış metin yedeği: argümanlar sunucuda komutun şemasına oturtulur.
      const result = await runSlashCommand(chatId, match.entry, { args: match.args });
      if (!result.ok) {
        setDraft(text);
        showToast(result.error, "error");
        return "failed";
      }
      void waitForAck(chatId, result.id).then((silent) => {
        if (silent) showToast(silentNotice(match.entry.bot.name));
      });
      return "sent";
    },
    [chatId, commandBots.data, setDraft, stopTyping]
  );

  const onSend = useCallback(
    (options?: { silent?: boolean }) => {
      if (uploadingRef.current || commandRunningRef.current) return;
      // Komut kipi: seçenekler doğrulanır ve çalıştırılır (hata kutunun altında).
      if (commandMode.active) {
        void commandMode.submit();
        return;
      }
      if (!draft.trim() && attachments.length === 0) return;
      if (requireAttachment && attachments.length === 0) {
        showToast("Bu medya kanalına yalnızca görsel, video ya da dosya ekli mesaj gönderilebilir.", "error");
        return;
      }
      if (attachments.length === 0 && draft.trim().startsWith("/") && (commandBots.data?.length ?? 0) > 0) {
        const text = draft.trim();
        commandRunningRef.current = true;
        void runCommand(text)
          .then((handled) => {
            if (!handled) {
              stopTyping();
              send(encodeComposerTokens(draft, pickedRoles.current, serverEmojis), undefined, replyingTo?.id);
              setDraft("");
              setReplyingTo(null);
            } else if (handled === "sent") {
              // Komut yanıt taşımaz; alıntı çubuğu asılı kalmasın.
              setReplyingTo(null);
            }
          })
          .finally(() => {
            commandRunningRef.current = false;
          });
        return;
      }
      stopTyping();
      let text = encodeComposerTokens(draft, pickedRoles.current, serverEmojis);
      if (options?.silent && text.trim()) text = `${SILENT_PREFIX} ${text.trimStart()}`;
      const files: ComposerAttachment[] = attachments.map(({ file, spoiler }) => ({
        url: file.url,
        // `SPOILER_` önekli ekler herkes için örtülü (web lib/sensitive-media).
        name: spoiler && !/^SPOILER_/i.test(file.name) ? `SPOILER_${file.name}` : file.name,
        mimeType: file.mimeType,
        size: file.size,
      }));
      // Sessiz gönderim metin ön ekiyle çalışır (sunucu soyar); yalnızca ekli
      // mesajda yazılacak metin yok, o yüzden normal gider.
      send(text, files, replyingTo?.id);
      setDraft("");
      setAttachments([]);
      setReplyingTo(null);
      pickedRoles.current.clear();
    },
    [attachments, commandBots.data, commandMode, draft, replyingTo?.id, requireAttachment, runCommand, send, serverEmojis, setDraft, stopTyping]
  );

  const onSelectSticker = useCallback(
    (sticker: ServerStickerLite) => {
      stopTyping();
      // Sunucu kimliği doğrular ve metadata'yı kanonik değerle ezer.
      send(sticker.name, undefined, replyingTo?.id, {
        metadata: { sticker: { id: sticker.id } },
        label: `🖼️ ${sticker.name}`,
      });
      setReplyingTo(null);
    },
    [replyingTo?.id, send, stopTyping]
  );

  const onCreatePoll = useCallback(
    (poll: Poll) => {
      send(poll.question, undefined, undefined, {
        messageType: "POLL",
        metadata: { poll },
        label: `📊 ${poll.question}`,
      });
    },
    [send]
  );

  /**
   * Sesli mesaj kaydı bitti: kuyruğa girer (saat simgesi), motor yükleyip
   * `metadata.voice` ile gönderir. Çevrimdışıyken de kaybolmaz; bağlantı
   * gelince gider. Kayıt cihazda kalır, kendi sesli mesajın ağsız çalar.
   */
  const onVoiceRecorded = useCallback(
    async (asset: PickedAsset, meta: VoiceMeta) => {
      // Kayıt bittiği andaki yanıt hedefi gider.
      const replyId = replyingTo?.id;
      setUploadError(null);
      try {
        await sendLocalFile(asset, replyId, { metadata: { voice: meta }, label: "🎤 Sesli mesaj" });
        setReplyingTo(null);
      } catch (reason) {
        setUploadError(reason instanceof Error ? reason.message : "Sesli mesaj kaydedilemedi.");
      }
    },
    [replyingTo?.id, sendLocalFile]
  );

  const onSelectGif = useCallback((url: string) => {
    stopTyping();
    send("", { url, name: "GIF", mimeType: "image/gif" });
  }, [send, stopTyping]);

  // Sohbete davet kartı yazar, aktiviteyi kalıcı katmanda açar (features/activities/launch).
  const onSelectActivity = useCallback((activityId: string) => {
    void launchActivityById(activityId, { chatId, serverId });
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
    if (source === "poll") {
      setPollOpen(true);
      return;
    }
    if (uploadingRef.current) return;
    setUploadError(null);
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setUploadError(`Bir mesajda en fazla ${MAX_ATTACHMENTS} dosya olabilir.`);
      return;
    }
    try {
      const picked =
        source === "gallery"
          ? await pickManyFromGallery(remaining)
          : source === "camera"
            ? [await captureFromCamera()].filter((item): item is PickedAsset => Boolean(item))
            : await pickDocuments(remaining);
      if (picked.length === 0) return;
      uploadingRef.current = true;
      // Çevrimdışı: dosyalar ayrı mesajlar olarak kuyruğa girer (saat
      // simgesi) ve bağlantı gelince yüklenip gönderilir (WhatsApp).
      const queueOffline = async (rest: PickedAsset[]) => {
        for (const asset of rest) await sendLocalFile(asset, replyingTo?.id);
        setReplyingTo(null);
        showToast("Çevrimdışısın — dosyalar bağlantı gelince gönderilecek");
      };
      // Sırayla yüklenir: her biri bitince çubuğa çip olarak takılır, biri
      // başarısız olursa öncekiler kaybolmaz.
      for (let index = 0; index < picked.length; index += 1) {
        if (!isOnline()) {
          await queueOffline(picked.slice(index));
          return;
        }
        const prefix = picked.length > 1 ? `Dosya yükleniyor (${index + 1}/${picked.length})` : "Dosya yükleniyor";
        setUploadProgress(`${prefix}… %0`);
        let file: Awaited<ReturnType<typeof uploadMessageAttachment>>;
        try {
          file = await uploadMessageAttachment(picked[index], (progress) =>
            setUploadProgress(`${prefix}… %${Math.round(progress)}`)
          );
        } catch (reason) {
          if (isOnline()) throw reason;
          await queueOffline(picked.slice(index));
          return;
        }
        pendingCounter += 1;
        const key = `pending-${pendingCounter}`;
        setAttachments((current) =>
          current.length >= MAX_ATTACHMENTS ? current : [...current, { key, file, spoiler: false }]
        );
      }
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : "Dosya yüklenemedi."
      );
    } finally {
      uploadingRef.current = false;
      setUploadProgress(null);
    }
  }, [attachments.length, replyingTo?.id, sendLocalFile]);

  const onLongPressMessage = useCallback((message: ChatMessagePayload, anchor: MessageAnchor) => {
    setSelected({ message, anchor });
  }, []);

  /** Satır sola çekildi: alıntı takılır ve klavye gelir. */
  const onSwipeReply = useCallback((message: ChatMessagePayload) => {
    setReplyingTo(message);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  /** Komut seçildi: yazı kutusu komut kipine girer (bkz. command-mode.tsx). */
  const onPickCommand = (match: CommandMatch) => {
    stopTyping();
    setDraft("");
    commandMode.enter(match);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  // Komut kipinde odak değişince (çipe dokunma, seçimden sonra) yazı kutusu odakta kalır.
  const commandFocus = commandMode.active ? commandMode.state?.focus ?? -1 : null;
  useEffect(() => {
    if (commandFocus === null) return;
    const frame = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [commandFocus]);

  const commandMatches = commandMode.active ? [] : matchCommands(commandBots.data ?? [], draft, locale);
  const commandInput = commandInputProps(commandMode, t);

  // `@` / `:` önerileri — yalnızca sunucu kanalında (üyeler, roller, sunucu
  // emojileri orada). Komut listesi ya da komut kipi açıksa o öncelikli.
  const trigger = kind === "channel" && commandMatches.length === 0 && !commandMode.active ? suggestionTrigger : null;
  const suggestions = useComposerSuggestions(trigger, serverId);

  const onPickSuggestion = (item: ComposerSuggestion) => {
    if (!trigger) return;
    const insert = `${item.insert} `;
    const next = draft.slice(0, trigger.start) + insert + draft.slice(trigger.end);
    if (item.roleId) pickedRoles.current.set(item.insert.slice(1), item.roleId);
    const position = trigger.start + insert.length;
    setDraft(next);
    caretRef.current = position;
    syncTrigger(next, position);
    requestAnimationFrame(() => composerRef.current?.setSelection(position, position));
  };

  // Mesaj eylemlerindeki "Uygulamalar" (MESSAGE komutları); yoksa bölüm yok.
  const messageApps = useMemo(() => contextMenuCommands(commandBots.data ?? [], 3), [commandBots.data]);

  const selectedIds = selection.ids;
  const toggleSelected = selection.toggle;
  const renderMessageRow = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === "day" ? (
        <DaySeparator iso={item.iso} />
      ) : item.kind === "unread" ? (
        <UnreadDivider />
      ) : selectedIds ? (
        <SelectableRow checked={selectedIds.has(item.message.id)} onPress={() => toggleSelected(item.message)}>
          <MessageItem
            oneToOne={oneToOne}
            message={item.message}
            grouped={item.grouped}
            lastInGroup={item.lastInGroup}
          />
        </SelectableRow>
      ) : (
        <MessageItem
          oneToOne={oneToOne}
          message={item.message}
          grouped={item.grouped}
          lastInGroup={item.lastInGroup}
          onLongPress={readOnlyOfficial ? undefined : onLongPressMessage}
          onReply={readOnlyOfficial || item.message.deleted ? undefined : onSwipeReply}
          onReactionPress={(message, emoji) => {
            void actions.toggleReaction(message.id, emoji);
          }}
          onJumpToMessage={jumpToMessage}
        />
      ),
    [actions, readOnlyOfficial, oneToOne, onLongPressMessage, onSwipeReply, jumpToMessage, selectedIds, toggleSelected]
  );
  const renderItem = useCallback(
    (info: { item: ChatItem }) => {
      const gate = info.item.kind === "message" ? ignoredGroups.byMessage.get(info.item.message.id) : undefined;
      if (!gate) return renderMessageRow(info);
      const revealed = revealedGroups.has(gate.start);
      if (!gate.isStart) return revealed ? renderMessageRow(info) : null;
      const bar = (
        <IgnoredMessagesBar
          count={ignoredGroups.counts.get(gate.start) ?? 1}
          revealed={revealed}
          onToggle={() => toggleIgnoredGroup(gate.start)}
        />
      );
      return revealed ? (
        <View>
          {bar}
          {renderMessageRow(info)}
        </View>
      ) : (
        bar
      );
    },
    [ignoredGroups, revealedGroups, renderMessageRow, toggleIgnoredGroup]
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

  return (
    // Klavye ve emoji paneli boşluğunu yazma çubuğu kendisi ayırıyor
    // (bkz. components/composer.tsx); burada `KeyboardAvoider` YOK.
    <ChatScopeProvider value={scope}>
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
            extraData={selectedIds}
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
            // "handled": balondaki düğmeye (sesli mesaj oynat, tepki, bağlantı)
            // dokunmak klavyeyi KAPATMAZ, dokunuş düğmeye gider; boş alana
            // dokunmak eskisi gibi kapatır. Varsayılan ("never") her dokunuşta
            // klavyeyi kapatıyor ve ilk dokunuşu yutuyordu.
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onMomentumScrollBegin={onMomentumScrollBegin}
            onMomentumScrollEnd={onMomentumScrollEnd}
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
             * mesajların ve "yazıyor" balonunun doğru yeri burası (en yeni
             * içerik altta). Kap hep bağlı kalır ki balonun çıkış animasyonu
             * oynayabilsin.
             */
            ListHeaderComponent={
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
                {/* Başlık hücresi ters listede yeniden düz çevriliyor; son
                    çocuk görsel olarak en altta — bekleyen mesajların altında. */}
                {nearBottom && typers.length > 0 && !readOnlyOfficial ? (
                  <TypingBubble typers={typers} group={!oneToOne} />
                ) : null}
              </View>
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
              intro ? (
                <View style={{ flex: 1, justifyContent: "center" }}>{intro}</View>
              ) : (
                <View style={{ flex: 1 }}>
                  <EmptyState
                    icon="message"
                    title="Sohbet burada başlıyor"
                    description="İlk mesajı sen gönder."
                  />
                </View>
              )
            }
          />

          {/* "/" komut önerileri mesajların üstünde, yazma çubuğunun hemen
              üzerinde yüzer; listenin kabı içinde kaldığı için dokunuşlar
              kesin olarak ona gelir. */}
          {commandMode.active ? (
            <CommandPicker mode={commandMode} chatId={chatId} kind={kind} serverId={serverId} />
          ) : commandMatches.length > 0 ? (
            <CommandSuggestions matches={commandMatches} onPick={onPickCommand} />
          ) : suggestions.length > 0 ? (
            <ComposerSuggestions items={suggestions} onPick={onPickSuggestion} />
          ) : null}
        </View>

        {selection.active ? (
          <SelectionBar
            count={selection.ids?.size ?? 0}
            onCancel={selection.exit}
            onDelete={selection.openConfirm}
          />
        ) : readOnlyOfficial || lockedNotice ? (
          <>
            <OfficialFooter text={lockedNotice} />
            <View style={{ height: insets.bottom }} />
          </>
        ) : (
          <Composer
            inputRef={composerRef}
            controlRef={composerControl}
            commandsAvailable={(commandBots.data ?? []).some((bot) => bot.commands.some((c) => c.type === 1))}
            value={commandMode.active ? commandMode.inputValue : draft}
            onChangeText={commandMode.active ? commandMode.onChangeText : onChangeDraft}
            onSend={onSend}
            commandMode={commandMode.active}
            commandBar={commandMode.active ? <CommandBar mode={commandMode} /> : null}
            commandError={commandMode.state?.error ?? null}
            keyboardType={commandInput.keyboardType}
            maxLength={commandInput.maxLength}
            onBackspaceEmpty={commandMode.active ? commandMode.onBackspaceEmpty : undefined}
            attachments={attachments}
            replyingTo={replyingTo}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onPickAttachment={onPickAttachment}
            onRemoveAttachment={(key) => setAttachments((current) => current.filter((item) => item.key !== key))}
            onToggleSpoiler={(key) =>
              setAttachments((current) =>
                current.map((item) => (item.key === key ? { ...item, spoiler: !item.spoiler } : item))
              )
            }
            onSelectSticker={kind === "channel" && serverId ? onSelectSticker : undefined}
            onVoiceRecorded={(asset, meta) => void onVoiceRecorded(asset, meta)}
            onCaretChange={onCaretChange}
            onCancelReply={() => setReplyingTo(null)}
            onSelectGif={onSelectGif}
            onSelectActivity={onSelectActivity}
            placeholder={commandMode.active ? (commandInput.placeholder ?? placeholder) : placeholder}
          />
        )}
      </BlurTargetView>

      <PollComposer visible={pollOpen} onClose={() => setPollOpen(false)} onCreate={onCreatePoll} />

      <AttachmentSheet
        visible={attachmentSheet}
        onClose={() => setAttachmentSheet(false)}
        onPick={(source) => void onAttachmentSource(source)}
        allowPoll
      />

      {selected ? (
        <MessageContextMenu
          key={selected.message.id}
          message={selected.message}
          anchor={selected.anchor}
          isMine={messageAuthorId(selected.message) === myId}
          canDeleteOthers={canManageMessages}
          onSelectMessages={
            canManageMessages && selectionBlock(selected.message) !== "never"
              ? () => {
                  selection.start(selected.message);
                  setSelected(null);
                }
              : undefined
          }
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
          serverId={serverId}
          apps={messageApps.map((app) => ({
            key: `${app.bot.id}:${app.command.id}`,
            label: localize(app.command.name, app.command.name_localizations, locale),
            botName: app.bot.name,
            imageUrl: app.bot.imageUrl,
            onPress: () => {
              const target = selected.message.id;
              setSelected(null);
              void runContextMenuCommand(chatId, app, target).then((result) => {
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                void waitForAck(chatId, result.id).then((silent) => {
                  if (silent) showToast(silentNotice(app.bot.name));
                });
              });
            },
          }))}
          thread={
            canStartThread && serverId && canStartThreadFrom(selected.message)
              ? {
                  defaultName: threadNameFromMessage(selected.message.content),
                  onCreate: async (name, autoArchiveMinutes) => {
                    const id = await actions.createThread(selected.message.id, name, autoArchiveMinutes);
                    if (!id) return;
                    setSelected(null);
                    router.push({
                      pathname: "/chat/channel/[channelId]",
                      params: {
                        channelId: id,
                        serverId,
                        parentId: chatId,
                        threadName: name || threadNameFromMessage(selected.message.content),
                      },
                    });
                  },
                }
              : undefined
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

      {selection.sheet}

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
    </ChatScopeProvider>
  );
}

/** Webde input'un yerine geçen tek yönlü resmî bildirim bandı. */
function OfficialFooter({ text }: { text?: string }) {
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
          {text ?? OFFICIAL_FOOTER_TITLE}
        </Text>
      </View>
    </View>
  );
}

/** Alt başlık açılabilir mesaj: silinmemiş, sistem satırı değil, zaten alt başlığı yok (web `canStartThread`). */
function canStartThreadFrom(message: ChatMessagePayload): boolean {
  const type = message.type as string;
  return !message.deleted && !readThread(message.metadata) && (type === "DEFAULT" || type === "POLL");
}

/** Başlangıç mesajından varsayılan ad: ilk satır, 40 karakter (web `threadNameFromMessage`). */
function threadNameFromMessage(content: string | null | undefined): string {
  const first = String(content ?? "").split("\n")[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!first) return "alt başlık";
  return first.length > 40 ? `${first.slice(0, 39)}…` : first;
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

/** Modül düzeyinde: render içinde doğrudan `Date.now` React Compiler'a takılıyor. */
function nowMs(): number {
  return Date.now();
}

/** `setTimeout` üst sınırı (~24,8 gün); aşılırsa hemen tetiklenir. */
const MAX_TIMEOUT_MS = 2_147_000_000;

/**
 * Süreli mesajlar için saat: listedeki en yakın silinme anında bir kez
 * ilerler; süreli mesaj yoksa zamanlayıcı kurulmaz.
 */
function useExpiryClock(messages: readonly ChatMessagePayload[]): number {
  const [now, setNow] = useState(nowMs);
  const next = useMemo(() => nextExpiry(messages, now), [messages, now]);
  useEffect(() => {
    if (next === null) return;
    const timer = setTimeout(() => setNow(nowMs()), Math.min(Math.max(0, next - nowMs() + 50), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [next]);
  return now;
}

/** Yoksayılan kişinin daraltılmış mesaj grubu (web chat-message-group ile aynı metin). */
function IgnoredMessagesBar({ count, revealed, onToggle }: { count: number; revealed: boolean; onToggle: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
      <Icon name="bell-off" size={13} color={colors.muted} />
      <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
        {count > 1 ? `Yoksaydığın bir kullanıcıdan gelen ${count} mesaj` : "Yoksaydığın bir kullanıcıdan gelen mesaj"} —{" "}
      </Text>
      <Pressable onPress={onToggle} accessibilityRole="button" hitSlop={8}>
        <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>{revealed ? "Gizle" : "Göster"}</Text>
      </Pressable>
    </View>
  );
}
