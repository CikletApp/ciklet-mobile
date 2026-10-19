import { Modal, Pressable as RNPressable, ScrollView, Switch, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import {
  useNotificationSetting,
  useResetNotificationSetting,
  useUpdateNotificationSetting,
} from "@/api/hooks";
import { Icon, Pressable, showToast } from "@/components/ui";
import {
  LEVEL_LABELS,
  MUTE_DURATIONS,
  isMutedAt,
  muteRemainingLabel,
  muteUntilFrom,
  type NotificationLevel,
  type NotificationTarget,
} from "@/lib/notification-settings";
import { useNow } from "@/lib/use-now";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Bildirim ayarları sayfası — web'deki sağ tık → Bildirimler alt menüsünün
 * mobil karşılığı. Sunucu, kanal ve DM için tek bileşen; her yerden
 * `openNotificationSettings(...)` ile açılır (kök düzende tek host),
 * böylece basılı tutma menüleri prop zinciri kurmadan çağırabilir.
 *
 * Kurallar web'le aynı: kanal seviyesi `null` = sunucudan miras, DM'de
 * yalnızca susturma var, "@herkes'i bastır" sunucu ve kanal için.
 */
export interface NotificationSheetRequest {
  target: NotificationTarget;
  kind: "server" | "channel" | "direct";
  /** Başlıkta görünen ad ("Sunucu", "#kanal", kişi). */
  title: string;
}

const useNotificationSheet = create<{ request: NotificationSheetRequest | null }>(() => ({ request: null }));

export function openNotificationSettings(request: NotificationSheetRequest) {
  useNotificationSheet.setState({ request });
}

function close() {
  useNotificationSheet.setState({ request: null });
}

/** Kök düzende bir kez. */
export function NotificationSettingsHost() {
  const request = useNotificationSheet((state) => state.request);
  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      {request ? <SheetBody request={request} /> : null}
    </Modal>
  );
}

function SheetBody({ request }: { request: NotificationSheetRequest }) {
  const insets = useSafeAreaInsets();
  const record = useNotificationSetting(request.target);
  const update = useUpdateNotificationSetting();
  const reset = useResetNotificationSetting();
  const now = useNow();
  const muted = isMutedAt(record?.mutedUntil, now);
  const remaining = muteRemainingLabel(record?.mutedUntil, now);
  const level = record?.level ?? null;

  const write = (patch: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate(
      { target: request.target, patch },
      { onError: () => showToast("Bildirim ayarı kaydedilemedi.", "error") }
    );

  const levelOptions: { id: NotificationLevel | null; label: string }[] =
    request.kind === "channel"
      ? [{ id: null, label: "Sunucu varsayılanı" }, ...levelList()]
      : levelList();

  return (
    <RNPressable
      onPress={close}
      accessibilityRole="button"
      accessibilityLabel="Kapat"
      style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
    >
      <Animated.View
        entering={SlideInDown.duration(200)}
        style={{
          maxHeight: "86%",
          marginHorizontal: spacing.sm,
          marginBottom: insets.bottom + spacing.sm,
          borderRadius: radii.xl,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
          boxShadow: `0 18px 48px ${colors.shadow}`,
          overflow: "hidden",
        }}
      >
        <RNPressable onPress={() => undefined} accessible={false} style={{ flexShrink: 1 }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>BİLDİRİMLER</Text>
            <Text style={{ ...typography.title, ...fw(700), color: colors.bright }} numberOfLines={1}>
              {request.title}
            </Text>
            {remaining ? <Text style={{ ...typography.caption, color: colors.brand }}>{remaining}</Text> : null}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: spacing.md }}>
            <GroupTitle title="SUSTUR" />
            {muted ? (
              <OptionRow
                icon="bell"
                label="Susturmayı kaldır"
                onPress={() => write({ mutedUntil: null })}
              />
            ) : (
              MUTE_DURATIONS.map((duration) => (
                <OptionRow
                  key={duration.id}
                  icon="bell-off"
                  label={duration.ms < 0 ? "Açana kadar sustur" : `${duration.label} sustur`}
                  onPress={() => {
                    write({ mutedUntil: muteUntilFrom(duration.ms, Date.now()) });
                    close();
                  }}
                />
              ))
            )}

            {request.kind !== "direct" ? (
              <>
                <GroupTitle title="BİLDİRİM SEVİYESİ" />
                {levelOptions.map((option) => (
                  <OptionRow
                    key={option.id ?? "inherit"}
                    label={option.label}
                    selected={
                      option.id === level ||
                      // Sunucuda kayıt yoksa etkin seviye "Tüm mesajlar".
                      (request.kind === "server" && level === null && option.id === "ALL")
                    }
                    onPress={() => write({ level: option.id })}
                  />
                ))}

                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ ...typography.body, color: colors.bright }}>@herkes ve @burada bastır</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      Toplu bahsetmeler bildirim göndermez.
                    </Text>
                  </View>
                  <Switch
                    value={record?.suppressEveryone === true}
                    onValueChange={(value) => write({ suppressEveryone: value })}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor="#ffffff"
                  />
                </View>
              </>
            ) : null}

            {record ? (
              <OptionRow
                icon="rotate-ccw"
                label="Varsayılana dön"
                onPress={() => {
                  reset.mutate(request.target);
                  close();
                }}
              />
            ) : null}
          </ScrollView>
        </RNPressable>
      </Animated.View>
    </RNPressable>
  );
}

function levelList(): { id: NotificationLevel; label: string }[] {
  return (Object.keys(LEVEL_LABELS) as NotificationLevel[]).map((id) => ({ id, label: LEVEL_LABELS[id] }));
}

function GroupTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        ...typography.overline,
        color: colors.muted,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
      }}
    >
      {title}
    </Text>
  );
}

function OptionRow({
  icon,
  label,
  selected,
  onPress,
}: {
  icon?: "bell" | "bell-off" | "rotate-ccw";
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      noHitSlop
      haptic="light"
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 48,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      {icon ? <Icon name={icon} size={19} color={colors.muted} /> : null}
      <Text style={{ ...typography.body, ...fw(500), color: colors.bright, flex: 1 }}>{label}</Text>
      {selected ? <Icon name="check" size={18} color={colors.brand} /> : null}
    </Pressable>
  );
}
