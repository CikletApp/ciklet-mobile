import { useState } from "react";
import { FlatList, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useChannel, useChannelThreads, useCreateThread } from "@/api/hooks";
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  KeyboardAvoider,
  ListSkeleton,
  Pressable,
  SegmentedTabs,
  TextField,
  showToast,
} from "@/components/ui";
import { openThread } from "@/features/server/thread-nav";
import { formatChatListTime } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Bir kanalın alt başlıkları — web kanal başlığındaki "Alt başlıklar"
 * listesi: Açık / Arşiv sekmeleri, satıra dokununca alt başlık açılır,
 * üstte yeni alt başlık açma alanı (üst kanala yazabilen herkes açabilir;
 * yetki sunucuda denetlenir). "Özel alt başlık" (web create-thread-dialog
 * ile aynı): yalnızca davet edilenler ve moderatörler görür.
 */
export default function ChannelThreadsScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const parent = useChannel(serverId, channelId);
  const [tab, setTab] = useState<"open" | "archived">("open");
  const threads = useChannelThreads(serverId, channelId, tab === "archived");
  const create = useCreateThread(serverId, channelId);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitable, setInvitable] = useState(true);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed, ...(isPrivate ? { private: true, invitable } : {}) },
      {
        onSuccess: (thread) => {
          setName("");
          setIsPrivate(false);
          setInvitable(true);
          openThread(serverId, channelId, thread);
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Alt başlık açılamadı.", "error"),
      }
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: parent ? `#${parent.name} · Alt başlıklar` : "Alt başlıklar" }} />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="YENİ ALT BAŞLIK"
            value={name}
            onChangeText={setName}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
        <Button label="Aç" icon="plus" disabled={!name.trim()} loading={create.isPending} onPress={submit} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Icon name="eye-off" size={17} color={colors.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Özel alt başlık</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Yalnızca davet ettiğin kişiler ve moderatörler görebilir.
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
        </View>
        {isPrivate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Icon name="users" size={17} color={colors.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Herkes davet edebilir</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>Kapalıysa yalnızca moderatörler üye ekleyebilir.</Text>
            </View>
            <Switch value={invitable} onValueChange={setInvitable} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>
        ) : null}
      </View>

      <SegmentedTabs
        items={[
          { id: "open" as const, label: "Açık" },
          { id: "archived" as const, label: "Arşiv" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {threads.isLoading ? (
        <ListSkeleton rows={5} />
      ) : threads.error ? (
        <ErrorState
          message={threads.error instanceof ApiError ? threads.error.message : "Alt başlıklar yüklenemedi."}
          onRetry={() => void threads.refetch()}
        />
      ) : (threads.data ?? []).length === 0 ? (
        <EmptyState
          icon="message"
          title={tab === "open" ? "Açık alt başlık yok" : "Arşivde alt başlık yok"}
          description={tab === "open" ? "Bir konu için ayrı sohbet açmak üzere yukarıya ad yaz." : undefined}
        />
      ) : (
        <FlatList
          data={threads.data}
          keyExtractor={(thread) => thread.id}
          contentContainerStyle={{ padding: spacing.sm, paddingBottom: spacing["3xl"] }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openThread(serverId, channelId, item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} alt başlığı${item.private ? ", özel" : ""}${item.joined ? ", takip ediliyor" : ""}${item.locked ? ", kilitli" : ""}${item.archivedAt ? ", arşivde" : ""}`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Icon name={item.archivedAt ? "folder" : "message"} size={19} color={colors.muted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {item.archivedAt
                    ? `Arşivlendi · ${formatChatListTime(item.archivedAt)}`
                    : `Açıldı · ${formatChatListTime(item.createdAt)}`}
                </Text>
              </View>
              {item.private ? <Icon name="eye-off" size={15} color={colors.muted} /> : null}
              {item.joined ? <Icon name="bell" size={15} color={colors.brand} /> : null}
              {item.locked ? <Icon name="lock" size={15} color={colors.muted} /> : null}
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </KeyboardAvoider>
  );
}
