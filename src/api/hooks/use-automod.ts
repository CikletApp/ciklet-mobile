import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sunucu Ayarları › Moderasyon — web `moderation-tab.tsx`'in verisi:
 * kural kabul ekranı, doğrulama seviyesi, baskın kilidi ve AutoMod
 * (`GET /api/servers/:id?moderation=1`, `PATCH /api/servers/:id`). Alanlar
 * yalnızca "Sunucuyu Yönet" yetkisine döner; uç PATCH'te aynı kapıyı ve
 * her alanın normalizasyonunu (lib/automod) yeniden uygular.
 */
export interface ServerModerationSettings {
  id: string;
  verificationLevel?: number;
  raidLockUntil?: string | null;
  blockedWords?: string[];
  rulesRequired?: boolean;
  rulesText?: string | null;
  automodMentionLimit?: number;
  automodLinkFilter?: boolean;
  automodAllowedDomains?: string[];
  automodTimeoutSeconds?: number;
  automodAlertChannelId?: string | null;
  automodRules?: unknown;
  /** AutoMod v2 (web lib/automod-rules): kaydedilmemişse eski ayarlardan türetilmiş liste. */
  automodRuleList?: unknown;
  automodRuleListLegacy?: boolean;
  safetyAlertsChannelId?: string | null;
  invitesPausedUntil?: string | null;
  dmsPausedUntil?: string | null;
  joinApplication?: unknown;
}

export interface ServerModerationUpdate {
  verificationLevel?: number;
  blockedWords?: string[];
  rulesRequired?: boolean;
  rulesText?: string | null;
  automodMentionLimit?: number;
  automodLinkFilter?: boolean;
  automodAllowedDomains?: string[];
  automodTimeoutSeconds?: number;
  automodAlertChannelId?: string | null;
  automodRules?: unknown;
  automodRuleList?: unknown;
  safetyAlertsChannelId?: string | null;
  joinApplication?: unknown;
  clearRaidLock?: true;
}

const moderationKey = (serverId: string) => ["server-moderation", serverId] as const;

export function useServerModeration(serverId: string | undefined) {
  return useQuery({
    queryKey: moderationKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerModerationSettings>(endpoints.serverModeration(serverId!)),
    // Taslak ilk yüklemeden kurulur; arka planda tazelenip üstüne yazmasın.
    staleTime: Infinity,
  });
}

export function useUpdateServerModeration(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServerModerationUpdate) =>
      api<ServerModerationSettings>(endpoints.server(serverId), { method: "PATCH", body: input }),
    onSuccess: (server) => {
      queryClient.setQueryData(moderationKey(serverId), server);
      void queryClient.invalidateQueries({ queryKey: qk.server(serverId) });
    },
  });
}
