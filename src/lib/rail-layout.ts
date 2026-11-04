/**
 * Sunucu şeridinin (sol ray) düzeni — SAF veri ve işlemler.
 *
 * İstemci (iyimser güncelleme) ve sunucu (`PUT /api/sidebar/layout`) aynı
 * fonksiyonları kullanır: istemcinin bıraktığı karede çizdiği düzen,
 * sunucunun yazacağı düzenle birebir aynı olsun diye.
 *
 * MOBİL KOPYA: ciklet-web `src/lib/sidebar-layout.ts` ile birebir aynı
 * işlemler (yalnızca zod şeması yok — doğrulama sunucuda). Biri değişirse
 * diğeri de değişmeli.
 *
 * Model Discord'unkiyle aynı: kök liste sunucu ve klasörlerden oluşur;
 * klasör yalnızca sunucu içerir (iç içe klasör yok). İki sunucudan az
 * kalan klasör çözülür: tek kalan sunucu klasörün yerine geçer.
 */

export type RailLayoutItem =
  | { type: "server"; id: string }
  | { type: "folder"; id: string; serverIds: string[] };

export type RailLayout = RailLayoutItem[];

/** Bırakma hedefi: kökte bir sıra ya da bir klasörün içinde bir sıra. */
export type RailDropTarget =
  | { kind: "root"; index: number }
  | { kind: "folder"; folderId: string; index: number }
  /** Bir sunucunun üstüne bırakıldı: ikisinden yeni klasör. */
  | { kind: "combine"; serverId: string; newFolderId: string };

export const MAX_RAIL_ITEMS = 500;

/** Düzendeki bütün sunucu kimlikleri, yukarıdan aşağıya. */
export function railServerIds(layout: RailLayout): string[] {
  return layout.flatMap((item) => (item.type === "server" ? [item.id] : item.serverIds));
}

/** Bir kimlik birden fazla yerde geçiyor mu? (yinelenen istek reddedilir) */
export function hasDuplicateIds(layout: RailLayout): boolean {
  const seen = new Set<string>();
  for (const item of layout) {
    const ids = item.type === "server" ? [item.id] : [`folder:${item.id}`, ...item.serverIds];
    for (const id of ids) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

/** İki sunucudan az kalan klasörleri çözer; boş klasörü atar. */
export function normalizeLayout(layout: RailLayout): RailLayout {
  const out: RailLayout = [];
  for (const item of layout) {
    if (item.type === "server") {
      out.push(item);
    } else if (item.serverIds.length >= 2) {
      out.push(item);
    } else if (item.serverIds.length === 1) {
      out.push({ type: "server", id: item.serverIds[0] });
    }
  }
  return out;
}

export function layoutsEqual(a: RailLayout, b: RailLayout): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.type !== y.type || x.id !== y.id) return false;
    if (x.type === "folder" && y.type === "folder") {
      if (x.serverIds.length !== y.serverIds.length) return false;
      if (x.serverIds.some((id, j) => id !== y.serverIds[j])) return false;
    }
  }
  return true;
}

/** Sunucunun bulunduğu klasör (yoksa null). */
export function folderOf(layout: RailLayout, serverId: string): string | null {
  for (const item of layout) {
    if (item.type === "folder" && item.serverIds.includes(serverId)) return item.id;
  }
  return null;
}

/**
 * Bir sunucuyu düzenden çıkarır. Klasörü tek sunucuya düşse bile ÇÖZMEZ —
 * çözme en sonda `normalizeLayout` ile yapılır ki hedef sıraları kaymasın.
 */
function withoutServer(layout: RailLayout, serverId: string): RailLayout {
  return layout
    .filter((item) => !(item.type === "server" && item.id === serverId))
    .map((item) =>
      item.type === "folder" && item.serverIds.includes(serverId)
        ? { ...item, serverIds: item.serverIds.filter((id) => id !== serverId) }
        : item,
    );
}

