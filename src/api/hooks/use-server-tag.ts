import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MyServerTagResponse, ServerDetails } from "../types";

/**
 * Sunucu etiketi (ciklet-web lib/server-tag; Discord "Server Tag").
 * Anahtar burada tanımlı: query-keys ortak dosyasına dokunmadan aynı
 * önbelleği profil seçicisi ve sunucu menüsü okur.
 */
export const myServerTagKey = ["server-tag", "me"] as const;

/** Kendi etiketin + seçebileceğin sunucular (GET /api/profile/server-tag). */
export function useMyServerTag(enabled = true) {
  return useQuery({
    queryKey: myServerTagKey,
    enabled,
    staleTime: 30_000,
    queryFn: () => api<MyServerTagResponse>(endpoints.profileServerTag),
  });
}

/** `serverId` o sunucunun etiketini seçer; `null` kaldırır ("Yok"). */
export function useSetMyServerTag() {
  const queryClient = useQueryClient();
  const myId = useAuth((s) => s.profile?.id);
  return useMutation({
    mutationFn: (serverId: string | null) =>
      serverId
        ? api(endpoints.profileServerTag, { method: "PUT", body: { serverId } })
        : api(endpoints.profileServerTag, { method: "DELETE" }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myServerTagKey });
      if (myId) void queryClient.invalidateQueries({ queryKey: qk.profileCard(myId) });
    },
  });
}

export interface ServerTagInput {
  tag: string | null;
  tagBadge: string | null;
  tagEnabled: boolean;
}

/** Sunucu etiketini düzenler (PATCH /api/servers/[id]; "Sunucuyu Yönet"). */
export function useUpdateServerTag(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServerTagInput) =>
      api<ServerDetails>(endpoints.server(serverId), { method: "PATCH", body: input }),
    onSuccess: (server) => {
      queryClient.setQueryData<ServerDetails>(qk.server(serverId), (current) =>
        current ? { ...current, tag: server.tag, tagBadge: server.tagBadge, tagEnabled: server.tagEnabled } : server
      );
      void queryClient.invalidateQueries({ queryKey: myServerTagKey });
    },
  });
}
