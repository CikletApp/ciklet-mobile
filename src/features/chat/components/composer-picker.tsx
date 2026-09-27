import { useEffect, useRef, useState, type RefObject } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurTargetView, BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import { Avatar, Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { BackspaceGlyph } from "./composer-glyphs";
import { useDragToDismiss } from "./drag-dismiss";
import { EmojiPickerPanel, SearchPill } from "./emoji-picker";
import type { PanelTab } from "./keyboard-space";

/**
 * Yazma çubuğunun altındaki satır içi panel — klavyenin yerini alır
 * (Telegram/WhatsApp düzeni). Eskiden ekranın %68'ini kaplayan bir alt
 * sayfaydı; yazarken sohbet tamamen kayboluyordu.
 *
 * Sekmeler panelin altında ortada yüzen bir haptır; zemini arkadaki içeriği
 * bulandırır (Android'de `BlurTargetView` hedefi panel içeriği).
 */

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

const TABS: { id: PanelTab; label: string }[] = [
  { id: "gif", label: "GIF'ler" },
  { id: "activity", label: "Aktiviteler" },
  { id: "emoji", label: "Emoji" },
];

const PILL_HEIGHT = 40;
const GIF_COLUMNS = 3;

export function ComposerPanel({
  tab,
  height,
  compact,
  onTabChange,
  onEmoji,
  onBackspace,
  onGif,
  onActivity,
  onSearchFocusChange,
  onDismiss,
}: {
  tab: PanelTab;
  height: number;
  /** Arama klavyesi açık: panel klavyenin üstünde dar kalır, hap gizlenir. */
  compact: boolean;
  onTabChange: (tab: PanelTab) => void;
  onEmoji: (emoji: string) => void;
  onBackspace: () => void;
  onGif: (url: string) => void;
  onActivity: (activityId: string) => void;
  onSearchFocusChange: (focused: boolean) => void;
  /** Tepeden aşağı çekilince paneli kapatır (klavye açılmaz). */
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const drag = useDragToDismiss(onDismiss);
  const contentRef = useRef<View>(null);
  // Liste sonu hapın altında kalmasın.
  const bottomInset = compact ? spacing.sm : PILL_HEIGHT + spacing.lg + insets.bottom;

  return (
    <Animated.View style={[{ height, backgroundColor: colors.deep }, drag.style]}>
      {compact ? null : (
        // Tutamaç: aşağı çekince panel kapanır (kategori çubuğu da çekilebilir).
        <GestureDetector gesture={drag.grab}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Paneli kapatmak için aşağı çek"
            style={{ height: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.deep }}
          >
            <View style={{ width: 36, height: 4, borderRadius: radii.full, backgroundColor: colors.border }} />
          </View>
        </GestureDetector>
      )}
      <BlurTargetView ref={contentRef} style={{ flex: 1, backgroundColor: colors.deep }}>
        {tab === "emoji" ? (
          <EmojiPickerPanel
            onEmoji={onEmoji}
            compact={compact}
            bottomInset={bottomInset}
            onSearchFocusChange={onSearchFocusChange}
            headerGesture={drag.header}
          />
        ) : tab === "gif" ? (
          <GifGrid onGif={onGif} bottomInset={bottomInset} onSearchFocusChange={onSearchFocusChange} />
        ) : (
          <ActivityList onActivity={onActivity} bottomInset={bottomInset} />
        )}
      </BlurTargetView>

      {compact ? null : (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: insets.bottom + spacing.sm,
            height: PILL_HEIGHT,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              height: PILL_HEIGHT,
              padding: 4,
              gap: 2,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: colors.bentoBorder,
              overflow: "hidden",
            }}
          >
            <Frosted blurTarget={contentRef} />
            {TABS.map((item) => {
              const selected = item.id === tab;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onTabChange(item.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={{
                    paddingHorizontal: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radii.full,
                    backgroundColor: selected ? colors.raised : "transparent",
                  }}
                >
                  <Text style={{ ...typography.caption, ...fw(600), color: selected ? colors.bright : colors.muted }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "emoji" ? (
            <Pressable
              onPress={onBackspace}
              accessibilityRole="button"
              accessibilityLabel="Geri sil"
              style={({ pressed }) => ({
                position: "absolute",
                right: spacing.md,
                width: PILL_HEIGHT,
                height: PILL_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: colors.bentoBorder,
                overflow: "hidden",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Frosted blurTarget={contentRef} />
              <BackspaceGlyph color={colors.bright} />
            </Pressable>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
}

/** Yarı saydam, arkasını bulandıran hap zemini. Android 12 altında yalnızca yarı saydam. */
function Frosted({ blurTarget }: { blurTarget: RefObject<View | null> }) {
  return (
    <>
      <BlurView
        blurTarget={blurTarget}
        intensity={60}
        tint={colors.scheme}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={{ position: "absolute", inset: 0 }}
      />
      <View style={{ position: "absolute", inset: 0, backgroundColor: colors.panel, opacity: 0.6 }} />
    </>
  );
}

function GifGrid({
  onGif,
  bottomInset,
  onSearchFocusChange,
}: {
  onGif: (url: string) => void;
  bottomInset: number;
  onSearchFocusChange: (focused: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const gifs = useQuery({
    queryKey: ["klipy", debounced],
    queryFn: () => api<KlipyResponse>(endpoints.klipy(debounced)),
    staleTime: 60_000,
  });

  return (
    <View style={{ flex: 1 }}>
      <SearchPill value={query} onChangeText={setQuery} placeholder="GIF ara" onFocusChange={onSearchFocusChange} />
      {gifs.isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={gifs.data?.data?.data ?? []}
          key="gif-grid"
          numColumns={GIF_COLUMNS}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: bottomInset, gap: 4 }}
          columnWrapperStyle={{ gap: 4 }}
          ListEmptyComponent={
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>
              GIF bulunamadı.
            </Text>
          }
          renderItem={({ item }) => {
            const preview = item.file?.xs?.gif?.url ?? item.file?.hd?.gif?.url;
            const full = item.file?.hd?.gif?.url ?? preview;
            if (!preview || !full) return <View style={{ flex: 1 / GIF_COLUMNS }} />;
            return (
              <Pressable
                onPress={() => onGif(full)}
                accessibilityRole="button"
                accessibilityLabel={item.title || "GIF gönder"}
                style={{
                  flex: 1 / GIF_COLUMNS,
                  aspectRatio: 1,
                  borderRadius: radii.md,
                  overflow: "hidden",
                  backgroundColor: colors.panel,
                }}
              >
                <Image source={{ uri: preview }} contentFit="cover" recyclingKey={preview} style={{ flex: 1 }} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function ActivityList({ onActivity, bottomInset }: { onActivity: (activityId: string) => void; bottomInset: number }) {
  const activities = useActivities();

  if (activities.isLoading) return <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />;

  return (
    <FlatList
      data={activities.data ?? []}
      key="activity-list"
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomInset, gap: spacing.sm }}
      ListEmptyComponent={
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>
          Henüz bir aktivite yok.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onActivity(item.id)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            backgroundColor: pressed ? colors.raised : colors.panel,
          })}
        >
          <Avatar imageUrl={item.icon} fallbackText={item.name} size={48} shape="squircle" />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{item.name}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </Pressable>
      )}
    />
  );
}
