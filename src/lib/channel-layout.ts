/**
 * Kanal yerleşimi — kategoriler ve kanal sıralaması (Discord modeli).
 * ciklet-web `lib/channel-layout.ts` ile aynı kurallar:
 *
 *  • Kategorisiz kanallar listenin EN ÜSTÜNDE, başlıksız durur.
 *  • Kategoriler `position` sırasıyla dizilir.
 *  • Bir kova içinde metin kanalları HER ZAMAN ses/görüntü kanallarının
 *    üstündedir; `position` yalnızca aynı gruptaki kanallar arasında anlamlı.
 *  • Eşit `position` oluşturulma anı, o da eşitse kimlikle çözülür.
 */

/** Kategori adı tavanı (Discord ile aynı). */
export const CATEGORY_NAME_MAX_LENGTH = 100;

export interface LayoutChannel {
  id: string;
  type: string;
  categoryId?: string | null;
  position?: number;
  createdAt?: string | Date;
}

export interface LayoutCategory {
  id: string;
  name: string;
  position: number;
  createdAt: string;
}

const time = (value: string | Date | undefined) =>
  value === undefined ? 0 : typeof value === "string" ? Date.parse(value) : value.getTime();

/** Metin = 0, ses/görüntü = 1. */
export function channelGroup(type: string): 0 | 1 {
  return type === "TEXT" ? 0 : 1;
}

/** position → oluşturulma → kimlik. */
export function compareByPosition(
  a: { id: string; position?: number; createdAt?: string | Date },
  b: { id: string; position?: number; createdAt?: string | Date }
): number {
  return (
    (a.position ?? 0) - (b.position ?? 0) ||
    time(a.createdAt) - time(b.createdAt) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function compareChannelsInBucket(a: LayoutChannel, b: LayoutChannel): number {
  return channelGroup(a.type) - channelGroup(b.type) || compareByPosition(a, b);
}

export interface ChannelTree<C extends LayoutChannel, K extends LayoutCategory> {
  uncategorized: C[];
  categories: { category: K; channels: C[] }[];
}

/** Var olmayan kategoriye bağlı kanal kaybolmaz, kategorisiz alana düşer. */
export function buildChannelTree<C extends LayoutChannel, K extends LayoutCategory>(
  channels: readonly C[],
  categories: readonly K[]
): ChannelTree<C, K> {
  const sorted = [...categories].sort(compareByPosition);
  const buckets = new Map<string, C[]>(sorted.map((c) => [c.id, []]));
  const uncategorized: C[] = [];
  for (const channel of channels) {
    const bucket = channel.categoryId ? buckets.get(channel.categoryId) : undefined;
    (bucket ?? uncategorized).push(channel);
  }
  uncategorized.sort(compareChannelsInBucket);
  return {
    uncategorized,
    categories: sorted.map((category) => ({
      category,
      channels: (buckets.get(category.id) ?? []).sort(compareChannelsInBucket),
    })),
  };
}
