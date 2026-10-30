import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useSafetyAlertAction } from "@/api/hooks";
import { Button, Icon, showToast } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { SafetyAlertAction, SafetyAlertMeta } from "@/lib/safety";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const ACTIONS: SafetyAlertAction[] = ["pause_invites", "pause_dms", "lockdown"];

/**
 * Güvenlik uyarısı satırı (Discord "Safety Alerts") — web
 * `safety-alert-card.tsx` ile aynı metinler ve eylemler. Yetki sunucuda
 * denetlenir; satır güncellemesi canlı yayınla gelir.
 */
export function SafetyAlertCard({ serverId, messageId, alert, createdAt }: { serverId: string | undefined; messageId: string; alert: SafetyAlertMeta; createdAt: string }) {
  const t = useT();
  const action = useSafetyAlertAction(serverId ?? "");
  const minutes = Math.max(1, Math.round(alert.windowSeconds / 60));
  const open = alert.status === "open";
  const busy = action.isPending;

  const run = (a: SafetyAlertAction) => {
    if (!serverId) return;
    action.mutate(
      { messageId, action: a },
      {
        onSuccess: () => showToast(t("safety.alert.done")),
        onError: (e) => showToast(e instanceof ApiError ? e.message : t("safety.security.failed"), "error"),
      }
    );
  };

  const applied = alert.actions.filter((a) => a !== "resolve" && a !== "false_alarm").map((a) => t(`safety.alert.actions.${a}`)).join(", ");

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
      <View
        style={{
          gap: spacing.xs,
          padding: spacing.md,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: open ? `${colors.danger}66` : colors.border,
          backgroundColor: open ? `${colors.danger}10` : "transparent",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Icon name="shield" size={14} color={open ? colors.danger : colors.muted} />
          <Text style={{ ...typography.overline, color: colors.muted, flex: 1 }}>{t("safety.alert.label").toLocaleUpperCase("tr-TR")}</Text>
          <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(createdAt)}</Text>
        </View>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{t(`safety.alert.title.${alert.kind}`)}</Text>
        <Text style={{ ...typography.caption, color: colors.text }}>
          {t(`safety.alert.body.${alert.kind}`, { count: alert.count, minutes, user: alert.username ? `@${alert.username}` : t("safety.alert.someone") })}
        </Text>
        {alert.actions.length > 0 ? <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.alert.applied", { list: applied || "—" })}</Text> : null}
        {open ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
            {ACTIONS.map((a) => (
              <Button key={a} label={t(`safety.alert.actions.${a}`)} variant="danger" disabled={busy || alert.actions.includes(a)} onPress={() => run(a)} />
            ))}
            <Button label={t("safety.alert.actions.resolve")} variant="secondary" disabled={busy} onPress={() => run("resolve")} />
            <Button label={t("safety.alert.actions.false_alarm")} variant="ghost" disabled={busy} onPress={() => run("false_alarm")} />
          </View>
        ) : (
          <Text style={{ ...typography.caption, ...fw(500), color: colors.muted }}>
            {alert.status === "resolved" ? t("safety.alert.resolvedBy", { name: alert.resolvedByName ?? "" }) : t("safety.alert.falseAlarmBy", { name: alert.resolvedByName ?? "" })}
          </Text>
        )}
      </View>
    </View>
  );
}
