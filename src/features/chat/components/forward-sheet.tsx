import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { directDisplay, useDirects, useFriends } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ForwardTargetsResponse } from "@/api/types";
import { Avatar, Icon, KeyboardAvoider, showDialog } from "@/components/ui";
import { isOfficialProfile } from "@/lib/official";
import type { ChatMessagePayload } from "@/realtime/events";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import {
  buildForwardPayload,
  FORWARD_NOTE_MAX,
  MAX_FORWARD_TARGETS,
} from "../forward";

/**
 * Mesajı İlet — hedef seçici (web `forward-message-modal.tsx` karşılığı).
 *
 * Hedefler: açık DM'ler (sohbet listesinden), henüz DM'i olmayan arkadaşlar
 * ve yazılabilir sunucu kanalları (`/api/forward/targets`). En fazla
 * MAX_FORWARD_TARGETS hedef seçilir; her hedefe standart mesaj ucuyla AYRI
 * gönderim yapılır, isteğe bağlı not ardından ikinci mesaj olarak gider.
 *
 * Gönderim SIRAYLA: hız sınırı 10 saniyede 8 mesaj; paralel patlatmak
 * hedeflerin yarısını 429'a düşürürdü.
 */

type Target =
  | { key: string; kind: "direct"; directId: string; label: string; sublabel?: string }
  | { key: string; kind: "friend"; friendId: string; label: string; sublabel?: string }
  | {
      key: string;
      kind: "channel";
      serverId: string;
      channelId: string;
      label: string;
      sublabel: string;
    };

