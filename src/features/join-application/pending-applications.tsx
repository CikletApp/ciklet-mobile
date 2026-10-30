import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { useMyPendingApplications, useWithdrawJoinApplication, type MyPendingApplication } from "@/api/hooks";
import { qk } from "@/api/query-keys";
import { ActionSheet, Avatar, Icon, Pressable, showToast } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucular sekmesindeki bekleyen katılım başvuruları (Discord: başvurulan
 * sunucu listede soluk ikon + saat rozetiyle durur). Dokununca durum ve
 * "Başvuruyu geri çek". Web karşılığı: navigation-pending-applications.
 *
 * Gerçek zamanlı ayrı olay yok: liste uygulama öne gelince ve (bekleyen
 * varken) dakikada bir yenilenir. Bir başvuru geri çekilmeden listeden
 * düşerse (onay/ret) üyelikler yeniden istenir — onaylanan sunucu listeye girsin.
 */
export function PendingApplicationRows() {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data } = useMyPendingApplications();
  const withdraw = useWithdrawJoinApplication();
  const [selected, setSelected] = useState<MyPendingApplication | null>(null);
  const items = useMemo(() => data ?? [], [data]);

  const previous = useRef<Set<string>>(new Set());
  const withdrawnIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(items.map((i) => i.id));
    const decided = [...previous.current].some((id) => !current.has(id) && !withdrawnIds.current.has(id));
    previous.current = current;
    if (decided) void queryClient.invalidateQueries({ queryKey: qk.memberships });
  }, [items, queryClient]);

  if (items.length === 0) return null;

  const appliedAt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const onWithdraw = (item: MyPendingApplication) => {
    withdrawnIds.current.add(item.id);
    withdraw.mutate(item.serverId, {
      onSuccess: () => showToast(t("safety.application.withdrawn")),
      onError: (error) => {
        withdrawnIds.current.delete(item.id);
        showToast(error instanceof ApiError ? error.message : t("safety.security.failed"), "error");
      },
    });
  };

  return (
    <>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => setSelected(item)}
          haptic="light"
          noHitSlop
          accessibilityRole="button"
          accessibilityLabel={`${item.server.name}, ${t("safety.application.pendingBadge")}`}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingLeft: spacing.lg,
            minHeight: 72,
            backgroundColor: pressed ? colors.raised : "transparent",
          })}
        >
          <View style={{ width: 52, height: 52 }}>
            <View style={{ width: 52, height: 52, borderRadius: radii.lg, borderCurve: "continuous", overflow: "hidden", opacity: 0.5 }}>
              <Avatar imageUrl={item.server.imageUrl} fallbackText={item.server.name} size={52} radius={0} backgroundColor={colors.bento} />
            </View>
            <View
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.warning,
                borderWidth: 3,
                borderColor: colors.bg,
              }}
            >
              <Icon name="clock" size={11} color={colors.bg} />
            </View>
          </View>
          <View
            style={{
              flex: 1,
              alignSelf: "stretch",
              justifyContent: "center",
              gap: 2,
              paddingRight: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ ...typography.title, fontSize: 16.5, color: colors.muted }} numberOfLines={1}>
              {item.server.name}
            </Text>
            <Text style={{ ...typography.caption, color: colors.warning }} numberOfLines={1}>
              {t("safety.application.pendingBadge")}
            </Text>
          </View>
        </Pressable>
      ))}

      <ActionSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        header={
          selected ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                {t("safety.application.pendingTitle")} · {selected.server.name}
              </Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.application.pending")}</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {t("safety.application.appliedAt", { date: appliedAt(selected.createdAt) })}
              </Text>
            </View>
          ) : null
        }
        items={
          selected
            ? [
                {
                  key: "withdraw",
                  label: t("safety.application.withdraw"),
                  icon: "logout",
                  destructive: true,
                  onPress: () => onWithdraw(selected),
                },
              ]
            : []
        }
      />
    </>
  );
}
