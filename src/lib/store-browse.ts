/**
 * Mağaza arama / filtre / sıralama — web lib/store-browse ile aynı kurallar.
 * Saf yardımcılar; testi tests/store-browse.test.mjs.
 */
export const STORE_THEMES = ["sevimli", "korku", "fantezi", "doga", "bilim-kurgu", "mevsimsel", "turkiye"] as const;
export type StoreTheme = (typeof STORE_THEMES)[number];

/** "Yeni eklenenler" web'deki vitrin tablosuna (eklenme günü) dayanıyor; mobilde katalog sırası. */
export const STORE_SORTS = ["price-asc", "price-desc", "name"] as const;
export type StoreSort = (typeof STORE_SORTS)[number];

export interface StoreFilters {
  query: string;
  themes: readonly string[];
  collection: string | null;
  ownedOnly: boolean;
}

export const EMPTY_STORE_FILTERS: StoreFilters = { query: "", themes: [], collection: null, ownedOnly: false };

/** Türkçe küçük harf + aksansız ("Işık" ~ "isik") — web normalizeSearch. */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Arama hariç etkin filtre sayısı. */
export function activeFilterCount(filters: StoreFilters): number {
  return filters.themes.length + (filters.collection ? 1 : 0) + (filters.ownedOnly ? 1 : 0);
}

export function hasActiveFilters(filters: StoreFilters): boolean {
  return activeFilterCount(filters) > 0 || normalizeSearch(filters.query) !== "";
}

/** Grup içinde VEYA, gruplar arasında VE; arama tüm kelimeleri arar (web filterStoreItems). */
export function filterStoreItems<
  T extends { name: string; description: string; owned: boolean; collection?: string | null; themes?: readonly string[] },
>(items: readonly T[], filters: StoreFilters, extraText?: (item: T) => string): T[] {
  const query = normalizeSearch(filters.query);
  return items.filter((item) => {
    const themes = item.themes ?? [];
    if (filters.themes.length && !themes.some((th) => filters.themes.includes(th))) return false;
    if (filters.collection && item.collection !== filters.collection) return false;
    if (filters.ownedOnly && !item.owned) return false;
    if (query) {
      const haystack = normalizeSearch([item.name, item.description, ...themes, extraText?.(item) ?? ""].join(" "));
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** Kararlı sıralama; eşitlikte katalog sırası. */
export function sortStoreItems<T extends { name: string; finalPrice: number }>(items: readonly T[], sort: StoreSort | null, locale = "tr"): T[] {
  if (!sort) return [...items];
  const indexed = items.map((item, index) => ({ item, index }));
  const compare = (a: T, b: T) =>
    sort === "price-asc" ? a.finalPrice - b.finalPrice : sort === "price-desc" ? b.finalPrice - a.finalPrice : a.name.localeCompare(b.name, locale);
  return indexed.sort((a, b) => compare(a.item, b.item) || a.index - b.index).map((x) => x.item);
}
