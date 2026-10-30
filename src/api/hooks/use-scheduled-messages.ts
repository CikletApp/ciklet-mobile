import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import { endpoints } from "../endpoints";

/**
 * Zamanlanmış mesajlar — web `lib/scheduled-messages` + giriş çubuğundaki
 * "Zamanla" diyaloğu ve "N zamanlanmış mesaj" şeridinin mobil karşılığı.
 *
 * Web gibi kullanıcının TÜM bekleyen/gönderilemeyen mesajları tek istekle
 * çekilir (`GET /api/scheduled-messages`), şerit sohbet başına süzer.
 * Yalnızca metin: ek, anket ve yanıt zamanlanmaz. Sunucu aynı doğrulamayı ve
 * gönderim iznini yeniden denetler; vakti gelince worker kararı yeniden alır.
 */

export const SCHEDULE_MIN_LEAD_MS = 60_000;
export const SCHEDULE_MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
export const SCHEDULE_MAX_CONTENT = 4_000;

export interface ScheduledMessageItem {
  id: string;
  chatId: string;
  content: string;
  sendAt: string;
  status: "PENDING" | "SENDING" | "FAILED";
  failReason: string | null;
}

export type ScheduleValidation = { ok: true; content: string; sendAt: Date } | { ok: false; error: string };

/** Web `validateSchedule` ile birebir (metinler dahil). */
export function validateSchedule(input: { content: unknown; sendAt: unknown; now?: number }): ScheduleValidation {
  const now = input.now ?? Date.now();
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return { ok: false, error: "Zamanlanacak mesaj boş olamaz." };
  if (content.length > SCHEDULE_MAX_CONTENT) return { ok: false, error: `Mesaj en fazla ${SCHEDULE_MAX_CONTENT} karakter olabilir.` };
  const at = typeof input.sendAt === "string" || typeof input.sendAt === "number" ? new Date(input.sendAt) : null;
  if (!at || !Number.isFinite(at.getTime())) return { ok: false, error: "Gönderim zamanı geçersiz." };
  if (at.getTime() < now + SCHEDULE_MIN_LEAD_MS) return { ok: false, error: "Gönderim zamanı en az 1 dakika sonrası olmalı." };
  if (at.getTime() > now + SCHEDULE_MAX_LEAD_MS) return { ok: false, error: "En fazla 30 gün sonrasına zamanlanabilir." };
  return { ok: true, content, sendAt: at };
}

/** Hızlı seçenekler: 30 dk, 1 sa, 3 sa sonra; yarın 09:00. */
export function quickScheduleOptions(now = new Date()): { id: string; label: string; at: Date }[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { id: "30m", label: "30 dakika sonra", at: new Date(now.getTime() + 30 * 60_000) },
    { id: "1h", label: "1 saat sonra", at: new Date(now.getTime() + 60 * 60_000) },
    { id: "3h", label: "3 saat sonra", at: new Date(now.getTime() + 3 * 60 * 60_000) },
    { id: "tomorrow", label: "Yarın 09:00", at: tomorrow },
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "bugün 14:30", "yarın 09:00", "12.11.2026 18:45" (web `formatScheduleTime`). */
export function formatScheduleTime(at: Date | string, now = new Date()): string {
  const d = new Date(at);
  // Hermes'te tr-TR yerel ayarı her cihazda olmayabilir; biçim elle kurulur.
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return `bugün ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, tomorrow)) return `yarın ${time}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${time}`;
}

const scheduledKey = ["scheduled-messages"] as const;

/** Tüm sohbetlerin listesi (tek istek); `chatId` verilirse o sohbete süzülür. */
export function useScheduledMessages(chatId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: scheduledKey,
    queryFn: async () => {
      const data = await api<{ items?: ScheduledMessageItem[] }>(endpoints.scheduledMessages);
      return Array.isArray(data?.items) ? data.items : [];
    },
    staleTime: 60_000,
  });
  const items = useMemo(
    () => (chatId ? (query.data ?? []).filter((item) => item.chatId === chatId) : (query.data ?? [])),
    [query.data, chatId]
  );

  // En yakın gönderim anından biraz sonra tazele: gönderilen satır kalkar (web şeridi).
  const nextAt = items
    .filter((item) => item.status === "PENDING")
    .reduce<number | null>((min, item) => {
      const t = new Date(item.sendAt).getTime();
      return min === null || t < min ? t : min;
    }, null);
  useEffect(() => {
    if (nextAt === null) return;
    const delay = Math.min(Math.max(nextAt - Date.now() + 45_000, 5_000), 2_147_000_000);
    const timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: scheduledKey }), delay);
    return () => clearTimeout(timer);
  }, [nextAt, queryClient]);

  return { ...query, items };
}

export function useScheduleMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatId: string; content: string; sendAt: string }) =>
      api<ScheduledMessageItem>(endpoints.scheduledMessages, { method: "POST", body: input }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: scheduledKey }),
  });
}

/** Bekleyeni iptal et / gönderilemeyeni listeden kaldır. */
export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(endpoints.scheduledMessage(id), { method: "DELETE" }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<ScheduledMessageItem[]>(scheduledKey, (list) => list?.filter((item) => item.id !== id));
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: scheduledKey }),
  });
}
