import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";
import type { MyServerPermissions, ServerEventItem, ServerEventStatus } from "../types";

/**
 * Zamanlanmış etkinlikler (web "Etkinlikler" modalı, `lib/server-events`).
 * Liste yaklaşan + süren etkinlikleri getirir; moderatör+ oluşturur,
 * başlatır, bitirir, iptal eder, siler. Hatırlatma ve otomatik başlatma
 * worker'da; mobil push zaten geliyor.
 */
export function useServerEvents(serverId: string | undefined) {
  return useQuery({
    queryKey: qk.serverEvents(serverId ?? "yok"),
    enabled: Boolean(serverId),
    queryFn: () => api<ServerEventItem[]>(endpoints.serverEvents(serverId!)),
    staleTime: 60_000,
  });
}

/**
 * Etkinlik yönetimi kapısı (web `getServerModerator` + `EVENT_MANAGER_BITS`):
 * sahip, ADMIN/MODERATOR ya da Yönetici / Kanalları Yönet / Sunucuyu Yönet biti.
 */
export function canManageEvents(actor: MyServerPermissions | undefined): boolean {
  if (!actor) return false;
  return (
    actor.isOwner ||
    actor.memberRole === "ADMIN" ||
    actor.memberRole === "MODERATOR" ||
    actor.keys.includes("ADMINISTRATOR") ||
    actor.keys.includes("MANAGE_CHANNELS") ||
    actor.keys.includes("MANAGE_SERVER")
  );
}

export interface CreateEventInput {
  name: string;
  description?: string | null;
  channelId?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
}

export function useCreateServerEvent(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      api<ServerEventItem>(endpoints.serverEvents(serverId), { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.serverEvents(serverId) }),
  });
}

export function useSetServerEventStatus(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: ServerEventStatus }) =>
      api<unknown>(endpoints.serverEvent(serverId, eventId), { method: "PATCH", body: { status } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.serverEvents(serverId) }),
  });
}

export function useDeleteServerEvent(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api<unknown>(endpoints.serverEvent(serverId, eventId), { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.serverEvents(serverId) }),
  });
}

/** İlgileniyorum aç/kapa — iyimser; sunucu sayıyı döndürür. */
export function useToggleEventInterest(serverId: string) {
  const queryClient = useQueryClient();
  const key = qk.serverEvents(serverId);
  return useMutation({
    mutationFn: ({ eventId, interested }: { eventId: string; interested: boolean }) =>
      api<{ interested: boolean; interestedCount: number }>(endpoints.serverEventInterest(serverId, eventId), {
        method: interested ? "POST" : "DELETE",
      }),
    onMutate: ({ eventId, interested }) => {
      queryClient.setQueryData<ServerEventItem[]>(key, (list) =>
        list?.map((event) =>
          event.id === eventId
            ? {
                ...event,
                interested,
                interestedCount: Math.max(0, event.interestedCount + (interested ? 1 : -1)),
              }
            : event
        )
      );
    },
    onSuccess: (result, { eventId }) => {
      queryClient.setQueryData<ServerEventItem[]>(key, (list) =>
        list?.map((event) =>
          event.id === eventId
            ? { ...event, interested: result.interested, interestedCount: result.interestedCount }
            : event
        )
      );
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** "15 dk sonra" / "2 sa önce" (web `formatEventWhen`). */
export function formatEventWhen(startsAt: string, now: number): string {
  const diff = new Date(startsAt).getTime() - now;
  const mins = Math.round(Math.abs(diff) / 60_000);
  if (mins < 1) return "şimdi";
  const rel = mins < 60 ? `${mins} dk` : mins < 60 * 24 ? `${Math.round(mins / 60)} sa` : `${Math.round(mins / (60 * 24))} gün`;
  return diff > 0 ? `${rel} sonra` : `${rel} önce`;
}
