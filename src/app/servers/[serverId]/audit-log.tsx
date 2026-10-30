import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable as RNPressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useAuditLogActors, useAuditLogs } from "@/api/hooks";
import type { AuditLogEntry } from "@/api/types";
import { Avatar, EmptyState, ErrorState, Icon, ListSkeleton, Pressable, Screen } from "@/components/ui";
import {
  AUDIT_FILTER_ACTIONS,
  SERVER_AUDIT_RETENTION_DAYS,
  auditActionLabel,
  auditEntryReason,
  describeAuditEntry,
} from "@/lib/audit-actions";
import { formatDate, formatTime } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu denetim kaydı — web Ayarlar › Denetim Kaydı sekmesinin mobil
 * karşılığı. Kişi ve eylem süzgeci sunucuda uygulanır; sayfalar `before`
 * imleciyle (son kaydın kimliği) yüklenir. Etiketler `lib/audit-actions`
 * (web modülünün kopyası). Yetki: Denetim Kaydını Görüntüle — uç denetler.
 */
export default function AuditLogScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const [action, setAction] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"user" | "action" | null>(null);

  const logs = useAuditLogs(serverId, action, userId);
  const actors = useAuditLogActors(serverId);
  const entries = useMemo(() => logs.data?.pages.flat() ?? [], [logs.data]);

  const actorName = (id: string | null) => {
    if (!id) return "Tüm Kullanıcılar";
    const found = actors.data?.find((a) => a.id === id);
    return found?.username ?? "Bilinmeyen";
  };

  const pickerOptions: PickerOption[] =
    picker === "user"
      ? [
          { id: null, label: "Tüm Kullanıcılar" },
          ...(actors.data ?? []).map((a) => ({ id: a.id, label: a.username, avatar: a })),
        ]
      : [{ id: null, label: "Tüm Eylemler" }, ...AUDIT_FILTER_ACTIONS.map((a) => ({ id: a, label: auditActionLabel(a) }))];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Denetim Kaydı" }} />

      <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <FilterChip label={actorName(userId)} active={userId !== null} onPress={() => setPicker("user")} />
        <FilterChip label={action ? auditActionLabel(action) : "Tüm Eylemler"} active={action !== null} onPress={() => setPicker("action")} />
      </View>

      {logs.isLoading ? (
        <ListSkeleton rows={8} />
      ) : logs.error ? (
        <ErrorState
          message={logs.error instanceof ApiError ? logs.error.message : "Denetim kaydı yüklenemedi."}
          onRetry={() => void logs.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState icon="list" title="Henüz kayıt yok." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
          onEndReached={() => {
            if (logs.hasNextPage && !logs.isFetchingNextPage) void logs.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => <AuditRow entry={item} />}
          ListFooterComponent={
            logs.isFetchingNextPage ? (
              <ActivityIndicator color={colors.muted} style={{ margin: spacing.lg }} />
            ) : (
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.lg }}>
                {`Kayıtlar ${SERVER_AUDIT_RETENTION_DAYS} gün saklanır.`}
              </Text>
            )
          }
        />
      )}

      <PickerSheet
        visible={picker !== null}
        options={pickerOptions}
        selected={picker === "user" ? userId : action}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          if (picker === "user") setUserId(id);
          else setAction(id);
          setPicker(null);
        }}
      />
    </Screen>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const reason = auditEntryReason(entry);
  const name = entry.actor?.username ?? "Bilinmeyen";
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <Avatar profileId={entry.actor?.id} imageUrl={entry.actor?.imageUrl ?? null} fallbackText={name} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.text }}>
          <Text style={{ ...fw(700), color: colors.bright }}>{name}</Text> {describeAuditEntry(entry)}
        </Text>
        {reason ? (
          <Text style={{ ...typography.caption, color: colors.text }}>{`Sebep: ${reason}`}</Text>
        ) : null}
        <Text style={{ ...typography.caption, color: colors.muted }}>
          {`${formatDate(entry.createdAt)} ${formatTime(entry.createdAt)}`}
        </Text>
      </View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(600), color: active ? colors.brand : colors.text, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevron-down" size={14} color={colors.muted} />
    </Pressable>
  );
}

interface PickerOption {
  id: string | null;
  label: string;
  avatar?: { id: string; username: string; imageUrl: string | null };
}

/** Kaydırılabilir seçim sayfası (eylem listesi bir eylem sayfasına sığmaz). */
function PickerSheet({
  visible,
  options,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean;
  options: PickerOption[];
  selected: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <RNPressable
          onPress={onClose}
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
          <FlatList
            data={options}
            keyExtractor={(option) => option.id ?? "*"}
            renderItem={({ item }) => {
              const active = item.id === selected;
              return (
                <Pressable
                  onPress={() => onPick(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    minHeight: 48,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: pressed ? colors.raised : "transparent",
                  })}
                >
                  {item.avatar ? (
                    <Avatar profileId={item.avatar.id} imageUrl={item.avatar.imageUrl} fallbackText={item.avatar.username} size={28} />
                  ) : null}
                  <Text style={{ ...typography.body, color: active ? colors.brand : colors.text, flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {active ? <Icon name="check" size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
