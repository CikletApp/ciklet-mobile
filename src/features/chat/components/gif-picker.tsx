import { memo, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Animated from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { api, ApiError } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { CollapsibleHeader, type CollapsingChrome } from "./collapsing-chrome";
import { SearchPill } from "./emoji-picker";

/**
 * GIF sekmesi — ciklet-web `components/gif-picker.tsx` ile aynı akış:
 * açılışta "Popüler GIF'ler" düğmesi ve Klipy kategorileri; kategoriye ya da
 * aramaya basınca iki sütunlu, doğal en-boy oranlı (masonry) sonuçlar ve
 * kaydırdıkça sonraki sayfalar. Geri oku / X kategorilere döner; yazarak
 * kutuyu boşaltmak son sonuçları ekranda bırakır (web'deki gibi).
 */

interface GifFile {
  url?: string;
  width?: number;
  height?: number;
}

interface KlipyGif {
  id: number;
  title: string;
  file?: Partial<Record<"hd" | "md" | "sm" | "xs", { gif?: GifFile; webp?: GifFile }>>;
}

interface KlipyPage {
  data?: { data?: KlipyGif[]; has_next?: boolean };
}

interface KlipyCategory {
  category: string;
  query: string;
  preview_url: string;
}

interface KlipyCategoriesResponse {
  data?: { categories?: KlipyCategory[] };
}

type Mode = "categories" | "search" | "trending";

interface Tile {
  key: string;
  title: string;
  preview: string;
  full: string;
  height: number;
}

interface Block {
  key: string;
  columns: [Tile[], Tile[]];
}

/** Web `gap-1.5`. */
const GAP = 6;
/**
 * Sanal listenin bir öğesi bu kadar GIF'ten oluşan iki sütunlu bloktur
 * (sayfa başı 24'ün yarısı — sayfalar eklendikçe bloklar değişmez).
 */
const BLOCK_SIZE = 12;
/** Kısa sütun bu orana kadar uzatılıp bloğun altı düzlenir (kare kırpılır). */
const MAX_STRETCH = 0.35;
/** Sunucu sayfayı 20'de sabitliyor; ötesi aynı sayfayı tekrar getirir. */
const MAX_PAGE = 20;

function ratioOf(gif: KlipyGif): number {
  const dims = [gif.file?.xs?.gif, gif.file?.hd?.gif];
  for (const dim of dims) {
    if (dim?.width && dim.height) return Math.min(3, Math.max(0.3, dim.height / dim.width));
  }
  return 1;
}

/**
 * Sütunlara açgözlü dağıtım (kısa olana ekle), sonra kısa sütunun karoları
 * orantılı uzatılır ki blok düz bitsin ve bir sonraki blok boşluksuz otursun.
 */
function buildBlocks(gifs: KlipyGif[], columnWidth: number): Block[] {
  const blocks: Block[] = [];
  for (let start = 0; start < gifs.length; start += BLOCK_SIZE) {
    const columns: [Tile[], Tile[]] = [[], []];
    const heights = [0, 0];
    gifs.slice(start, start + BLOCK_SIZE).forEach((gif, offset) => {
      // Web 90 px'lik `xs` kullanıyor; telefonda yarım ekran genişliğindeki
      // karoda bulanık kalıyordu. 300 px WebP hem net hem `sm` GIF'ten küçük.
      const preview =
        gif.file?.hd?.webp?.url || gif.file?.sm?.gif?.url || gif.file?.xs?.gif?.url || gif.file?.hd?.gif?.url;
      const full = gif.file?.hd?.gif?.url || preview;
      if (!preview || !full) return;
      const height = columnWidth * ratioOf(gif);
      const target = heights[0] <= heights[1] ? 0 : 1;
      columns[target].push({ key: `${gif.id}-${start + offset}`, title: gif.title, preview, full, height });
      heights[target] += height + (columns[target].length > 1 ? GAP : 0);
    });
    const short = heights[0] <= heights[1] ? 0 : 1;
    const extra = heights[1 - short] - heights[short];
    const sum = columns[short].reduce((total, tile) => total + tile.height, 0);
    if (sum > 0 && extra > 0 && extra / sum <= MAX_STRETCH) {
      const scale = 1 + extra / sum;
      columns[short] = columns[short].map((tile) => ({ ...tile, height: tile.height * scale }));
    }
    if (columns[0].length + columns[1].length > 0) blocks.push({ key: `b-${start}`, columns });
  }
  return blocks;
}

export function GifPicker({
  onGif,
  bottomInset,
  onSearchFocusChange,
  chrome,
}: {
  onGif: (url: string) => void;
  bottomInset: number;
  onSearchFocusChange: (focused: boolean) => void;
  chrome?: CollapsingChrome;
}) {
  const screen = useWindowDimensions();
  const [width, setWidth] = useState(screen.width);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("categories");
  const [activeQuery, setActiveQuery] = useState("");

  // 200 ms gecikmeli arama. Boşa yazmak kategorilere döndürmez (son sonuçlar
  // kalır); yalnızca dolu metin modu değiştirir.
  useEffect(() => {
    const text = search.trim();
    if (!text) return;
    const timer = setTimeout(() => {
      setMode("search");
      setActiveQuery(text);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const resetChrome = chrome?.reset;
  useEffect(() => {
    resetChrome?.();
  }, [mode, activeQuery, resetChrome]);

  const categories = useQuery({
    queryKey: ["klipy", "categories"],
    queryFn: () => api<KlipyCategoriesResponse>(endpoints.klipyCategories),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  // Dakikada 60 istek sınırı: 429'u yeniden denemek yalnızca sınırı uzatır.
  const gifs = useInfiniteQuery({
    queryKey: ["klipy", mode === "trending" ? "trending" : "search", activeQuery],
    enabled: mode !== "categories",
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<KlipyPage>(
        mode === "trending" ? endpoints.klipyTrending(pageParam) : endpoints.klipySearch(activeQuery, pageParam)
      ),
    getNextPageParam: (last, _all, lastParam) =>
      last?.data?.has_next && lastParam < MAX_PAGE ? lastParam + 1 : undefined,
    // Bayatlayan sonsuz sorgu yüklü TÜM sayfaları art arda yeniden çeker (aynı
    // aramaya dönünce 10+ istek). Kullanılmayan arama 5 dk sonra düşer (varsayılan
    // 24 saat) ve dönüşte 1. sayfadan başlar — sunucu önbelleğiyle aynı süre.
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status === 429),
  });

  const columnWidth = (width - spacing.sm * 2 - GAP) / 2;
  const blocks = useMemo(
    () => buildBlocks(gifs.data?.pages.flatMap((page) => page?.data?.data ?? []) ?? [], columnWidth),
    [gifs.data, columnWidth]
  );

  const onCategory = (query: string) => {
    setSearch(query);
    setActiveQuery(query);
    setMode("search");
  };
  const onTrending = () => {
    setSearch("");
    setActiveQuery("");
    setMode("trending");
  };
  const onBack = () => {
    setSearch("");
    setActiveQuery("");
    setMode("categories");
  };

  const loadMore = () => {
    if (gifs.hasNextPage && !gifs.isFetching) void gifs.fetchNextPage();
  };

  const error =
    mode === "categories"
      ? categories.isError
        ? "GIF servisine bağlanılamadı"
        : null
      : gifs.isError
        ? gifs.error instanceof ApiError && gifs.error.status === 429
          ? "Çok fazla istek, biraz sonra tekrar dene"
          : "GIF yüklenirken hata oluştu"
        : null;

  const errorText = error ? (
    <Text style={{ ...typography.caption, color: colors.danger, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      {error}
    </Text>
  ) : null;

  const spinner = (
    <View style={{ height: 128, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.muted} />
    </View>
  );

  const attribution = (
    <Text style={{ fontSize: 10, lineHeight: 14, color: colors.muted, textAlign: "center", paddingVertical: spacing.sm }}>
      Powered by <Text style={fw(600)}>Klipy</Text>
    </Text>
  );

  const cardWidth = (width - spacing.sm * 3) / 2;

  return (
    <View style={{ flex: 1 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <CollapsibleHeader progress={chrome?.progress}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {mode !== "categories" ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Geri"
              hitSlop={6}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                marginLeft: spacing.sm,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.md,
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Icon name="arrow-left" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <SearchPill
              value={search}
              onChangeText={setSearch}
              onClear={onBack}
              placeholder="Klipy'de ara..."
              onFocusChange={onSearchFocusChange}
            />
          </View>
        </View>
      </CollapsibleHeader>

      {mode === "categories" ? (
        <Animated.FlatList
          key="gif-categories"
          data={categories.data?.data?.categories ?? []}
          numColumns={2}
          keyExtractor={(item) => item.query}
          onScroll={chrome?.scrollHandler}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: bottomInset, gap: spacing.sm }}
          columnWrapperStyle={{ gap: spacing.sm }}
          ListHeaderComponent={
            <>
              {errorText}
              <Pressable
                onPress={onTrending}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  marginBottom: spacing.xs,
                  borderRadius: radii.lg,
                  backgroundColor: pressed ? colors.raised : colors.panel,
                })}
              >
                <Icon name="trending-up" size={20} color={colors.brand} />
                <Text style={{ fontSize: 14, lineHeight: 20, ...fw(600), color: colors.bright }}>Popüler GIF&apos;ler</Text>
              </Pressable>
            </>
          }
          ListEmptyComponent={categories.isPending ? spinner : null}
          ListFooterComponent={attribution}
          renderItem={({ item }) => <CategoryCard category={item} width={cardWidth} onPress={onCategory} />}
        />
      ) : (
        <Animated.FlatList
          // Yeni arama tepeden başlasın.
          key={`gif-${mode}-${activeQuery}`}
          data={blocks}
          keyExtractor={(block) => block.key}
          onScroll={chrome?.scrollHandler}
          scrollEventThrottle={16}
          onEndReached={loadMore}
          onEndReachedThreshold={0.8}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: bottomInset }}
          ListHeaderComponent={errorText}
          ListEmptyComponent={
            gifs.isPending && gifs.fetchStatus !== "idle" ? (
              spinner
            ) : error ? null : (
              <View style={{ height: 128, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, lineHeight: 32, marginBottom: spacing.sm }}>🔍</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>Sonuç bulunamadı</Text>
              </View>
            )
          }
          ListFooterComponent={
            <>
              {gifs.isFetchingNextPage ? (
                <View style={{ paddingVertical: spacing["2xl"] }}>
                  <ActivityIndicator color={colors.muted} />
                </View>
              ) : null}
              {attribution}
            </>
          }
          renderItem={({ item }) => <GifBlock block={item} onGif={onGif} />}
        />
      )}
    </View>
  );
}

const GifBlock = memo(function GifBlock({ block, onGif }: { block: Block; onGif: (url: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
      {block.columns.map((column, index) => (
        <View key={index} style={{ flex: 1, gap: GAP }}>
          {column.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() => onGif(tile.full)}
              accessibilityRole="button"
              accessibilityLabel={tile.title || "GIF gönder"}
              style={({ pressed }) => ({
                height: tile.height,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: colors.panel,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Image source={{ uri: tile.preview }} contentFit="cover" recyclingKey={tile.preview} style={{ flex: 1 }} />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
});

function CategoryCard({
  category,
  width,
  onPress,
}: {
  category: KlipyCategory;
  width: number;
  onPress: (query: string) => void;
}) {
  // Web'deki CSS `capitalize` (lang="tr"): RN'in textTransform'u "i"yi "I" yapar.
  const label = category.category.replace(/(^|\s)(\S)/g, (_, space: string, first: string) =>
    space + first.toLocaleUpperCase("tr")
  );
  return (
    <Pressable
      onPress={() => onPress(category.query)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width,
        aspectRatio: 16 / 10,
        borderRadius: radii.lg,
        overflow: "hidden",
        backgroundColor: colors.panel,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Image
        source={{ uri: category.preview_url }}
        contentFit="cover"
        recyclingKey={category.preview_url}
        style={{ position: "absolute", inset: 0 }}
      />
      {/* Web: from-black/70 via-black/20 to-transparent (alttan üste). */}
      <Svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <Defs>
          <LinearGradient id="klipy-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#000" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#klipy-fade)" />
      </Svg>
      <Text
        numberOfLines={1}
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 10,
          fontSize: 14,
          lineHeight: 18,
          ...fw(700),
          color: "#fff",
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
