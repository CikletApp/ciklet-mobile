/**
 * Forum kanalı — ciklet-web `lib/forum.ts` istemci alt kümesi (aynı sınırlar
 * ve okuma kuralları). Etiket kuralları sunucuda zorlanır; burada yalnızca
 * seçenekler buna göre gösterilir.
 */
export const MAX_FORUM_TAGS = 20;
export const MAX_APPLIED_TAGS = 5;
export const FORUM_TAG_MAX = 24;

export type ForumSort = "activity" | "created";
export type ForumLayout = "list" | "gallery";

export interface ForumTag {
  id: string;
  name: string;
  /** Unicode emoji; yoksa null. */
  emoji: string | null;
  /** Yalnızca alt başlıkları yönetebilenler ekler/kaldırır. */
  moderated: boolean;
}

/** Kanal satırındaki `availableTags` JSON'u — bozuk girdiler düşer. */
export function parseForumTags(raw: unknown): ForumTag[] {
  if (!Array.isArray(raw)) return [];
  const out: ForumTag[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      emoji: typeof entry.emoji === "string" && entry.emoji.trim() ? entry.emoji.trim() : null,
      moderated: entry.moderated === true,
    });
    if (out.length >= MAX_FORUM_TAGS) break;
  }
  return out;
}

export function parseForumSort(raw: unknown): ForumSort {
  return raw === "created" ? "created" : "activity";
}

export function parseForumLayout(raw: unknown): ForumLayout {
  return raw === "gallery" ? "gallery" : "list";
}

/** Etiketin görünen adı: "emoji ad". */
export function forumTagLabel(tag: Pick<ForumTag, "name" | "emoji">): string {
  return tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name;
}
