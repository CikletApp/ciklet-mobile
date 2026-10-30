import { useQuery } from "@tanstack/react-query";
import { MemberRole } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useMyPermissions } from "@/api/hooks";

/**
 * Sohbetin sunucuya özgü varlıkları — ciklet-web `use-server-roles`,
 * `use-server-emojis`, `use-server-stickers` önbelleklerinin karşılığı.
 * Sunucu başına bir kez çekilir, 5 dk taze sayılır. Hata "boş liste"
 * demektir: pil `@silinmiş-rol`, emoji `:ad:` metnine düşer, mesaj okunur.
 */

const STALE_MS = 5 * 60 * 1000;

export interface ServerRoleLite {
  id: string;
  name: string;
  color: string | null;
  position: number;
  /** Herkes bahsedebilir mi (web Role.mentionable) — öneriler bunu süzer. */
  mentionable: boolean;
}

export interface ServerEmojiLite {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ServerStickerLite {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
}

const EMPTY: never[] = [];

async function list<T>(path: string, pick: (raw: Record<string, unknown>) => T | null): Promise<T[]> {
  try {
    const data = await api<unknown>(path);
    if (!Array.isArray(data)) return [];
    return data.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = pick(raw as Record<string, unknown>);
      return item ? [item] : [];
    });
  } catch {
    return [];
  }
}

const str = (value: unknown) => (typeof value === "string" ? value : null);

export function useServerRoles(serverId: string | undefined): ServerRoleLite[] {
  const query = useQuery({
    queryKey: ["server-roles", serverId],
    enabled: Boolean(serverId),
    staleTime: STALE_MS,
    queryFn: () =>
      list(endpoints.serverRoles(serverId ?? ""), (r) => {
        const id = str(r.id);
        const name = str(r.name);
        if (!id || !name) return null;
        return {
          id,
          name,
          color: str(r.color),
          position: typeof r.position === "number" ? r.position : 0,
          mentionable: r.mentionable === true,
        };
      }),
  });
  return query.data ?? EMPTY;
}

export function useServerEmojis(serverId: string | undefined): ServerEmojiLite[] {
  const query = useQuery({
    queryKey: ["server-emojis", serverId],
    enabled: Boolean(serverId),
    staleTime: STALE_MS,
    queryFn: () =>
      list(endpoints.serverEmojis(serverId ?? ""), (r) => {
        const id = str(r.id);
        const name = str(r.name);
        const imageUrl = str(r.imageUrl);
        return id && name && imageUrl && /^https:\/\//.test(imageUrl) ? { id, name, imageUrl } : null;
      }),
  });
  return query.data ?? EMPTY;
}

export function useServerStickers(serverId: string | undefined) {
  return useQuery({
    queryKey: ["server-stickers", serverId],
    enabled: Boolean(serverId),
    staleTime: STALE_MS,
    queryFn: () =>
      list<ServerStickerLite>(endpoints.serverStickers(serverId ?? ""), (r) => {
        const id = str(r.id);
        const name = str(r.name);
        const imageUrl = str(r.imageUrl);
        return id && name && imageUrl ? { id, name, description: str(r.description), imageUrl } : null;
      }),
  });
}

/**
 * @herkes / @burada / rol önerileri gösterilsin mi — web'deki
 * `canMentionEveryone` (moderatör+ ya da MENTION_EVERYONE biti). Kanal
 * geçersiz kılmaları burada görünmez; sunucu yine denetler (izin yoksa
 * metin kalır, bildirim gitmez).
 */
export function useCanMentionEveryone(serverId: string | undefined): boolean {
  // Tek izin önbelleği (`qk.myPermissions`): moderasyon ve ses ekranlarıyla
  // aynı sorgu, aynı tazeleme.
  const { data } = useMyPermissions(serverId);
  if (!data) return false;
  return (
    Boolean(data.isOwner) ||
    data.memberRole === MemberRole.ADMIN ||
    data.memberRole === MemberRole.MODERATOR ||
    data.keys.includes("MENTION_EVERYONE") ||
    data.keys.includes("ADMINISTRATOR")
  );
}
