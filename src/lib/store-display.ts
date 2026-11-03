import { findDecoration } from "@/lib/avatar-decorations";
import { findNameplate, findProfileEffect } from "@/lib/profile-effects";

/**
 * Mağaza vitrini yardımcıları (web lib/store-pricing + store-view ile aynı
 * kurallar). Katalog veritabanında (web root → Mağaza Yönetimi); burada
 * yalnızca gösterim: çizimi uygulamada olan ürünler, öne çıkanlar,
 * koleksiyon grupları ve geri sayım metni.
 */

/**
 * Ürünün çizimi bu uygulama sürümünde var mı? Yeni bir kozmetik tasarımı
 * web'e eklendiğinde eski mobil sürüm onu çizemez; boş kart göstermek
 * yerine listelenmez (yeni mağaza sürümüyle gelir).
 */
export function hasMobileRenderer(kind: string, id: string): boolean {
  if (kind === "decoration") return Boolean(findDecoration(id)?.store);
  if (kind === "nameplate") return findNameplate(id) !== null;
  if (kind === "effect") return findProfileEffect(id)?.tier === "store";
  return false;
}

/** Kalan süre (web formatCountdown ile aynı): "2g 4sa", "3sa 12dk", "45dk", "30sn". */
export function formatCountdown(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}g ${h}sa`;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk`;
  return `${s}sn`;
}

export interface CollectionGroup<T> {
  id: string | null;
  title: string | null;
  items: T[];
}

/**
 * Koleksiyonlara göre grupla: sunucunun verdiği koleksiyon sırası (root),
 * koleksiyonsuz/bilinmeyen ürünler en sonda tek grup ("Diğer"). Grup içi
 * sıra korunur; boş grup atlanır.
 */
export function groupByCollection<T extends { collection?: string | null }>(
  items: readonly T[],
  collections: readonly { id: string; name: string }[] | undefined,
): CollectionGroup<T>[] {
  if (!collections || collections.length === 0) return items.length ? [{ id: null, title: null, items: [...items] }] : [];
  const known = new Set(collections.map((c) => c.id));
  const groups: CollectionGroup<T>[] = collections
    .map((c) => ({ id: c.id, title: c.name, items: items.filter((i) => i.collection === c.id) }))
    .filter((g) => g.items.length > 0);
  const rest = items.filter((i) => !i.collection || !known.has(i.collection));
  if (rest.length) groups.push({ id: null, title: "Diğer", items: rest });
  return groups;
}
