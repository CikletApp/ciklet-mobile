import { useMemo, useState } from "react";
import { SectionList, RefreshControl, Text, View } from "react-native";
import { router, Stack } from "expo-router";

import { useBookmarks, useToggleBookmark, type BookmarkTarget } from "@/api/hooks";
import type { BookmarkEntry } from "@/api/types";
import { EmptyState, Icon, IconButton, ListSkeleton, Screen, showToast } from "@/components/ui";
import { MessagePreviewRow } from "@/features/social/message-preview-row";
import { ReminderSheet } from "@/features/social/reminder-sheet";
import { formatReminderWhen } from "@/lib/bookmark-reminders";
import { fw } from "@/theme/fonts";
import { colors, spacing, typography } from "@/theme/tokens";
import { usePullRefresh } from "@/lib/use-pull-refresh";

/**
 * Kaydedilenler (web `/saved`) — mesaj eylemlerinde "Kaydet" ile işaretlenen
 * mesajlar, en yeni kayıt önce. Erişim listede sunucuda yeniden
 * doğrulanır: sunucudan ayrılan ya da kanalı artık göremeyen kullanıcı
 * eski kaydı üzerinden mesajı okuyamaz.
 *
 * Kurulu hatırlatıcılar ("Bana hatırlat") en üstte "Yaklaşan
 * Hatırlatıcılar" bölümünde, en yakın önce (web ile aynı düzen); satırdaki
 * saat düğmesi hatırlatıcıyı kurar, değiştirir ya da kaldırır.
 */
export default function SavedScreen() {
  const bookmarks = useBookmarks();
  const pull = usePullRefresh(bookmarks.refetch);
  const toggle = useToggleBookmark();
  const [reminderFor, setReminderFor] = useState<BookmarkTarget | null>(null);

  const sections = useMemo((): { key: string; title: string | null; data: BookmarkEntry[] }[] => {
    const all = bookmarks.data ?? [];
    const upcoming = all
      .filter((entry) => entry.remindAt)
      .sort((a, b) => new Date(a.remindAt as string).getTime() - new Date(b.remindAt as string).getTime());
    if (upcoming.length === 0) return all.length ? [{ key: "saved", title: null, data: all }] : [];
    return [
      { key: "reminders", title: "Yaklaşan Hatırlatıcılar", data: upcoming },
      { key: "saved", title: "Kaydedilenler", data: all },
    ];
  }, [bookmarks.data]);

  const open = (entry: BookmarkEntry) => {
    if (entry.scope === "direct") {
      router.push(`/chat/direct/${entry.chatId}`);
      return;
    }
    // Kayıt sunucu kimliğini ayrı taşımıyor; web adresinden okunur.
    const serverId = /^\/servers\/([^/]+)\//.exec(entry.url)?.[1];
    router.push(serverId ? `/chat/channel/${entry.chatId}?serverId=${serverId}` : `/chat/channel/${entry.chatId}`);
  };

  const remove = (entry: BookmarkEntry) =>
    toggle.mutate(
      { target: { messageId: entry.messageId, scope: entry.scope, chatId: entry.chatId }, saved: true },
      { onSuccess: () => showToast("Kayıt kaldırıldı."), onError: () => showToast("Kayıt kaldırılamadı.", "error") }
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Kaydedilenler" }} />
      {bookmarks.isLoading ? (
        <ListSkeleton />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(entry, index) => `${entry.messageId}:${index}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ flex: 1, paddingTop: spacing["3xl"] }}>
              <EmptyState
                icon="bookmark"
                title="Kaydedilen mesaj yok"
                description="Bir mesajı basılı tutup Kaydet'i seçtiğinde burada görünür."
              />
            </View>
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text
                style={{
                  ...typography.overline,
                  color: colors.muted,
                  paddingHorizontal: spacing.lg,
                  paddingTop: section.key === "saved" ? spacing.md : 0,
                }}
              >
                {section.title.toLocaleUpperCase("tr")}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <MessagePreviewRow
              id={item.messageId}
              author={item.author}
              where={item.scope === "channel" ? `#${item.channelName ?? "kanal"} · ${item.serverName ?? ""}` : "Doğrudan mesaj"}
              content={item.content}
              hasFile={Boolean(item.fileUrl)}
              createdAt={item.createdAt}
              onPress={() => open(item)}
              footer={
                item.remindAt ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="clock" size={12} color={colors.brand} />
                    <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>
                      Hatırlatıcı: {formatReminderWhen(new Date(item.remindAt))}
                    </Text>
                  </View>
                ) : item.remindedAt ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="clock" size={12} color={colors.muted} />
                    <Text style={{ ...typography.caption, color: colors.muted }}>Hatırlatıldı</Text>
                  </View>
                ) : null
              }
              trailing={
                <View style={{ gap: spacing.xs }}>
                  <IconButton
                    icon="clock"
                    label="Bana hatırlat"
                    tint={item.remindAt ? colors.brand : colors.muted}
                    onPress={() => setReminderFor({ messageId: item.messageId, scope: item.scope, chatId: item.chatId })}
                  />
                  <IconButton icon="trash" label="Kaydı kaldır" tint={colors.muted} onPress={() => remove(item)} />
                </View>
              }
            />
          )}
        />
      )}
      <ReminderSheet target={reminderFor} onClose={() => setReminderFor(null)} />
    </Screen>
  );
}
