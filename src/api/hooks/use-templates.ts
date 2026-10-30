import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sunucu şablonları — web Sunucu Ayarları › Şablonlar sekmesi ve
 * `/sablon/[kod]` sayfasının mobil karşılığı (lib/server-templates).
 * Yönetim uçları "Sunucuyu Yönet" ister; önizleme ve şablondan kurulum
 * oturumu olan herkese açık.
 */

/** Web `lib/server-templates` sabitleri. */
export const MAX_TEMPLATES_PER_SERVER = 10;
export const TEMPLATE_NAME_MAX = 100;
export const TEMPLATE_DESCRIPTION_MAX = 240;

export interface TemplateSummary {
  categories: number;
  textChannels: number;
  voiceChannels: number;
  roles: number;
}

export interface ServerTemplateRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  usageCount: number;
  updatedAt: string;
  url: string;
  summary: TemplateSummary | null;
}

export interface TemplateView {
  code: string;
  name: string;
  description: string | null;
  usageCount: number;
  sourceServer: { name: string; imageUrl: string | null } | null;
  summary: TemplateSummary;
  channels: { name: string; type: "TEXT" | "AUDIO" | "VIDEO"; categoryIndex: number | null }[];
  categories: string[];
  roles: { name: string; color: string | null }[];
}

const templatesKey = (serverId: string) => ["server-templates", serverId] as const;

export function useServerTemplates(serverId: string | undefined) {
  return useQuery({
    queryKey: templatesKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<ServerTemplateRow[]>(endpoints.serverTemplates(serverId!));
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useCreateServerTemplate(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api<ServerTemplateRow>(endpoints.serverTemplates(serverId), { method: "POST", body: input }),
    onSuccess: (row) => {
      queryClient.setQueryData<ServerTemplateRow[]>(templatesKey(serverId), (list) => [...(list ?? []), row]);
    },
  });
}

/** "Güncelle": anlık görüntüyü sunucunun bugünkü hâline çeker. */
export function useSyncServerTemplate(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api<{ id: string; updatedAt: string }>(endpoints.serverTemplate(serverId, templateId), {
        method: "PATCH",
        body: { sync: true },
      }),
    onSuccess: (result, templateId) => {
      queryClient.setQueryData<ServerTemplateRow[]>(templatesKey(serverId), (list) =>
        list?.map((row) => (row.id === templateId ? { ...row, updatedAt: result.updatedAt } : row))
      );
    },
  });
}

export function useDeleteServerTemplate(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api(endpoints.serverTemplate(serverId, templateId), { method: "DELETE" }),
    onSuccess: (_result, templateId) => {
      queryClient.setQueryData<ServerTemplateRow[]>(templatesKey(serverId), (list) =>
        list?.filter((row) => row.id !== templateId)
      );
    },
  });
}

/** `/sablon/[kod]` önizlemesi. */
export function useTemplatePreview(code: string | undefined) {
  return useQuery({
    queryKey: ["template-preview", code ?? "yok"],
    enabled: Boolean(code),
    queryFn: () => api<TemplateView>(endpoints.template(code!)),
    retry: false,
  });
}

/** Şablondan yeni sunucu kur → `{ id }`. */
export function useCreateServerFromTemplate(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ id: string }>(endpoints.template(code), { method: "POST", body: { name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
    },
  });
}
