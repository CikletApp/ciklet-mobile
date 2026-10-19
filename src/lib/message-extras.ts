/**
 * Web'in yeni mesaj alanlarının okuyucuları (ciklet-web lib/multi-attachments,
 * lib/stickers, lib/polls, lib/sensitive-media). Yalnızca okuma; kurallar
 * sunucuda.
 */

export interface ExtraAttachment {
  url: string;
  name?: string;
  type?: string;
  size?: number;
}

/** `metadata.attachments`'ın ilki dışındakiler (ilki zaten `fileUrl`). */
export function extraAttachments(metadata: unknown, fileUrl: string | null | undefined): ExtraAttachment[] {
  if (!metadata || typeof metadata !== "object" || !fileUrl) return [];
  const list = (metadata as { attachments?: unknown }).attachments;
  if (!Array.isArray(list)) return [];
  const entries: ExtraAttachment[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.url !== "string" || !/^https:\/\//.test(r.url)) continue;
    entries.push({
      url: r.url,
      ...(typeof r.name === "string" ? { name: r.name } : {}),
      ...(typeof r.type === "string" ? { type: r.type } : {}),
      ...(typeof r.size === "number" ? { size: r.size } : {}),
    });
  }
  if (entries.length < 2 || entries[0].url !== fileUrl) return [];
  return entries.slice(1, 10);
}

export interface StickerMeta {
  id: string;
  name: string;
  imageUrl: string;
}

export function readSticker(metadata: unknown): StickerMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const s = (metadata as { sticker?: unknown }).sticker;
  if (!s || typeof s !== "object") return null;
  const { id, name, imageUrl } = s as Record<string, unknown>;
  if (typeof id !== "string" || typeof name !== "string" || typeof imageUrl !== "string") return null;
  if (!/^https:\/\//.test(imageUrl)) return null;
  return { id, name, imageUrl };
}

export function isSensitive(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as { sensitive?: unknown }).sensitive === true);
}

export function isSpoilerName(name: string | null | undefined): boolean {
  return typeof name === "string" && name.toUpperCase().startsWith("SPOILER_");
}

export interface PollOption {
  id: string;
  text: string;
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiple: boolean;
  expiresAt: string | null;
  votes: Record<string, string[]>;
}

export function readPoll(metadata: unknown): Poll | null {
  if (!metadata || typeof metadata !== "object") return null;
  const p = (metadata as { poll?: unknown }).poll;
  if (!p || typeof p !== "object") return null;
  const r = p as Record<string, unknown>;
  if (typeof r.question !== "string" || !Array.isArray(r.options)) return null;
  const options = r.options
    .filter((o): o is { id: string; text: string } => !!o && typeof o === "object" && typeof (o as PollOption).id === "string" && typeof (o as PollOption).text === "string")
    .map((o) => ({ id: o.id, text: o.text }));
  const votes: Record<string, string[]> = {};
  if (r.votes && typeof r.votes === "object") {
    for (const [k, v] of Object.entries(r.votes as Record<string, unknown>)) {
      if (Array.isArray(v)) votes[k] = v.filter((x): x is string => typeof x === "string");
    }
  }
  return {
    question: r.question,
    options,
    multiple: r.multiple === true,
    expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    votes,
  };
}

export function pollClosed(poll: Poll, now = Date.now()): boolean {
  return poll.expiresAt !== null && new Date(poll.expiresAt).getTime() <= now;
}