export function ForwardSheet({
  message,
  onClose,
}: {
  message: ChatMessagePayload;
  onClose: () => void;
}) {
  const myId = useAuth((s) => s.profile?.id);
  const { data: directs } = useDirects();
  const { accepted } = useFriends();
  const queryClient = useQueryClient();

  const targetsQuery = useQuery({
    queryKey: qk.forwardTargets,
    queryFn: () => api<ForwardTargetsResponse>(endpoints.forwardTargets),
    staleTime: 60_000,
  });

  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Map<string, Target>>(new Map());
  const [sending, setSending] = useState(false);

  const targets = useMemo<{ chats: Target[]; channels: Target[] }>(() => {
    const chats: Target[] = [];
    const channels: Target[] = [];
    const directPeerIds = new Set<string>();

    for (const direct of directs ?? []) {
      const display = directDisplay(direct, myId);
      // Resmî hesap sohbeti tek yönlü: oraya iletilemez.
      if (!display.isGroup && isOfficialProfile(display.peer)) continue;
      if (display.peer) directPeerIds.add(display.peer.id);
      chats.push({
        key: `direct:${direct.id}`,
        kind: "direct",
        directId: direct.id,
        label: display.title,
        sublabel: display.isSelf
          ? "yalnızca sen görürsün"
          : display.isGroup
            ? `${display.members.length} üye`
            : display.peer
              ? `@${display.peer.username}`
              : undefined,
      });
    }

    // Henüz DM açılmamış arkadaşlar: gönderimde sohbet oluşturulur.
    for (const friend of accepted) {
      const profile = friend.profile;
      if (directPeerIds.has(profile.id) || profile.id === myId) continue;
      if (isOfficialProfile(profile)) continue;
      chats.push({
        key: `friend:${profile.id}`,
        kind: "friend",
        friendId: profile.id,
        label: profile.name?.trim() || profile.username,
        sublabel: `@${profile.username}`,
      });
    }

    for (const server of targetsQuery.data?.servers ?? []) {
      for (const channel of server.channels) {
        channels.push({
          key: `channel:${channel.id}`,
          kind: "channel",
          serverId: server.id,
          channelId: channel.id,
          label: channel.name,
          sublabel: server.name,
        });
      }
    }

    return { chats, channels };
  }, [directs, accepted, targetsQuery.data, myId]);

  const filter = (list: Target[]) => {
    const needle = query.toLocaleLowerCase("tr").trim();
    if (!needle) return list;
    return list.filter((target) =>
      `${target.label} ${target.sublabel ?? ""}`.toLocaleLowerCase("tr").includes(needle)
    );
  };

  const toggle = (target: Target) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(target.key)) next.delete(target.key);
      else if (next.size < MAX_FORWARD_TARGETS) next.set(target.key, target);
      else {
        showDialog("Sınır", `En fazla ${MAX_FORWARD_TARGETS} hedef seçebilirsin.`);
      }
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const payload = buildForwardPayload(message);
    const trimmedNote = note.trim().slice(0, FORWARD_NOTE_MAX);
    const failures: string[] = [];
    const touchedChats: string[] = [];

    for (const target of selected.values()) {
      try {
        let path: string;
        let chatId: string;
        if (target.kind === "channel") {
          path = endpoints.sendChannelMessage(target.channelId, target.serverId);
          chatId = target.channelId;
        } else {
          let directId: string;
          if (target.kind === "direct") {
            directId = target.directId;
          } else {
            const created = await api<{ id: string }>(endpoints.directInit, {
              method: "POST",
              body: { friendId: target.friendId },
            });
            directId = created.id;
          }
          path = endpoints.sendDirectMessage(directId);
          chatId = directId;
        }

        await api(path, { method: "POST", body: payload });
        if (trimmedNote) {
          await api(path, { method: "POST", body: { content: trimmedNote } });
        }
        touchedChats.push(chatId);
      } catch (reason) {
        failures.push(
          `${target.label}: ${reason instanceof Error ? reason.message : "gönderilemedi"}`
        );
      }
    }

    // Hedef sohbetin geçmişi kalıcı cache'te (staleTime: Infinity); iletilen
    // mesaj bir sonraki açılışta görünsün diye açıkça bayatlatılır.
    for (const chatId of touchedChats) {
      void queryClient.invalidateQueries({ queryKey: qk.messages.chat(chatId) });
    }
    if (touchedChats.length > 0) {
      void queryClient.invalidateQueries({ queryKey: qk.directs });
    }

    setSending(false);
    if (failures.length > 0) {
      showDialog("Bazı hedeflere iletilemedi", failures.join("\n"));
      return;
    }
    onClose();
  };

  const preview = message.content?.trim() || "Dosya eki";
  const chats = filter(targets.chats);
  const channels = filter(targets.channels);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoider style={{ backgroundColor: "transparent" }}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="İletmeyi kapat"
            style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              maxHeight: "82%",
              paddingTop: spacing.lg,
              paddingBottom: spacing["2xl"],
              gap: spacing.md,
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

            <View style={{ paddingHorizontal: spacing.lg, gap: 2 }}>
              <Text style={{ ...typography.display, color: colors.bright }}>Mesajı İlet</Text>
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                {preview}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: spacing.lg,
                paddingHorizontal: spacing.md,
                borderRadius: radii.full,
                backgroundColor: colors.panel,
              }}
            >
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Sohbet veya kanal ara"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  color: colors.bright,
                  ...typography.body,
                }}
                accessibilityLabel="Hedef ara"
              />
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: spacing.sm }}
            >
              {chats.length > 0 ? <SheetSection title="SOHBETLER" /> : null}
              {chats.map((target) => (
                <TargetRow
                  key={target.key}
                  target={target}
                  selected={selected.has(target.key)}
                  onPress={() => toggle(target)}
                  directs={directs}
                  myId={myId}
                />
              ))}
              {channels.length > 0 ? <SheetSection title="KANALLAR" /> : null}
              {targetsQuery.isLoading ? (
                <ActivityIndicator color={colors.muted} style={{ marginVertical: spacing.md }} />
              ) : null}
              {channels.map((target) => (
                <TargetRow
                  key={target.key}
                  target={target}
                  selected={selected.has(target.key)}
                  onPress={() => toggle(target)}
                  directs={directs}
                  myId={myId}
                />
              ))}
              {chats.length === 0 && channels.length === 0 && !targetsQuery.isLoading ? (
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.muted,
                    textAlign: "center",
                    paddingVertical: spacing.lg,
                  }}
                >
                  Eşleşen hedef yok.
                </Text>
              ) : null}
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Not ekle (isteğe bağlı)"
                placeholderTextColor={colors.muted}
                maxLength={FORWARD_NOTE_MAX}
                style={{
                  minHeight: 42,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  backgroundColor: colors.panel,
                  color: colors.bright,
                  ...typography.body,
                }}
                accessibilityLabel="İletme notu"
              />
              <Pressable
                onPress={() => void submit()}
                disabled={selected.size === 0 || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: selected.size === 0 || sending }}
                style={({ pressed }) => ({
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  backgroundColor:
                    selected.size === 0 ? colors.panel : pressed ? colors.raised : colors.brand,
                  opacity: sending ? 0.6 : 1,
                })}
              >
                {sending ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Icon
                    name="forward"
                    size={18}
                    color={selected.size === 0 ? colors.muted : colors.onBrand}
                  />
                )}
                <Text
                  style={{
                    ...typography.bodyStrong,
                    color: selected.size === 0 ? colors.muted : colors.onBrand,
                  }}
                >
                  {selected.size > 1 ? `${selected.size} sohbete ilet` : "İlet"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function SheetSection({ title }: { title: string }) {
  return (
    <Text
      style={{
        ...typography.overline,
        color: colors.muted,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
      }}
    >
      {title}
    </Text>
  );
}

function TargetRow({
  target,
  selected,
  onPress,
  directs,
  myId,
}: {
  target: Target;
  selected: boolean;
  onPress: () => void;
  directs: ReturnType<typeof useDirects>["data"];
  myId: string | undefined;
}) {
  // Avatar için görsel kaynağı: DM satırının kendisi; kanal için sunucu adı
  // baş harfli kutu yeterli (görsel sublabel'da zaten yazıyor).
  let avatar: React.ReactNode;
  if (target.kind === "channel") {
    avatar = (
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brandSoft,
        }}
      >
        <Icon name="hash" size={17} color={colors.brand} />
      </View>
    );
  } else {
    const direct =
      target.kind === "direct" ? directs?.find((d) => d.id === target.directId) : undefined;
    const display = direct ? directDisplay(direct, myId) : undefined;
    if (display?.isGroup && !display.imageUrl) {
      avatar = (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.brandSoft,
          }}
        >
          <Icon name="users" size={17} color={colors.brand} />
        </View>
      );
    } else {
      avatar = (
        <Avatar
          profileId={display?.peer?.id ?? (target.kind === "friend" ? target.friendId : undefined)}
          imageUrl={display?.imageUrl}
          fallbackText={target.label}
          size={36}
        />
      );
    }
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      {avatar}
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1}>
          {target.label}
        </Text>
        {target.sublabel ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {target.sublabel}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: selected ? colors.brand : "transparent",
        }}
      >
        {selected ? <Icon name="check" size={13} color={colors.onBrand} /> : null}
      </View>
    </Pressable>
  );
}
