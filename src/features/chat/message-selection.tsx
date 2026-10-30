import { useCallback, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { BULK_DELETE_MAX, BULK_DELETE_MAX_AGE_MS, useBulkDeleteMessages } from "@/api/hooks";
import { Button, Icon, Pressable, showToast } from "@/components/ui";
import { BulkDeleteSheet } from "@/features/server/moderation-sheets";
import type { ChatMessagePayload } from "@/realtime/events";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { canBePinned } from "./pins";

/**
 * Mesaj seçimi ve toplu silme (web sohbetindeki "Mesajları Seç").
 *
 * Yalnızca sunucu kanalında ve Mesajları Yönet yetkisinde açılır. Seçilemez:
 * silinmiş mesaj, sistem satırları (arama kaydı, süre değişikliği, sabitleme
 * satırı — sabitlenemeyenlerle aynı küme) ve 14 günden eski mesaj (Discord
 * kuralı; sunucu da reddeder). Seçim sohbete bağlıdır: başka sohbete
 * geçildiğinde kendiliğinden düşer.
 */

/** Modül düzeyinde: render içinde doğrudan `Date.now` React Compiler kuralına takılıyor. */
function nowMs(): number {
  return Date.now();
}

/** Seçilebilir mi; değilse kullanıcıya söylenecek neden. */
export function selectionBlock(message: ChatMessagePayload): "never" | "too-old" | null {
  if (!canBePinned(message)) return "never";
  const created = new Date(message.createdAt).getTime();
  if (!Number.isFinite(created) || nowMs() - created > BULK_DELETE_MAX_AGE_MS) return "too-old";
  return null;
}

export function useMessageSelection(chatId: string, serverId: string | undefined) {
  // Seçim hangi sohbete aitse onunla birlikte tutulur; sohbet değişince
  // efekt gerekmeden geçersiz olur.
  const [state, setState] = useState<{ chatId: string; ids: Set<string> } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bulkDelete = useBulkDeleteMessages(chatId, serverId ?? "");
  const ids = state?.chatId === chatId ? state.ids : null;

  const exit = useCallback(() => {
    setState(null);
    setConfirming(false);
    bulkDelete.reset();
  }, [bulkDelete]);

  /** "Mesajları Seç": seçim açılır, basılı tutulan mesaj seçili gelir. */
  const start = useCallback(
    (message: ChatMessagePayload) => {
      setState({ chatId, ids: selectionBlock(message) ? new Set() : new Set([message.id]) });
    },
    [chatId]
  );

  const toggle = useCallback(
    (message: ChatMessagePayload) => {
      if (!ids) return;
      if (ids.has(message.id)) {
        const next = new Set(ids);
        next.delete(message.id);
        setState({ chatId, ids: next });
        return;
      }
      const block = selectionBlock(message);
      if (block === "too-old") {
        showToast("14 günden eski mesajlar toplu silinemez.", "error");
        return;
      }
      if (block) return;
      if (ids.size >= BULK_DELETE_MAX) {
        showToast(`En fazla ${BULK_DELETE_MAX} mesaj seçilebilir.`, "error");
        return;
      }
      setState({ chatId, ids: new Set(ids).add(message.id) });
    },
    [chatId, ids]
  );

  const confirm = useCallback(
    (reason: string) => {
      if (!ids || ids.size === 0) return;
      const count = ids.size;
      bulkDelete.mutate(
        { messageIds: [...ids], reason },
        {
          onSuccess: () => {
            showToast(`${count} mesaj silindi.`);
            exit();
          },
        }
      );
    },
    [bulkDelete, exit, ids]
  );

  return {
    active: ids !== null,
    ids,
    start,
    toggle,
    exit,
    sheet: (
      <BulkDeleteSheet
        count={ids?.size ?? 0}
        visible={confirming && ids !== null}
        pending={bulkDelete.isPending}
        error={
          bulkDelete.error
            ? bulkDelete.error instanceof ApiError && bulkDelete.error.message
              ? bulkDelete.error.message
              : "Mesajlar silinemedi."
            : null
        }
        onClose={() => {
          setConfirming(false);
          bulkDelete.reset();
        }}
        onConfirm={confirm}
      />
    ),
    openConfirm: () => setConfirming(true),
  };
}

/** Seçim modunda mesaj satırı: solda onay dairesi, dokunuş seçimi değiştirir. */
export function SelectableRow({
  checked,
  onPress,
  children,
}: {
  checked: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      noHitSlop
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: spacing.md,
        backgroundColor: checked ? colors.brandSoft : pressed ? colors.raised : "transparent",
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radii.full,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: checked ? 0 : 2,
          borderColor: colors.muted,
          backgroundColor: checked ? colors.brand : "transparent",
        }}
      >
        {checked ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
      </View>
      {/* Satırın kendi dokunuşları (profil, tepki, bağlantı) seçimde kapalı. */}
      <View style={{ flex: 1 }} pointerEvents="none">
        {children}
      </View>
    </Pressable>
  );
}

/** Yazma çubuğunun yerine geçen seçim çubuğu. */
export function SelectionBar({ count, onCancel, onDelete }: { count: number; onCancel: () => void; onDelete: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.panel,
      }}
    >
      <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }} numberOfLines={1}>
        {`${count} mesaj seçildi`}
      </Text>
      <Button label="İptal" variant="ghost" onPress={onCancel} />
      <Button label="Seçilenleri sil" variant="danger" disabled={count === 0} onPress={onDelete} />
    </View>
  );
}
