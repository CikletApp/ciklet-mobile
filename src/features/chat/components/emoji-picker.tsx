import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { GestureDetector, type GestureType } from "react-native-gesture-handler";

import { EmojiImage, Icon, type IconName } from "@/components/ui";
import { emojiUrl, getDokimorji } from "@/lib/emoji";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Emoji seçici — ciklet-web `components/emoji-picker.tsx` ile aynı veri:
 * emoji-mart 1.2.1 "twitter" seti (yalnızca Twemoji görseli olan emojiler),
 * Türkçe arama anahtar kelimeleri ve Dokimorji — web'deki gibi ayrı bölüm
 * değil, manifestteki kategorisinde: bayraklar Türk bayrağının hemen
 * arkasında, diğerleri kategorisinin başında.
 *
 * Düzen Telegram'ınki: üstte kategori simgeleri, altında "Ara" hapı, sonra
 * bölüm başlıklarıyla TEK sürekli liste. Simgeye basınca liste o bölüme
 * atlar; kaydırdıkça etkin simge güncellenir. Satır yükseklikleri sabit
 * olduğundan bölüm konumları önceden hesaplanır (ölçüm beklenmez).
 */

interface PickerEmoji {
  native: string;
  url: string;
  name: string;
  keywords: string[];
  /** Ad + anahtar kelimeler, küçük harf — arama her tuşta yeniden üretmesin. */
  haystack: string;
}

interface Category {
  id: string;
  label: string;
  emojis: PickerEmoji[];
}

interface EmojiMartData {
  categories: { id: string; emojis: string[] }[];
  emojis: Record<string, { name: string; keywords?: string[]; skins: { native: string }[] }>;
}

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "emojis"; key: string; emojis: PickerEmoji[] };

interface SectionStart {
  id: string;
  label: string;
  /** Simge: bölümün ilk emojisi; "son kullanılanlar"da saat. */
  icon: string | null;
  offset: number;
}

/** Web seçicisindeki lucide simgelerinin karşılığı (Smile, Dog, …, Flag). */
const CATEGORY_ICONS: Record<string, IconName> = {
  people: "emoji",
  nature: "dog",
  foods: "utensils",
  activity: "gamepad",
  places: "plane",
  objects: "lightbulb",
  symbols: "heart",
  flags: "flag",
};

const LABELS: Record<string, string> = {
  people: "İnsanlar",
  nature: "Doğa",
  foods: "Yiyecek",
  activity: "Aktiviteler",
  places: "Seyahat",
  objects: "Nesneler",
  symbols: "Semboller",
  flags: "Bayraklar",
};

/**
 * Türkçe duyarlı küçük harf — `toLocaleLowerCase("tr")` Hermes'te pahalı ve
 * binlerce kelimede her tuşa basışta aramayı saniyelerce dondurdu. Türkçeye
 * özgü tek fark I/İ; onu elle çevirip hızlı `toLowerCase` kullanıyoruz.
 */
