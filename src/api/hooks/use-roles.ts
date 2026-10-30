import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";

/**
 * Sunucu rolleri — web Sunucu Ayarları › Roller sekmesinin mobil karşılığı
 * (`GET/PATCH /api/servers/:id/roles`). Yetki "Rolleri Yönet"; uç ayrıca
 * rol hiyerarşisini denetler (kendi en yüksek rolünün üstü düzenlenemez).
 */
export interface ServerRoleDetails {
  id: string;
  name: string;
  color: string | null;
  hoist: boolean;
  position: number;
  /** İzin bitleri (BigInt, ondalık dizge). Mobilde düzenlenmiyor. */
  permissions: string;
  /** Rol simgesi: yüklenmiş görsel YA DA unicode emoji (biri dolu). */
  iconUrl: string | null;
  iconEmoji: string | null;
  /** Herkes bahsedebilir mi (Discord "mentionable"). */
  mentionable: boolean;
  /**
   * Yönetilen "Server Booster" rolü (lib/server-boost): takviye verir/alır;
   * elle atanamaz (403 managed_role), silinemez (409). Eski sunucuda yok.
   */
  premiumSubscriber?: boolean;
  _count?: { members: number };
}

export type RoleUpdate = Partial<Pick<ServerRoleDetails, "name" | "color" | "hoist" | "iconUrl" | "iconEmoji" | "mentionable">>;

const rolesKey = (serverId: string) => ["server-roles-details", serverId] as const;

export function useServerRoleDetails(serverId: string | undefined) {
  return useQuery({
    queryKey: rolesKey(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: async () => {
      const data = await api<ServerRoleDetails[]>(endpoints.serverRoles(serverId!));
      return (Array.isArray(data) ? data : [])
        .map((role) => ({
          ...role,
          iconUrl: role.iconUrl ?? null,
          iconEmoji: role.iconEmoji ?? null,
          mentionable: role.mentionable === true,
        }))
        .sort((a, b) => b.position - a.position);
    },
    staleTime: 30_000,
  });
}

export function useUpdateRole(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: RoleUpdate }) =>
      api<ServerRoleDetails>(endpoints.serverRole(serverId, roleId), { method: "PATCH", body: input }),
    onSuccess: (role) => {
      queryClient.setQueryData<ServerRoleDetails[]>(rolesKey(serverId), (list) =>
        list?.map((item) =>
          item.id === role.id
            ? { ...item, ...role, iconUrl: role.iconUrl ?? null, iconEmoji: role.iconEmoji ?? null, mentionable: role.mentionable === true }
            : item
        )
      );
      // Sohbetin rol önbelleği (pil, bahsetme önerileri) ve üye listesi tazelensin.
      void queryClient.invalidateQueries({ queryKey: ["server-roles", serverId] });
    },
  });
}
