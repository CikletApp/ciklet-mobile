import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { ServerDetails } from "../types";

/**
 * Sunucu Ayarları › Genel Görünüm'ün web'deki ek alanları
 * (`server-settings/overview-tab.tsx`): özel davet adresi (vanityCode,
 * yalnızca sahip, Takviye Seviye 3), davet arka planı (inviteSplashUrl,
 * Seviye 1) ve yaş sınırlı sunucu (nsfw). Hepsi `PATCH /api/servers/:id`.
 */

export type ServerOverviewExtras = ServerDetails & { inviteSplashUrl?: string | null };

export interface ServerOverviewPatch {
  vanityCode?: string;
  inviteSplashUrl?: string | null;
  nsfw?: boolean;
}

export function useUpdateServerOverview(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServerOverviewPatch) => api<ServerDetails>(endpoints.server(serverId), { method: "PATCH", body: input }),
    onSuccess: (server, input) => {
      queryClient.setQueryData(qk.server(serverId), server);
      if (input.nsfw !== undefined) queryClient.setQueryData(nsfwKey(serverId), input.nsfw);
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
    },
  });
}

const nsfwKey = (serverId: string) => ["server-nsfw", serverId] as const;

/**
 * Yaş sınırlı sunucu bayrağı — düz GET'te yok, `?moderation=1` yanıtında
 * (Sunucuyu Yönet kapısı). Eski sunucu sürümü alanı göndermezse `undefined`
 * döner; ekran anahtarı o zaman göstermez (yanlış "kapalı" göstermesin).
 */
export function useServerNsfw(serverId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: nsfwKey(serverId ?? "yok"),
    enabled: Boolean(serverId) && enabled,
    queryFn: async () => {
      const data = await api<{ nsfw?: unknown }>(endpoints.serverModeration(serverId!));
      return typeof data.nsfw === "boolean" ? data.nsfw : null;
    },
  });
}

/** Web `lib/vanity.ts` normalizeVanityCode ile birebir. */
export function normalizeVanityCode(raw: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u" };
  return raw
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