function fold(value: string): string {
  return value.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

function haystackOf(name: string, keywords: string[]): string {
  return fold(`${name} ${keywords.join(" ")}`);
}

const RECENT_KEY = "ciklet.emoji.recent";
const RECENT_LIMIT = 24;
const COLUMNS = 8;
const HEADER_HEIGHT = 34;
const ROW_HEIGHT = 44;

let categoriesCache: Category[] | null = null;
/** Son kullanılanların bellek kopyası; ekranda gösterilen liste açılışta dondurulur. */
let recentCache: string[] | null = null;

/**
 * Veri seti ~470 KB; seçici ilk açıldığında bir kez okunur. `require` burada
 * olduğu için açılış süresine eklenmiyor.
 */
function standardCategories(): Category[] {
  if (categoriesCache) return categoriesCache;
  const data = require("@emoji-mart/data/sets/15/twitter.json") as EmojiMartData;
  categoriesCache = data.categories.map((category) => ({
    id: category.id,
    label: LABELS[category.id] ?? category.id,
    emojis: category.emojis.flatMap((id) => {
      const entry = data.emojis[id];
      const native = entry?.skins[0]?.native;
      const url = native ? emojiUrl(native) : null;
      const keywords = entry?.keywords ?? [];
      return entry && native && url
        ? [{ native, url, name: entry.name, keywords, haystack: haystackOf(entry.name, keywords) }]
        : [];
    }),
  }));
  return categoriesCache;
}

let turkishCache: Map<string, string> | null = null;

/**
 * Türkçe arama anahtar kelimeleri (emoji → kelimeler) — web'in
 * `public/dokimorji/tr-emoji-keywords.json` dosyasının kopyası, uygulamaya
 * gömülü. Eskiden sunucudan çekiliyordu ama üretim sunucusu bu dosyayı
 * oturumsuz isteğe giriş sayfasına yönlendiriyor (bkz. web `src/proxy.ts`),
 * "kalp" araması boş dönüyordu. Emoji seti de gömülü (emoji-mart 1.2.1), iki
 * veri birlikte sabit kalıyor; web dosyayı güncellerse buraya da kopyalanmalı.
 * İlk aramada bir kez okunur ve küçültülür (~2000 girdi).
 */
function turkishIndex(): Map<string, string> {
  if (turkishCache) return turkishCache;
  const words = require("../../../lib/data/tr-emoji-keywords.json") as Record<string, string>;
  turkishCache = new Map(Object.entries(words).map(([native, text]) => [native, fold(text)]));
  return turkishCache;
}

/**
 * Dokimorji'yi kategorilere yerleştirir (web `components/emoji-picker.tsx`
 * ile aynı kural). Kategorisi veri setinde olmayan Dokimorji web'de de
 * gösterilmiyor; burada da atlanır.
 */
function withDokimorji(categories: Category[]): Category[] {
  const custom = getDokimorji();
  if (custom.length === 0) return categories;
  return categories.map((category) => {
    const items: PickerEmoji[] = custom
      .filter((item) => item.category === category.id)
      .map((item) => ({
        native: item.native,
        url: item.url,
        name: item.name,
        keywords: item.keywords,
        haystack: haystackOf(item.name, item.keywords),
      }));
    if (items.length === 0) return category;
    const emojis = [...category.emojis];
    const turkey = category.id === "flags" ? emojis.findIndex((emoji) => emoji.native === "🇹🇷") : -1;
    if (turkey !== -1) emojis.splice(turkey + 1, 0, ...items);
    else emojis.unshift(...items);
    return { ...category, emojis };
  });
}

async function loadRecent(): Promise<string[]> {
  if (recentCache) return recentCache;
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    recentCache = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    recentCache = [];
  }
  return recentCache;
}

/**
 * Seçilen emoji son kullanılanların başına yazılır. Açık seçicideki liste
 * bilerek güncellenmez: her seçimde bölüm kayar ve parmağın altındaki
 * emoji değişirdi (Telegram da bir sonraki açılışta günceller).
 */
async function rememberRecent(native: string) {
  await loadRecent();
  recentCache = [native, ...(recentCache ?? []).filter((item) => item !== native)].slice(0, RECENT_LIMIT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recentCache)).catch(() => {});
}

