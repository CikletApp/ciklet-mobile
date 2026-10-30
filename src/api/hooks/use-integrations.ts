import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";

/**
 * Sunucu Ayarları › Entegrasyonlar — web `integrations-tab.tsx`,
 * `webhooks-section.tsx` ve `linked-roles-section.tsx` verisi; ayrıca
 * Profil › Bağlantılar'daki Twitch/Kick durumu (bağlantılı rollerin üye
 * tarafı). Yetkiyi uçlar denetler: botlar "Sunucuyu Yönet", webhook'lar
 * "Webhook'ları Yönet", bağlantılı roller yalnızca sunucu sahibi.
 */

// ── Kurulu botlar ──────────────────────────────────────────────────

export interface ServerIntegration {
  id: string;
  botId: string;
  createdAt: string;
  profile: { username: string; name: string | null; imageUrl: string | null } | null;
}

const integrationsKey = (serverId: string) => ["server-integrations", serverId] as const;

export function useServerIntegrations(serverId: string | undefined) {
  return useQuery({
    queryKey: integrationsKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<ServerIntegration[]>(endpoints.serverIntegrations(serverId!));
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useRemoveIntegration(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) => api(endpoints.serverIntegration(serverId, botId), { method: "DELETE" }),
    onSuccess: (_data, botId) => {
      queryClient.setQueryData<ServerIntegration[]>(integrationsKey(serverId), (list) => list?.filter((item) => item.botId !== botId));
    },
  });
}

// ── Gelen webhook'lar ──────────────────────────────────────────────

/** Web lib/webhook-limits. */
export const MAX_WEBHOOKS_PER_SERVER = 50;
export const WEBHOOK_NAME_MAX = 80;

export interface ServerWebhook {
  id: string;
  name: string;
  avatarUrl: string | null;
  channelId: string;
  channelName: string;
  createdAt: string;
}

export interface ServerWebhooks {
  webhooks: ServerWebhook[];
  /** Webhook bağlanabilen metin kanalları (alt başlık değil). */
  channels: { id: string; name: string }[];
}

const webhooksKey = (serverId: string) => ["server-webhooks", serverId] as const;

export function useServerWebhooks(serverId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: webhooksKey(serverId ?? "yok"),
    enabled: Boolean(serverId) && enabled,
    queryFn: () => api<ServerWebhooks>(endpoints.serverWebhooks(serverId!)),
  });
}

export function useCreateWebhook(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; channelId: string }) =>
      api<Omit<ServerWebhook, "channelName"> & { url: string }>(endpoints.serverWebhooks(serverId), { method: "POST", body: input }),
    onSuccess: (created) => {
      queryClient.setQueryData<ServerWebhooks>(webhooksKey(serverId), (data) => {
        if (!data) return data;
        const channel = data.channels.find((c) => c.id === created.channelId);
        const { url: _url, ...row } = created;
        return { ...data, webhooks: [...data.webhooks, { ...row, channelName: channel?.name ?? "" }] };
      });
    },
  });
}

export function useUpdateWebhook(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, input }: { webhookId: string; input: { name?: string; channelId?: string; avatarUrl?: string | null } }) =>
      api<{ id: string; name: string; avatarUrl: string | null; channelId: string }>(endpoints.serverWebhook(serverId, webhookId), {
        method: "PATCH",
        body: input,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<ServerWebhooks>(webhooksKey(serverId), (data) => {
        if (!data) return data;
        const channel = data.channels.find((c) => c.id === updated.channelId);
        return {
          ...data,
          webhooks: data.webhooks.map((w) =>
            w.id === updated.id ? { ...w, ...updated, channelName: channel?.name ?? w.channelName } : w
          ),
        };
      });
    },
  });
}

/** Token'ı yeniler; eski URL anında geçersiz olur. Yeni URL yalnızca bu yanıtta. */
export function useRotateWebhook(serverId: string) {
  return useMutation({
    mutationFn: (webhookId: string) => api<{ id: string; url: string }>(endpoints.serverWebhook(serverId, webhookId), { method: "POST" }),
  });
}

export function useDeleteWebhook(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => api(endpoints.serverWebhook(serverId, webhookId), { method: "DELETE" }),
    onSuccess: (_data, webhookId) => {
      queryClient.setQueryData<ServerWebhooks>(webhooksKey(serverId), (data) =>
        data ? { ...data, webhooks: data.webhooks.filter((w) => w.id !== webhookId) } : data
      );
    },
  });
}

// ── Bağlantılı roller (Twitch / Kick) ──────────────────────────────

export type StreamingPlatform = "twitch" | "kick";
export const STREAMING_PLATFORMS: readonly StreamingPlatform[] = ["twitch", "kick"];
/** Web lib/streaming/activity. */
export const PLATFORM_LABELS: Record<StreamingPlatform, string> = { twitch: "Twitch", kick: "Kick" };
export const PLATFORM_COLORS: Record<StreamingPlatform, string> = { twitch: "#9146ff", kick: "#53fc18" };

export type LinkedRoleRequirement = "subscriber" | "follower";

export interface LinkedRoleView {
  id: string;
  platform: StreamingPlatform;
  requirement: LinkedRoleRequirement;
  lastSyncedAt: string | null;
  role: { id: string; name: string; color: string | null };
  grantedCount: number;
}

export interface LinkedRolesResponse {
  owner: boolean;
  broadcaster: Record<StreamingPlatform, boolean>;
  items: LinkedRoleView[];
}

const linkedRolesKey = (serverId: string) => ["server-linked-roles", serverId] as const;

export function useLinkedRoles(serverId: string | undefined) {
  return useQuery({
    queryKey: linkedRolesKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async (): Promise<LinkedRolesResponse> => {
      try {
        return await api<LinkedRolesResponse>(endpoints.serverLinkedRoles(serverId!));
      } catch {
        // Web ile aynı: hata sahip değilmiş gibi gösterilir.
        return { owner: false, broadcaster: { twitch: false, kick: false }, items: [] };
      }
    },
  });
}

export function useCreateLinkedRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleId: string; platform: StreamingPlatform; requirement: LinkedRoleRequirement }) =>
      api<{ id: string }>(endpoints.serverLinkedRoles(serverId), { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: linkedRolesKey(serverId) }),
  });
}

export function useDeleteLinkedRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkedRoleId: string) => api(endpoints.serverLinkedRole(serverId, linkedRoleId), { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: linkedRolesKey(serverId) }),
  });
}

// ── Twitch / Kick hesap bağlantısı (üye tarafı) ─────────────────────

export interface StreamingConnectionStatus {
  configured: boolean;
  linked: boolean;
  handle: string | null;
  broadcaster: boolean;
  live: boolean;
  viewers: number | null;
}

const streamingKey = (platform: StreamingPlatform) => ["streaming-connection", platform] as const;

export function useStreamingConnection(platform: StreamingPlatform) {
  return useQuery({
    queryKey: streamingKey(platform),
    queryFn: () => api<StreamingConnectionStatus>(endpoints.streamingConnection(platform)),
  });
}

export function useUnlinkStreaming(platform: StreamingPlatform) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(endpoints.streamingConnection(platform), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<StreamingConnectionStatus>(streamingKey(platform), (status) =>
        status ? { ...status, linked: false, handle: null, broadcaster: false, live: false, viewers: null } : status
      );
    },
  });
}