/**
 * Sürüklenen öğeyi hedefe taşır.
 *
 * `dragKey`: sunucu için sunucu kimliği, klasör için `folder:<id>`.
 * Hedef sıraları sürüklenen öğe HENÜZ YERİNDEYKEN hesaplanmış kabul edilir
 * (arayüzün gördüğü düzen); çıkarma kaymasını burada düzeltiriz.
 */
export function applyDrop(layout: RailLayout, dragKey: string, target: RailDropTarget): RailLayout {
  if (dragKey.startsWith("folder:")) {
    const folderId = dragKey.slice("folder:".length);
    // Klasör yalnızca kökte yer değiştirir (iç içe klasör yok).
    if (target.kind !== "root") return layout;
    const from = layout.findIndex((item) => item.type === "folder" && item.id === folderId);
    if (from === -1) return layout;
    const next = [...layout];
    const [moved] = next.splice(from, 1);
    const index = target.index > from ? target.index - 1 : target.index;
    next.splice(Math.max(0, Math.min(index, next.length)), 0, moved);
    return normalizeLayout(next);
  }

  const serverId = dragKey;
  if (!railServerIds(layout).includes(serverId)) return layout;

  if (target.kind === "combine") {
    if (target.serverId === serverId) return layout;
    const next = withoutServer(layout, serverId);
    // Hedef kökte bir sunucuysa yeni klasör; klasör içindeyse o klasöre ekle.
    const rootIndex = next.findIndex((item) => item.type === "server" && item.id === target.serverId);
    if (rootIndex !== -1) {
      next[rootIndex] = { type: "folder", id: target.newFolderId, serverIds: [target.serverId, serverId] };
      return normalizeLayout(next);
    }
    const folder = folderOf(next, target.serverId);
    if (!folder) return layout;
    return applyDrop(layout, serverId, { kind: "folder", folderId: folder, index: Number.MAX_SAFE_INTEGER });
  }

  if (target.kind === "root") {
    const from = layout.findIndex((item) => item.type === "server" && item.id === serverId);
    const next = withoutServer(layout, serverId);
    let index = target.index;
    if (from !== -1 && from < index) index -= 1;
    next.splice(Math.max(0, Math.min(index, next.length)), 0, { type: "server", id: serverId });
    return normalizeLayout(next);
  }

  // target.kind === "folder"
  const sourceFolder = folderOf(layout, serverId);
  let index = target.index;
  if (sourceFolder === target.folderId) {
    const folder = layout.find((item) => item.type === "folder" && item.id === target.folderId);
    const from = folder && folder.type === "folder" ? folder.serverIds.indexOf(serverId) : -1;
    if (from !== -1 && from < index) index -= 1;
  }
  const next = withoutServer(layout, serverId).map((item) => {
    if (item.type !== "folder" || item.id !== target.folderId) return item;
    const ids = [...item.serverIds];
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, serverId);
    return { ...item, serverIds: ids };
  });
  return normalizeLayout(next);
}

/** Sunucuyu klasöründen çıkarıp klasörün hemen altına koyar (Discord). */
export function removeFromFolder(layout: RailLayout, serverId: string): RailLayout {
  const folderId = folderOf(layout, serverId);
  if (!folderId) return layout;
  const folderIndex = layout.findIndex((item) => item.type === "folder" && item.id === folderId);
  return applyDrop(layout, serverId, { kind: "root", index: folderIndex + 1 });
}

/** Kök öğeyi bir adım (ya da en başa/sona) taşır — klavye ve "Şuraya taşı". */
export function moveRootBy(
  layout: RailLayout,
  dragKey: string,
  where: "up" | "down" | "top" | "bottom",
): RailLayout {
  const index = layout.findIndex((item) =>
    dragKey.startsWith("folder:")
      ? item.type === "folder" && `folder:${item.id}` === dragKey
      : item.type === "server" && item.id === dragKey,
  );
  if (index === -1) return layout;
  const target =
    where === "top" ? 0 : where === "bottom" ? layout.length : where === "up" ? Math.max(0, index - 1) : index + 2;
  return applyDrop(layout, dragKey, { kind: "root", index: target });
}
