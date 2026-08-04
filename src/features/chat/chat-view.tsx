import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useChatMessages, useSendMessage, type ChatKind } from "@/api/hooks";
import { Icon } from "@/components/ui/icon";
import { EmptyState, ErrorState } from "@/components/ui/screen";
import { ApiError } from "@/api/client";
import { useChatStream } from "@/realtime/use-chat-stream";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { MessageItem } from "./components/message-item";

/**
 * Kanal ve DM sohbetlerinin ortak gövdesi.
 *
 * İkisi arasındaki tek fark uç noktalar; hem geçmiş sayfalaması hem canlı
 * akış aynı `chatId` üzerinden çalışır. Bu yüzden ayrı iki ekran yazmak
 * yerine tek görünüm iki rota tarafından kullanılır.
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

  // Canlı akış: gelen mesajlar doğrudan cache'e yazılır.
  useChatStream(chatId);

  const [draft, setDraft] = useState("");
  const messages = data?.pages.flatMap((page) => page.items) ?? [];

  const onSend = useCallback(() => {
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft("");
    sendMessage.mutate(
      { content },
      {
        onError: () => setDraft(content), // Taslağı kaybetme.
      }
    );
  }, [draft, sendMessage]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={
          error instanceof ApiError ? error.message : "Mesajlar yüklenemedi."
        }
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageItem message={item} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        contentContainerStyle={
          messages.length === 0 ? { flex: 1 } : { paddingVertical: spacing.md }
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
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator
              color={colors.muted}
              style={{ marginVertical: spacing.lg }}
            />
          ) : null
        }
      />

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
        <TextInput
          value={draft}
          onChangeText={setDraft}
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
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || sendMessage.isPending}
          accessibilityRole="button"
          accessibilityLabel="Gönder"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radii.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: draft.trim() ? colors.brand : colors.panel,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Icon
            name="send"
            size={18}
            color={draft.trim() ? colors.onBrand : colors.muted}
          />
        </Pressable>
      </View>

      {sendMessage.isError ? (
        <Text
          style={{
            ...typography.caption,
            color: colors.danger,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: colors.deep,
          }}
        >
          Mesaj gönderilemedi. Tekrar dene.
        </Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}
