import { useCallback, useState } from "react";
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
import { useChatMessages, useSendMessage, type ChatKind } from "@/api/hooks";
import {
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListSkeleton,
  Pressable,
} from "@/components/ui";
import { useChatStream } from "@/realtime/use-chat-stream";
import { typingLabel, useTyping } from "@/realtime/use-typing";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { DaySeparator } from "./components/day-separator";
import { MessageItem } from "./components/message-item";
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

  const sendMessage = useSendMessage(kind, chatId, serverId);
  const { typers, notifyTyping } = useTyping(chatId, kind);

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır.
  useChatStream(chatId);

  const [draft, setDraft] = useState("");

  const messages = data?.pages.flatMap((page) => page.items) ?? [];
  const items = useChatItems(messages, !hasNextPage && !isLoading);

  const onChangeDraft = useCallback(
    (text: string) => {
      setDraft(text);
      if (text.length > 0) notifyTyping();
    },
    [notifyTyping]
  );

  const onSend = useCallback(() => {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft("");
    sendMessage.mutate(
      { content },
      { onError: () => setDraft(content) } // Taslağı kaybetme.
    );
  }, [draft, sendMessage]);

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
        // Ters listede "footer" görsel olarak ÜSTTE durur — geçmiş
        // yüklenirken göstergenin doğru yeri burası.
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.muted}
              style={{ marginVertical: spacing.lg }}
            />
          ) : null
        }
        contentContainerStyle={
          items.length === 0 ? { flex: 1 } : { paddingVertical: spacing.sm }
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

      {sendMessage.isError ? (
        <Pressable
          onPress={() => sendMessage.reset()}
          noHitSlop
          accessibilityRole="button"
          accessibilityLabel="Hata mesajını kapat"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            backgroundColor: colors.danger,
          }}
        >
          <Icon name="close" size={14} color={colors.bright} />
          <Text style={{ ...typography.caption, color: colors.bright, flex: 1 }}>
            {sendMessage.error instanceof ApiError
              ? sendMessage.error.message
              : "Mesaj gönderilemedi."}
          </Text>
        </Pressable>
      ) : null}

      <Composer
        value={draft}
        onChangeText={onChangeDraft}
        onSend={onSend}
        placeholder={placeholder}
        sending={sendMessage.isPending}
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
  sending,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  sending: boolean;
}) {
  const canSend = value.trim().length > 0 && !sending;

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
      {/* Dosya eki Faz 3'te (UploadThing) bağlanacak. */}
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
