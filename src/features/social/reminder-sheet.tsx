import { useState } from "react";
import { Modal, Platform, Pressable as RNPressable, Text, View } from "react-native";
import { create } from "zustand";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useBookmarkReminders, useSetBookmarkReminder, type BookmarkTarget } from "@/api/hooks";
import { ActionSheet, Button, Icon, Pressable, showToast, type ActionSheetItem } from "@/components/ui";
import {
  REMINDER_PRESETS,
  formatReminderWhen,
  isValidRemindAt,
  presetRemindAt,
} from "@/lib/bookmark-reminders";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "Bana Hatırlat" (Discord "Remind me"; web components/bookmarks/
 * reminder-controls): 30 dk, 1 sa, 3 sa, yarın 09:00, özel tarih; kurulu
 * hatırlatıcı varsa "Hatırlatıcıyı kaldır". Hatırlatıcı kurmak mesajı
 * Kaydedilenler'e de ekler. Metinler web ile aynı.
 */
export function ReminderSheet({
  target,
  onClose,
}: {
  target: BookmarkTarget | null;
  onClose: () => void;
}) {
  const { data: reminders } = useBookmarkReminders();
  const setReminder = useSetBookmarkReminder();
  const [customFor, setCustomFor] = useState<BookmarkTarget | null>(null);
  const current = target ? reminders?.[target.messageId] : undefined;

  const apply = (forTarget: BookmarkTarget, at: Date | null) =>
    setReminder.mutate(
      { target: forTarget, remindAt: at },
      {
        onSuccess: () =>
          showToast(at ? `Hatırlatıcı kuruldu: ${formatReminderWhen(at)}` : "Hatırlatıcı kaldırıldı."),
        onError: (error) =>
          showToast(
            error instanceof ApiError && error.status === 409 ? "Kayıt sınırına ulaştın (500)." : "Hatırlatıcı kurulamadı.",
            "error"
          ),
      }
    );

  const items: (ActionSheetItem | "separator")[] = target
    ? [
        ...REMINDER_PRESETS.map(
          (preset): ActionSheetItem => ({
            key: preset.key,
            label: preset.label,
            icon: "clock",
            onPress: () => apply(target, presetRemindAt(preset.key)),
          })
        ),
        {
          key: "custom",
          label: "Özel tarih ve saat",
          icon: "clock",
          onPress: () => setCustomFor(target),
        },
        ...(current
          ? [
              "separator" as const,
              {
                key: "clear",
                label: "Hatırlatıcıyı kaldır",
                icon: "trash" as const,
                destructive: true,
                onPress: () => apply(target, null),
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <ActionSheet
        visible={Boolean(target)}
        onClose={onClose}
        header={
          <View>
            <Text style={{ ...typography.body, ...fw(700), color: colors.bright }}>Bana Hatırlat</Text>
            {current ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Hatırlatıcı: {formatReminderWhen(new Date(current))}
              </Text>
            ) : null}
          </View>
        }
        items={items}
      />
      <CustomReminderModal
        target={customFor}
        onClose={() => setCustomFor(null)}
        onSubmit={(forTarget, at) => {
          setCustomFor(null);
          apply(forTarget, at);
        }}
      />
    </>
  );
}

const MINUTE_STEP = 15;

/** Varsayılan özel an: bir saat sonrasının 15 dakikaya yuvarlanmışı. */
function defaultCustom(): Date {
  const at = presetRemindAt("1h");
  at.setMinutes(Math.ceil(at.getMinutes() / MINUTE_STEP) * MINUTE_STEP, 0, 0);
  return at;
}

/**
 * Özel tarih ve saat — yerel bir tarih seçici bağımlılığı yok; gün ve saat
 * ± düğmeleriyle (gün adımı 1, saat 1, dakika 15) seçilir. Web'de tarayıcının
 * `datetime-local` girdisi var; sonuç aynı mutlak an.
 */
function CustomReminderModal({
  target,
  onClose,
  onSubmit,
}: {
  target: BookmarkTarget | null;
  onClose: () => void;
  onSubmit: (target: BookmarkTarget, at: Date) => void;
}) {
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState<Date>(defaultCustom);
  // Her açılışta varsayılana dön (render sırasında, efekt turu olmadan).
  const [openedFor, setOpenedFor] = useState<BookmarkTarget | null>(null);
  if (target !== openedFor) {
    setOpenedFor(target);
    if (target) setAt(defaultCustom());
  }

  const shift = (ms: number) => setAt((prev) => new Date(prev.getTime() + ms));
  const valid = isValidRemindAt(at);
  const dateLabel = at.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "long" });
  const timeLabel = at.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Modal visible={Boolean(target)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <RNPressable
          onPress={() => undefined}
          accessible={false}
          style={{
            margin: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.body, ...fw(700), color: colors.bright }}>Hatırlatıcı kur</Text>
          <Stepper
            label={dateLabel}
            onMinus={() => shift(-24 * 60 * 60_000)}
            onPlus={() => shift(24 * 60 * 60_000)}
            unit="gün"
          />
          <Stepper label={timeLabel} onMinus={() => shift(-60 * 60_000)} onPlus={() => shift(60 * 60_000)} unit="saat" />
          <Stepper
            label={`${String(at.getMinutes()).padStart(2, "0")}. dakika`}
            onMinus={() => shift(-MINUTE_STEP * 60_000)}
            onPlus={() => shift(MINUTE_STEP * 60_000)}
            unit="dakika"
          />
          {!valid ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>Gelecekte bir zaman seç.</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
            <Button label="Vazgeç" variant="ghost" onPress={onClose} />
            <Button label="Kur" disabled={!valid} onPress={() => target && onSubmit(target, at)} />
          </View>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}

function Stepper({ label, onMinus, onPlus, unit }: { label: string; onMinus: () => void; onPlus: () => void; unit: string }) {
  const button = (glyph: "chevron-left" | "chevron-right", onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={{
        width: 40,
        height: 40,
        borderRadius: radii.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.raised,
      }}
    >
      <Icon name={glyph} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {button("chevron-left", onMinus, `Bir ${unit} geri`)}
      <Text style={{ ...typography.body, ...fw(600), color: colors.text, flex: 1, textAlign: "center" }}>{label}</Text>
      {button("chevron-right", onPlus, `Bir ${unit} ileri`)}
    </View>
  );
}

// ── Kök düzeydeki sayfa ───────────────────────────────────────────────────
// Mesaj menüsü de bir Modal: iOS iki Modal'ı aynı anda sunamadığı için menü
// kapanır, sayfa kısa bir gecikmeyle kökten açılır.

const useReminderHost = create<{ target: BookmarkTarget | null }>(() => ({ target: null }));

export function openReminderSheet(target: BookmarkTarget) {
  setTimeout(() => useReminderHost.setState({ target }), Platform.OS === "ios" ? 450 : 0);
}

/** Kök düzende bir kez (app/_layout). */
export function ReminderSheetHost() {
  const target = useReminderHost((s) => s.target);
  return <ReminderSheet target={target} onClose={() => useReminderHost.setState({ target: null })} />;
}
