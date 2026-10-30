import { useMemo, useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import {
  formatScheduleTime,
  quickScheduleOptions,
  useCancelScheduledMessage,
  useScheduleMessage,
  useScheduledMessages,
  validateSchedule,
} from "@/api/hooks";
import { Button, Icon, IconButton, KeyboardAvoider, Pressable, TextField, showToast } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Zamanlanmış mesajlar — web `schedule-message-dialog` ve
 * `scheduled-messages-strip` karşılığı (kurallar `use-scheduled-messages`).
 *
 * Web'deki `datetime-local` alanının yerine etkinlik oluşturma ekranındaki
 * düzen: gün çipleri (bugünden 30 gün) + "SS:DD" saat alanı (tarih seçici
 * bağımlılığı yok).
 */

const TIME = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/;
const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function startOfDay(base: Date, offset: number): Date {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}

/** "Mesajı Zamanla" alt sayfası. `content` açılış anında donmuş metin. */
export function ScheduleMessageSheet({
  chatId,
  content,
  onClose,
  onScheduled,
}: {
  chatId: string;
  content: string;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Açılış anı: hızlı seçenekler buna göre (bileşen her açılışta yeniden kurulur).
  const [openedAt] = useState(() => new Date());
  const quick = useMemo(() => quickScheduleOptions(openedAt), [openedAt]);
  const days = useMemo(() => Array.from({ length: 31 }, (_, offset) => ({ offset, date: startOfDay(openedAt, offset) })), [openedAt]);
  const [choice, setChoice] = useState<string>("1h");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("");
  const schedule = useScheduleMessage();
  const saving = schedule.isPending;

  const timeMatch = TIME.exec(time.trim());
  const customAt = (() => {
    if (!timeMatch) return null;
    const at = startOfDay(openedAt, dayOffset);
    at.setHours(Number(timeMatch[1]), Number(timeMatch[2]));
    return at;
  })();
  const sendAt = choice === "custom" ? customAt : (quick.find((q) => q.id === choice)?.at ?? null);
  const check = sendAt ? validateSchedule({ content, sendAt: sendAt.getTime() }) : null;

  const submit = () => {
    if (!sendAt || saving) return;
    const valid = validateSchedule({ content, sendAt: sendAt.getTime() });
    if (!valid.ok) {
      showToast(valid.error, "error");
      return;
    }
    schedule.mutate(
      { chatId, content: valid.content, sendAt: valid.sendAt.toISOString() },
      {
        onSuccess: () => {
          showToast(`Mesaj zamanlandı: ${formatScheduleTime(valid.sendAt)}`);
          onScheduled();
          onClose();
        },
        onError: (reason) => showToast(apiMessage(reason, "Mesaj zamanlanamadı."), "error"),
      }
    );
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoider applySafeArea={false} style={{ flex: 1, justifyContent: "flex-end" }}>
        <RNPressable
          onPress={() => !saving && onClose()}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "88%",
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="clock" size={20} color={colors.brand} />
              <Text style={{ ...typography.title, color: colors.bright }}>Mesajı Zamanla</Text>
            </View>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Mesaj seçtiğin anda senin adına gönderilir. O ana kadar iptal edebilirsin.
            </Text>
            <Text
              numberOfLines={3}
              style={{ ...typography.body, color: colors.bright, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.panel, overflow: "hidden" }}
            >
              {content}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {quick.map((q) => {
                const active = choice === q.id;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => setChoice(q.id)}
                    haptic="light"
                    noHitSlop
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={({ pressed }) => ({
                      flexBasis: "48%",
                      flexGrow: 1,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radii.lg,
                      borderCurve: "continuous",
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.bentoBorder,
                      backgroundColor: active ? colors.brandSoft : pressed ? colors.raised : colors.panel,
                    })}
                  >
                    <Text style={{ ...typography.caption, ...fw(600), color: active ? colors.bright : colors.text }}>{q.label}</Text>
                    <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }}>{formatScheduleTime(q.at, openedAt)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ ...typography.overline, color: choice === "custom" ? colors.brand : colors.muted }}>ÖZEL ZAMAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
              {days.map(({ offset, date }) => (
                <Chip
                  key={offset}
                  label={
                    offset === 0
                      ? "Bugün"
                      : offset === 1
                        ? "Yarın"
                        : `${DAY_NAMES[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}`
                  }
                  selected={choice === "custom" && dayOffset === offset}
                  onPress={() => {
                    setDayOffset(offset);
                    setChoice("custom");
                  }}
                />
              ))}
            </ScrollView>
            <TextField
              label="SAAT (SS:DD)"
              value={time}
              onChangeText={(text) => {
                setTime(text);
                setChoice("custom");
              }}
              placeholder="20:30"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              error={choice === "custom" && time && !timeMatch ? "Saati 20:30 biçiminde yaz." : undefined}
            />
            {check && !check.ok ? <Text style={{ ...typography.caption, color: colors.danger }}>{check.error}</Text> : null}

            <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button label="İptal" variant="ghost" disabled={saving} onPress={onClose} />
              <Button label="Zamanla" disabled={saving || !check?.ok} loading={saving} onPress={submit} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

/**
 * Yazma çubuğunun üstünde "N zamanlanmış mesaj" şeridi: dokununca bekleyen
 * ve gönderilemeyen mesajlar listelenir, her biri iptal edilebilir. Hiç yoksa
 * hiçbir şey çizilmez.
 */
export function ScheduledMessagesStrip({ chatId }: { chatId: string }) {
  const { items } = useScheduledMessages(chatId);
  const cancel = useCancelScheduledMessage();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  if (items.length === 0) return null;
  const failed = items.filter((item) => item.status === "FAILED").length;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        haptic="light"
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: radii.full,
          backgroundColor: pressed ? colors.raised : colors.panel,
        })}
      >
        <Icon name="clock" size={13} color={colors.brand} />
        <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: colors.muted }}>
          {`${items.length} zamanlanmış mesaj`}
          {failed > 0 ? <Text style={{ color: colors.danger }}>{` · ${failed} gönderilemedi`}</Text> : null}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <RNPressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
          />
          <View
            style={{
              maxHeight: "70%",
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.sm,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              backgroundColor: colors.bento,
            }}
          >
            <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm }} />
            <ScrollView>
              {items.map((item) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                  <View style={{ paddingTop: 2 }}>
                    <Icon name={item.status === "FAILED" ? "flag" : "clock"} size={16} color={item.status === "FAILED" ? colors.danger : colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.bright }} numberOfLines={2}>
                      {item.content}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      {item.status === "FAILED"
                        ? (item.failReason ?? "Gönderilemedi.")
                        : item.status === "SENDING"
                          ? "Gönderiliyor…"
                          : formatScheduleTime(item.sendAt)}
                    </Text>
                  </View>
                  {item.status !== "SENDING" ? (
                    <IconButton
                      icon="close"
                      label={item.status === "FAILED" ? "Listeden kaldır" : "Zamanlamayı iptal et"}
                      background="transparent"
                      tint={colors.muted}
                      size={32}
                      disabled={cancel.isPending && cancel.variables === item.id}
                      onPress={() =>
                        cancel.mutate(item.id, {
                          onSuccess: () => {
                            if (items.length <= 1) setOpen(false);
                          },
                          onError: (reason) => showToast(apiMessage(reason, "İptal edilemedi."), "error"),
                        })
                      }
                    />
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.bentoBorder,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(selected ? 700 : 500), color: selected ? colors.brand : colors.text }}>{label}</Text>
    </Pressable>
  );
}