export function EmojiPickerPanel({
  onEmoji,
  compact = false,
  bottomInset = spacing.sm,
  onSearchFocusChange,
  headerGesture,
}: {
  onEmoji: (emoji: string) => void;
  /**
   * Arama klavyesi açıkken panelin klavye üstünde kalan dar hâli:
   * kategori şeridi gizlenir, arama kutusu ve sonuçlar kalır.
   */
  compact?: boolean;
  /** Listenin altında boş bırakılacak pay (yüzen sekme hapı için). */
  bottomInset?: number;
  onSearchFocusChange?: (focused: boolean) => void;
  /** Kategori çubuğuna bağlanan aşağı çekerek kapatma hareketi (drag-dismiss.ts). */
  headerGesture?: GestureType;
}) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<FlatList<Row>>(null);

  useEffect(() => {
    void loadRecent().then(setRecent);
  }, []);

  const categories = useMemo(() => withDokimorji(standardCategories()), []);
  const everything = useMemo(() => {
    const seen = new Map<string, PickerEmoji>();
    for (const category of categories) for (const emoji of category.emojis) seen.set(emoji.native, emoji);
    return seen;
  }, [categories]);

  const recentEmojis = useMemo(
    () => recent.flatMap((native) => {
      const known = everything.get(native);
      return known ? [known] : [];
    }),
    [recent, everything]
  );

  // Yazı kutusu anında güncellenir; sonuç listesi arkadan gelir.
  const needle = useDeferredValue(fold(query.trim()));
  const results = useMemo(() => {
    if (!needle) return [];
    const trIndex = turkishIndex();
    const found: PickerEmoji[] = [];
    for (const emoji of everything.values()) {
      if (emoji.haystack.includes(needle) || (trIndex.get(emoji.native) ?? "").includes(needle)) {
        found.push(emoji);
        if (found.length >= 240) break;
      }
    }
    return found;
  }, [needle, everything]);

  // Bölümler tek listede: başlık satırı + 8'li emoji satırları. Konumlar
  // sabit yüksekliklerden hesaplanır; kategoriye atlama ölçüm beklemez.
  const { rows, layout, starts } = useMemo(() => {
    const sections = [
      ...(recentEmojis.length > 0
        ? [{ id: "recent", label: "Son kullanılanlar", icon: null, emojis: recentEmojis }]
        : []),
      ...categories.map((category) => ({
        id: category.id,
        label: category.label,
        icon: category.emojis[0]?.url ?? null,
        emojis: category.emojis,
      })),
    ];
    const list: Row[] = [];
    const frames: { length: number; offset: number }[] = [];
    const heads: SectionStart[] = [];
    let offset = 0;
    for (const section of sections) {
      if (section.emojis.length === 0) continue;
      heads.push({ id: section.id, label: section.label, icon: section.icon, offset });
      list.push({ kind: "header", key: `h-${section.id}`, label: section.label.toLocaleUpperCase("tr") });
      frames.push({ length: HEADER_HEIGHT, offset });
      offset += HEADER_HEIGHT;
      for (let index = 0; index < section.emojis.length; index += COLUMNS) {
        list.push({ kind: "emojis", key: `r-${section.id}-${index}`, emojis: section.emojis.slice(index, index + COLUMNS) });
        frames.push({ length: ROW_HEIGHT, offset });
        offset += ROW_HEIGHT;
      }
    }
    return { rows: list, layout: frames, starts: heads };
  }, [recentEmojis, categories]);

  const current = active ?? starts[0]?.id ?? null;

  const pick = (emoji: PickerEmoji) => {
    onEmoji(emoji.native);
    void rememberRecent(emoji.native);
  };

  const jumpTo = (section: SectionStart) => {
    setQuery("");
    setActive(section.id);
    listRef.current?.scrollToOffset({ offset: section.offset, animated: false });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 1;
    let found = starts[0]?.id ?? null;
    for (const start of starts) {
      if (start.offset > y) break;
      found = start.id;
    }
    if (found !== current) setActive(found);
  };

  const cell = (emoji: PickerEmoji) => (
    <Pressable
      key={emoji.native}
      onPress={() => pick(emoji)}
      accessibilityRole="button"
      accessibilityLabel={emoji.name}
      style={({ pressed }) => ({
        width: `${100 / COLUMNS}%`,
        height: ROW_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <EmojiImage url={emoji.url} size={30} label={emoji.native} />
    </Pressable>
  );

  // Kategori çubuğu — web'dekiyle aynı: solda (varsa) son kullanılanlar
  // karesi ve ince ayraç, ardından eşit genişlikte 8 kategori; her biri
  // çizgi simge + altında küçük ad. Etkin olan hafif dolgulu ve parlak.
  const recentStart = starts.find((section) => section.id === "recent");
  const categoryBar = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        height: 48,
        paddingHorizontal: 4,
        gap: 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {recentStart ? (
        <>
          <Pressable
            onPress={() => jumpTo(recentStart)}
            accessibilityRole="tab"
            accessibilityState={{ selected: !needle && current === "recent" }}
            accessibilityLabel={recentStart.label}
            style={{
              width: 32,
              height: 32,
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.lg,
              backgroundColor: !needle && current === "recent" ? colors.raised : "transparent",
            }}
          >
            <Icon name="clock" size={16} color={!needle && current === "recent" ? colors.bright : colors.muted} />
          </Pressable>
          <View style={{ width: 1, height: 20, alignSelf: "center", marginHorizontal: 2, backgroundColor: colors.border }} />
        </>
      ) : null}
      {starts
        .filter((section) => section.id !== "recent")
        .map((section) => {
          const selected = !needle && section.id === current;
          const tint = selected ? colors.bright : colors.muted;
          return (
            <Pressable
              key={section.id}
              onPress={() => jumpTo(section)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={section.label}
              style={{
                flex: 1,
                minWidth: 0,
                marginVertical: 4,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                borderRadius: radii.md,
                backgroundColor: selected ? colors.raised : "transparent",
              }}
            >
              <Icon name={CATEGORY_ICONS[section.id] ?? "emoji"} size={16} color={tint} />
              <Text
                numberOfLines={1}
                style={{ width: "100%", paddingHorizontal: 1, textAlign: "center", fontSize: 9, lineHeight: 11, ...fw(600), color: tint }}
              >
                {section.label}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {compact ? null : headerGesture ? (
        <GestureDetector gesture={headerGesture}>{categoryBar}</GestureDetector>
      ) : (
        categoryBar
      )}

      <SearchPill
        value={query}
        onChangeText={setQuery}
        placeholder="Ara"
        onFocusChange={onSearchFocusChange}
      />

      {needle ? (
        <FlatList
          key="emoji-search"
          data={results}
          numColumns={COLUMNS}
          keyExtractor={(emoji) => emoji.native}
          initialNumToRender={48}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: bottomInset }}
          ListEmptyComponent={
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>
              Emoji bulunamadı.
            </Text>
          }
          renderItem={({ item }) => cell(item)}
        />
      ) : (
        <FlatList
          ref={listRef}
          key="emoji-sections"
          data={rows}
          keyExtractor={(row) => row.key}
          getItemLayout={(_, index) => ({ length: layout[index]?.length ?? ROW_HEIGHT, offset: layout[index]?.offset ?? 0, index })}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          onScroll={onScroll}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: bottomInset }}
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <Text
                numberOfLines={1}
                style={{
                  ...typography.overline,
                  height: HEADER_HEIGHT,
                  paddingTop: spacing.md,
                  paddingHorizontal: spacing.xs,
                  color: colors.muted,
                }}
              >
                {item.label}
              </Text>
            ) : (
              <View style={{ height: ROW_HEIGHT, flexDirection: "row" }}>{item.emojis.map(cell)}</View>
            )
          }
        />
      )}
    </View>
  );
}

/** Telegram'daki yuvarlak "Ara" kutusu — emoji ve GIF sekmeleri paylaşır. */
export function SearchPill({
  value,
  onChangeText,
  placeholder,
  onFocusChange,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onFocusChange?: (focused: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        height: 38,
        borderRadius: radii.full,
        backgroundColor: colors.panel,
      }}
    >
      <Icon name="search" size={16} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        style={{ flex: 1, paddingVertical: 0, color: colors.bright, ...typography.body }}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
          hitSlop={8}
          style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="close" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
