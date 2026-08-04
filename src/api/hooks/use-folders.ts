import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MembershipWithServer } from "../types";
import { useMyServers } from "./use-servers";

/**
 * Sunucu klasörleri.
 *
 * `GET /api/folders` ucu ciklet-web'de YOKTU — web bu veriyi bir sunucu
 * bileşeninde çekiyordu. Mobilin klasör adını ve rengini okuyabilmesi için
 * uç eklendi (ciklet-web `app/api/folders/route.ts`). Eski bir sunucu
 * sürümüne bağlanıldığında istek 405 döner; bu durumda klasörler yine
 * üyelik alanlarından kurulur, yalnızca ad/renk varsayılana düşer.
 */
export interface ServerFolder {
  id: string;
  name: string | null;
  color: string | null;
  order: number;
  members: { serverId: string; orderInFolder: number | null }[];
}

export function useFolders() {
  return useQuery({
    queryKey: qk.folders,
    queryFn: () => api<ServerFolder[]>(endpoints.folders),
    staleTime: 5 * 60_000,
    // Uç yoksa (eski sunucu) rayı bozmadan boş listeyle devam et.
    retry: false,
  });
}

/** Rayda çizilecek kök öğeler: klasörler ve klasörsüz sunucular, sırayla. */
export type RailItem =
  | { kind: "folder"; id: string; order: number; folder: ServerFolder; members: MembershipWithServer[] }
  | { kind: "server"; id: string; order: number; membership: MembershipWithServer };

export function useRailItems() {
  const { data: memberships, isLoading: membershipsLoading } = useMyServers();
  const { data: folders, isLoading: foldersLoading } = useFolders();

  const items = useMemo<RailItem[]>(() => {
    const all = memberships ?? [];
    const byId = new Map(all.map((m) => [m.serverId, m]));

    const folderItems: RailItem[] = (folders ?? []).map((folder) => ({
      kind: "folder" as const,
      id: folder.id,
      order: folder.order,
      folder,
      members: folder.members
        .map((m) => byId.get(m.serverId))
        .filter((m): m is MembershipWithServer => Boolean(m)),
    }));

    // Uç yoksa klasörleri üyelik alanlarından türet (ad/renk olmadan).
    if (folderItems.length === 0) {
      const grouped = new Map<string, MembershipWithServer[]>();
      for (const membership of all) {
        if (!membership.folderId) continue;
        const bucket = grouped.get(membership.folderId);
        if (bucket) bucket.push(membership);
        else grouped.set(membership.folderId, [membership]);
      }
      for (const [id, members] of grouped) {
        folderItems.push({
          kind: "folder",
          id,
          order: 0,
          folder: { id, name: null, color: null, order: 0, members: [] },
          members: members.sort(
            (a, b) => (a.orderInFolder ?? 0) - (b.orderInFolder ?? 0)
          ),
        });
      }
    }

    const serverItems: RailItem[] = all
      .filter((m) => !m.folderId)
      .map((membership) => ({
        kind: "server" as const,
        id: membership.serverId,
        order: membership.order ?? 0,
        membership,
      }));

    return [...folderItems, ...serverItems].sort((a, b) => a.order - b.order);
  }, [memberships, folders]);

  return { items, isLoading: membershipsLoading || foldersLoading };
}

/**
 * Kök sıralamayı kaydeder (klasörler + klasörsüz sunucular birlikte).
 * Sürükle-bırak bittiğinde çağrılır.
 */
export function useReorderRail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: { type: "folder" | "server"; id: string }[]) =>
      api(endpoints.sidebarReorder, { method: "PATCH", body: { items } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
      void queryClient.invalidateQueries({ queryKey: qk.folders });
    },
  });
}

/** Klasör içindeki sıralama. */
export function useReorderFolder(folderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverIds: string[]) =>
      api(endpoints.folderReorder(folderId), {
        method: "PATCH",
        body: { serverIds },
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.folders });
      void queryClient.invalidateQueries({ queryKey: qk.memberships });
    },
  });
}
