import { useBookmarkIds, useToggleBookmark } from "@/api/hooks";
import type { ChatMessagePayload } from "@/realtime/events";
import { showToast } from "@/components/ui/toast";
import type { IconName } from "@/components/ui";
import { openReminderSheet } from "@/features/social/reminder-sheet";

/**
 * Mesaj eylem menüsündeki "Kaydet / Kaydı kaldır" öğesi (web sağ tık →
 * Kaydet). Menü yalnızca bu tek öğeyi ekler; sohbet türü mesajın kendi
 * alanından okunur (kanal mesajı `channelId`, DM `directId` taşır).
 * Sunucu mesajdan önce sohbete erişimi doğrular (500 kayıt sınırı: 409).
 */
export function useBookmarkAction(
  message: ChatMessagePayload,
  onDone: () => void
): { key: string; icon: IconName; label: string; onPress: () => void } | null {
  const { data: ids } = useBookmarkIds();
  const toggle = useToggleBookmark();
  const raw = message as { id?: string; channelId?: unknown; directId?: unknown };
  const chatId = typeof raw.channelId === "string" ? raw.channelId : typeof raw.directId === "string" ? raw.directId : null;
  if (!raw.id || !chatId) return null;

  const saved = ids?.has(raw.id) ?? false;
  const target = {
    messageId: raw.id,
    scope: (typeof raw.channelId === "string" ? "channel" : "direct") as "channel" | "direct",
    chatId,
  };

  return {
    key: "bookmark",
    icon: "bookmark",
    label: saved ? "Kaydı kaldır" : "Kaydet",
    onPress: () => {
      onDone();
      toggle.mutate(
        { target, saved },
        {
          onSuccess: () => showToast(saved ? "Kayıt kaldırıldı." : "Kaydedildi · Sohbetler → Kaydedilenler"),
          onError: (error) =>
            showToast(
              (error as { status?: number }).status === 409 ? "Kayıt sınırına ulaştın (500)." : "Kaydedilemedi.",
              "error"
            ),
        }
      );
    },
  };
}

/**
 * Mesaj menüsündeki "Bana hatırlat" (web sağ tık → Bana Hatırlat): menü
 * kapanır, hatırlatıcı sayfası kökten açılır (features/social/reminder-sheet).
 */
export function useReminderAction(
  message: ChatMessagePayload,
  onDone: () => void
): { key: string; icon: IconName; label: string; onPress: () => void } | null {
  const raw = message as { id?: string; channelId?: unknown; directId?: unknown };
  const chatId = typeof raw.channelId === "string" ? raw.channelId : typeof raw.directId === "string" ? raw.directId : null;
  if (!raw.id || !chatId) return null;
  const target = {
    messageId: raw.id,
    scope: (typeof raw.channelId === "string" ? "channel" : "direct") as "channel" | "direct",
    chatId,
  };
  return {
    key: "remind",
    icon: "clock",
    label: "Bana hatırlat",
    onPress: () => {
      onDone();
      openReminderSheet(target);
    },
  };
}
