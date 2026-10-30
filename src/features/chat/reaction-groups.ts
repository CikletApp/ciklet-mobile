/**
 * Tepki satırlarını çip gruplarına ayırır: (emoji, süper mi) başına bir grup.
 * Discord gibi süper tepkiler normal tepkilerden ÖNCE gelir; her türün içinde
 * ilk görülme sırası korunur. Web'deki aynısı: ciklet-web/src/lib/reaction-groups.ts.
 */
export interface ReactionRowLike {
  emoji: string;
  profileId: string;
  burst?: boolean;
  burstColors?: string[];
}

export interface ReactionGroup {
  key: string;
  emoji: string;
  burst: boolean;
  burstColors: string[];
  count: number;
  /** İzleyen kişi bu grupta tepki vermiş mi. */
  mine: boolean;
}

export function groupReactions(rows: readonly ReactionRowLike[] | undefined, viewerId?: string): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const row of rows ?? []) {
    const burst = row.burst === true;
    const key = `${burst ? "burst" : "normal"}:${row.emoji}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, emoji: row.emoji, burst, burstColors: [], count: 0, mine: false };
      groups.set(key, group);
    }
    group.count += 1;
    if (burst && group.burstColors.length === 0 && row.burstColors?.length) group.burstColors = row.burstColors;
    if (viewerId && row.profileId === viewerId) group.mine = true;
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.burst), ...all.filter((g) => !g.burst)];
}

/** Satır süper tepki mi — SDK tipi `burst` alanını bilmiyor. */
export function isBurstRow(row: unknown): boolean {
  return Boolean(row && typeof row === "object" && (row as { burst?: unknown }).burst === true);
}
