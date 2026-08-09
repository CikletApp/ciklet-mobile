import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import { Avatar, Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export type ComposerPickerTab = "emoji" | "gif" | "activity";

interface KlipyGif {
  id: number;
  title: string;
  file?: {
    hd?: { gif?: { url?: string } };
    xs?: { gif?: { url?: string } };
  };
}

interface KlipyResponse {
  data?: { data?: KlipyGif[] };
}

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "🥹", "😂", "🤣", "😊", "🙂",
  "🙃", "😉", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😏", "😴",
  "😭", "😤", "😡", "🤯", "😱", "🥶", "🤔", "🫡", "🤫", "🫠",
  "👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "🔥", "❤️", "💔",
  "✨", "⭐", "🎉", "🎂", "🚀", "💯", "✅", "❌", "⚠️", "🎮",
  "📌", "🔧", "🎁", "🎵", "📷", "🌍", "🍀", "☕", "👀", "💬",
];

export function ComposerPicker({
  visible,
  initialTab,
  onClose,
  onEmoji,
  onGif,
  onActivity,
}: {
  visible: boolean;
  initialTab: ComposerPickerTab;
  onClose: () => void;
  onEmoji: (emoji: string) => void;
  onGif: (url: string) => void;
  onActivity: (activityId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ComposerPickerTab>(initialTab);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const activities = useActivities();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const gifs = useQuery({
    queryKey: ["klipy", debounced],
    enabled: visible && tab === "gif",
    queryFn: () => api<KlipyResponse>(endpoints.klipy(debounced)),
    staleTime: 60_000,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }} />
        <View
          style={{
            height: "68%",
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
            overflow: "hidden",
          }}
        >
          <View style={{ width: 38, height: 4, alignSelf: "center", borderRadius: radii.full, backgroundColor: colors.border, marginBottom: spacing.md }} />
          <View style={{ flexDirection: "row", marginHorizontal: spacing.md, padding: 4, borderRadius: radii.xl, backgroundColor: colors.panel }}>
            {(["emoji", "gif", "activity"] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setTab(item)}
                style={{ flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.lg, backgroundColor: tab === item ? colors.raised : "transparent" }}
              >
                <Text style={{ ...typography.caption, fontWeight: "700", color: tab === item ? colors.bright : colors.muted }}>
                  {item === "emoji" ? "Emoji" : item === "gif" ? "GIF'ler" : "Aktiviteler"}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === "emoji" ? (
            <FlatList
              data={EMOJIS}
              key="emoji-grid"
              numColumns={8}
              keyExtractor={(item, index) => `${item}-${index}`}
              contentContainerStyle={{ padding: spacing.md }}
              renderItem={({ item }) => (
                <Pressable onPress={() => onEmoji(item)} style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 28 }}>{item}</Text>
                </Pressable>
              )}
            />
          ) : tab === "gif" ? (
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, margin: spacing.md, paddingHorizontal: spacing.md, minHeight: 46, borderRadius: radii.xl, backgroundColor: colors.panel }}>
                <Icon name="search" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="GIF ara" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.bright, ...typography.body }} />
              </View>
              {gifs.isLoading ? (
                <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />
              ) : (
                <FlatList
                  data={gifs.data?.data?.data ?? []}
                  key="gif-grid"
                  numColumns={2}
                  keyExtractor={(item, index) => `${item.id}-${index}`}
                  contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
                  columnWrapperStyle={{ gap: spacing.sm }}
                  ListEmptyComponent={<Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>GIF bulunamadı.</Text>}
                  renderItem={({ item }) => {
                    const preview = item.file?.xs?.gif?.url ?? item.file?.hd?.gif?.url;
                    const full = item.file?.hd?.gif?.url ?? preview;
                    if (!preview || !full) return <View style={{ flex: 1 }} />;
                    return (
                      <Pressable onPress={() => onGif(full)} style={{ flex: 1, aspectRatio: 1.35, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.deep }}>
                        <Image source={{ uri: preview }} contentFit="cover" style={{ flex: 1 }} />
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          ) : activities.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={activities.data ?? []}
              key="activity-list"
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onActivity(item.id)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: pressed ? colors.raised : colors.panel })}
                >
                  <Avatar imageUrl={item.icon} fallbackText={item.name} size={48} shape="squircle" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{item.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>{item.description}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
