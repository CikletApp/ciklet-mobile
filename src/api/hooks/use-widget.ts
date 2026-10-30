import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";

/**
 * Sunucu widget'ı — web Sunucu Ayarları › Widget sekmesinin mobil karşılığı
 * (ciklet-web lib/server/widget). Uç "Sunucuyu Yönet" ister. Adresler ve
 * gömme kodu sunucudan gelir; web ve mobil aynı metni gösterir.
 */
export interface ServerWidgetSettings {
  enabled: boolean;
  channel_id: string | null;
  server_id: string;
  json_url: string;
  widget_url: string;
  embed_html: string;
  invite_channels: { id: string; name: string; type: "TEXT" | "AUDIO" | "VIDEO" }[];
}

const widgetKey = (serverId: string) => ["server-widget", serverId] as const;

export function useServerWidget(serverId: string | undefined) {
  return useQuery({
    queryKey: widgetKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerWidgetSettings>(endpoints.serverWidget(serverId!)),
  });
}

export function useUpdateServerWidget(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { enabled?: boolean; channel_id?: string | null }) =>
      api<ServerWidgetSettings>(endpoints.serverWidget(serverId), { method: "PATCH", body: patch }),
    onSuccess: (settings) => {
      queryClient.setQueryData(widgetKey(serverId), settings);
    },
  });
}
