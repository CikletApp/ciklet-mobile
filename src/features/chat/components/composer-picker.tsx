import { useEffect, useRef, type RefObject } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useActivities } from "@/api/hooks";
import { Avatar, Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { useChatScope } from "../chat-scope";
import { useCollapsingChrome, type CollapsingChrome } from "./collapsing-chrome";
import { BackspaceGlyph } from "./composer-glyphs";
import { useDragToDismiss } from "./drag-dismiss";
import { EmojiPickerPanel } from "./emoji-picker";
import { GifPicker } from "./gif-picker";
import { StickerPicker } from "./sticker-picker";
import type { ServerStickerLite } from "../server-assets";
import type { PanelTab } from "./keyboard-space";

/**
 * Yazma çubuğunun altındaki satır içi panel — klavyenin yerini alır
 * (Telegram/WhatsApp düzeni). Eskiden ekranın %68'ini kaplayan bir alt
 * sayfaydı; yazarken sohbet tamamen kayboluyordu.
 *
 * Sekmeler panelin altında ortada yüzen bir haptır; zemini arkadaki içeriği
 * bulandırır (Android'de `BlurTargetView` hedefi panel içeriği). Aşağı
 * kaydırınca hap ve üstteki arama/kategori satırı çekilir (collapsing-chrome).
 */

const TABS: { id: PanelTab; label: string }[] = [
  { id: "gif", label: "GIF'ler" },
  { id: "activity", label: "Aktiviteler" },
  { id: "emoji", label: "Emoji" },
  { id: "sticker", label: "Çıkartma" },
];

const PILL_HEIGHT = 40;

export function ComposerPanel({
  tab,
  height,
  compact,
  onTabChange,
  onEmoji,
  onBackspace,
  onGif,
  onActivity,
  onSticker,
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
  /** Sunucu kanalında çıkartma gönderimi; yoksa "Çıkartma" sekmesi yok. */
  onSticker?: (sticker: ServerStickerLite) => void;
  onSearchFocusChange: (focused: boolean) => void;
  /** Tepeden aşağı çekilince paneli kapatır (klavye açılmaz). */
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scope = useChatScope();
  const drag = useDragToDismiss(onDismiss);
  const contentRef = useRef<View>(null);
  // Liste sonu hapın altında kalmasın.
  const bottomInset = compact ? spacing.sm : PILL_HEIGHT + spacing.lg + insets.bottom;

  // Arama klavyesi açıkken (dar hâl) gizleme yok; sekme değişince çerçeve geri gelir.
  const chrome = useCollapsingChrome(!compact);
  const resetChrome = chrome.reset;
  useEffect(() => {
    resetChrome();
  }, [tab, compact, resetChrome]);

  // Hap yalnızca kaydırılır: BlurView'ın saydamlığıyla oynamak bulanıklığı bozar.
  // Panel kabı taşanı kırptığı için aşağı itilen hap görünmez ve dokunulmaz.
  const pillTravel = PILL_HEIGHT + spacing.sm + insets.bottom + 8;
  // Worklet `chrome`un tamamını değil yalnızca paylaşılan değeri yakalamalı:
  // nesnedeki kaydırma işleyicisi UI iş parçacığına kopyalanamıyor.
  const chromeProgress = chrome.progress;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chromeProgress.get() * pillTravel }],
  }));

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
            chrome={chrome}
            serverId={scope?.serverId}
          />
        ) : tab === "sticker" && scope?.serverId && onSticker ? (
          <StickerPicker serverId={scope.serverId} onSticker={onSticker} bottomInset={bottomInset} chrome={chrome} />
        ) : tab === "gif" ? (
          <GifPicker onGif={onGif} bottomInset={bottomInset} onSearchFocusChange={onSearchFocusChange} chrome={chrome} />
        ) : (
          <ActivityList onActivity={onActivity} bottomInset={bottomInset} chrome={chrome} />
        )}
      </BlurTargetView>

      {compact ? null : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: insets.bottom + spacing.sm,
              height: PILL_HEIGHT,
              alignItems: "center",
            },
            pillStyle,
          ]}
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
            {TABS.filter((item) => item.id !== "sticker" || (scope?.serverId && onSticker)).map((item) => {
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
        </Animated.View>
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

function ActivityList({
  onActivity,
  bottomInset,
  chrome,
}: {
  onActivity: (activityId: string) => void;
  bottomInset: number;
  chrome: CollapsingChrome;
}) {
  const activities = useActivities();

  if (activities.isLoading) return <ActivityIndicator color={colors.brand} style={{ flex: 1 }} />;

  return (
    <Animated.FlatList
      data={activities.data ?? []}
      key="activity-list"
      keyExtractor={(item) => item.id}
      onScroll={chrome.scrollHandler}
      scrollEventThrottle={16}
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
