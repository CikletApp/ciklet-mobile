import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "@/api/client";
import { useChatMessages, type ChatKind } from "@/api/hooks";
import {
  EmptyState,
  ErrorState,
  IconButton,
  ListSkeleton,
} from "@/components/ui";
import { useChatStream } from "@/realtime/use-chat-stream";
import { useReadState } from "@/realtime/use-read-state";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { useChatOutbox } from "@/stores/outbox";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { DaySeparator } from "./components/day-separator";
import { MessageItem } from "./components/message-item";
import { OutboxItem } from "./components/outbox-item";
import { useComposer } from "./use-composer";
import { useChatItems, type ChatItem } from "./use-chat-items";

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
}: {
  kind: ChatKind;
  chatId: string;
  /** Kanal mesajı gönderimi sunucu kimliğini de ister. */
  serverId?: string;
  placeholder: string;
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

  const { typers, notifyTyping } = useTyping(chatId, kind);
  const { send, retry, discard } = useComposer(kind, chatId, serverId);
  const outbox = useChatOutbox(chatId);

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır.
  useChatStream(chatId);

  const [draft, setDraft] = useState("");

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
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  }, [draft, send]);

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === "day" ? (
        <DaySeparator iso={item.iso} />
      ) : (
        <MessageItem message={item.message} grouped={item.grouped} />
      ),
    []
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
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

  const typing = typingLabel(typers);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <FlatList
        inverted
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardDismissMode="interactive"
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
          // `inverted` tüm içeriği dikeyde çevirir; boş durumu ters
          // görünmesin diye bir kez daha çeviriyoruz.
          <View style={{ flex: 1, transform: [{ scaleY: -1 }] }}>
            <EmptyState
              icon="message"
              title="Sohbet burada başlıyor"
              description="İlk mesajı sen gönder."
            />
          </View>
        }
      />

      {typing ? (
        <Text
          style={{
            ...typography.caption,
            color: colors.muted,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xs,
            backgroundColor: colors.bg,
          }}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
        >
          {typing}
        </Text>
      ) : null}

      <Composer
        value={draft}
        onChangeText={onChangeDraft}
        onSend={onSend}
        placeholder={placeholder}
      />
    </KeyboardAvoidingView>
  );
}

/** Mesaj yazma çubuğu. */
function Composer({
  value,
  onChangeText,
  onSend,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
}) {
  const canSend = value.trim().length > 0;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.deep,
      }}
    >
      {/* Dosya eki UploadThing entegrasyonuyla birlikte gelecek. */}
      <IconButton
        icon="plus"
        label="Dosya ekle"
        background="transparent"
        tint={colors.muted}
        disabled
      />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        style={{
          flex: 1,
          maxHeight: 120,
          minHeight: 40,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radii.xl,
          backgroundColor: colors.panel,
          color: colors.bright,
          ...typography.body,
        }}
        accessibilityLabel="Mesaj yaz"
      />

      <IconButton
        icon="send"
        label="Gönder"
        onPress={onSend}
        disabled={!canSend}
        background={canSend ? colors.brand : colors.panel}
        tint={canSend ? colors.onBrand : colors.muted}
        size={40}
        haptic="light"
      />
    </View>
  );
}
