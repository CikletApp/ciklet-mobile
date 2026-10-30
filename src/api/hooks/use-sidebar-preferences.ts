import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { SidebarPreferences } from "../types";

/**
 * Sunucu başına kişisel kenar çubuğu tercihleri — "Kanallara Göz At"
 * (takip edilmeyen kanallar listeden kalkar) ve "Sessize alınan kanalları
 * gizle". Sunucuda kalıcı, web ile eşit: başka cihazdaki değişiklik
 * `self.sync` (topic=sidebar) ile bu sorguyu geçersizler.
 */
export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = { hideMutedChannels: false, hiddenChannelIds: [] };

export function useSidebarPreferences(serverId: string | undefined) {
  const signedIn = useAuth((s) => s.status === "signedIn");
  return useQuery({
    queryKey: qk.sidebarPreferences(serverId ?? ""),
    enabled: signedIn && Boolean(serverId),
    queryFn: () => api<SidebarPreferences>(endpoints.sidebarPreferences(serverId as string)),
    staleTime: 5 * 60_000,
  });
}

export type SidebarPreferencesPatch = {
  hideMutedChannels?: boolean;
  follow?: { channelIds: string[]; followed: boolean };
};

/** Web lib/sidebar-preferences applySidebarPatch ile aynı birleştirme. */
export function applySidebarPatch(current: SidebarPreferences, patch: SidebarPreferencesPatch): SidebarPreferences {
  const hidden = new Set(current.hiddenChannelIds);
  if (patch.follow) {
    for (const id of patch.follow.channelIds) {
      if (patch.follow.followed) hidden.delete(id);
      else hidden.add(id);
    }
  }
  return {
    hideMutedChannels: patch.hideMutedChannels ?? current.hideMutedChannels,
    hiddenChannelIds: [...hidden],
  };
}

/** İyimser yazım; hata olursa sunucudan yeniden çekilir. */
export function useUpdateSidebarPreferences(serverId: string | undefined) {
  const queryClient = useQueryClient();
  const key = qk.sidebarPreferences(serverId ?? "");
  return useMutation({
    mutationFn: (patch: SidebarPreferencesPatch) =>
      api<SidebarPreferences>(endpoints.sidebarPreferences(serverId as string), { method: "PATCH", body: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SidebarPreferences>(key);
      queryClient.setQueryData<SidebarPreferences>(key, applySidebarPatch(previous ?? DEFAULT_SIDEBAR_PREFERENCES, patch));
      return { previous };
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
  });
}

/**
 * Kanal listede görünsün mü (web isChannelShownInSidebar ile aynı kural):
 * takipten çıkarılmış kanal gizli; "sessizleri gizle" açıksa KANAL düzeyinde
 * susturulmuş kanal da gizli.
 */
export function isChannelShownInSidebar(params: {
  channelId: string;
  prefs: SidebarPreferences;
  hiddenSet?: ReadonlySet<string>;
  muted: boolean;
}): boolean {
  const hidden = params.hiddenSet ?? new Set(params.prefs.hiddenChannelIds);
  if (hidden.has(params.channelId)) return false;
  if (params.prefs.hideMutedChannels && params.muted) return false;
  return true;
}
