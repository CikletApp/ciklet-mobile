import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  findSetting,
  isSettingMeaningful,
  settingKey,
  type NotificationLevel,
  type NotificationSettingRecord,
  type NotificationTarget,
} from "@/lib/notification-settings";
import { useAuth } from "@/stores/auth";
import { api } from "../client";
import { endpoints } from "../endpoints";
import { qk } from "../query-keys";

/**
 * Sunucu / kanal / DM bildirim ayarları (web `hooks/use-notification-settings`).
 *
 * Tek liste uygulama açılışında çekilir; yazımlar iyimser uygulanır (alt
 * menü anında güncellensin), hata olursa liste yeniden çekilir. Okunmamış
 * sayımı ve push kararı sunucuda aynı kayıtlardan verilir; burada amaç
 * arayüz ve uygulama içi ses/kart.
 */
export function useNotificationSettings() {
  const signedIn = useAuth((s) => s.status === "signedIn");
  return useQuery({
    queryKey: qk.notificationSettings,
    queryFn: () => api<NotificationSettingRecord[]>(endpoints.notificationSettings),
    enabled: signedIn,
    staleTime: 5 * 60_000,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

/** Tek hedefin kaydı (yoksa undefined = varsayılan / miras). */
export function useNotificationSetting(target: NotificationTarget | null | undefined) {
  const { data } = useNotificationSettings();
  return target ? findSetting(data, target) : undefined;
}

export interface NotificationPatch {
  level?: NotificationLevel | null;
  /** Unix ms; MUTE_FOREVER süresiz; null kaldırır. */
  mutedUntil?: number | null;
  suppressEveryone?: boolean;
}

function applyPatch(
  list: NotificationSettingRecord[] | undefined,
  target: NotificationTarget,
  patch: NotificationPatch | null
): NotificationSettingRecord[] {
  const key = settingKey(target);
  const current = (list ?? []).find((record) => settingKey(record) === key);
  const rest = (list ?? []).filter((record) => settingKey(record) !== key);
  if (!patch) return rest;
  const next: NotificationSettingRecord = {
    serverId: target.serverId ?? current?.serverId ?? null,
    channelId: target.channelId ?? null,
    directId: target.directId ?? null,
    level: current?.level ?? null,
    mutedUntil: current?.mutedUntil ?? null,
    suppressEveryone: current?.suppressEveryone ?? false,
    label: current?.label,
    ...patch,
  };
  return isSettingMeaningful(next, Date.now()) ? [...rest, next] : rest;
}

/** Hedefe yama yazar (PUT); verilmeyen alan korunur. */
export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, patch }: { target: NotificationTarget; patch: NotificationPatch }) =>
      api<NotificationSettingRecord>(endpoints.notificationSettings, {
        method: "PUT",
        body: { ...target, ...patch },
      }),
    onMutate: ({ target, patch }) => {
      queryClient.setQueryData<NotificationSettingRecord[]>(qk.notificationSettings, (list) =>
        applyPatch(list, target, patch)
      );
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: qk.notificationSettings }),
    // Okunmamış rozeti susturmaya göre sunucuda hesaplanıyor.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.unreadCounts }),
  });
}

/** Hedefin kaydını siler — varsayılana / sunucudan mirasa döner. */
export function useResetNotificationSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: NotificationTarget) =>
      api<void>(endpoints.notificationSettings, { method: "DELETE", body: target }),
    onMutate: (target) => {
      queryClient.setQueryData<NotificationSettingRecord[]>(qk.notificationSettings, (list) =>
        applyPatch(list, target, null)
      );
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: qk.notificationSettings }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.unreadCounts }),
  });
}
