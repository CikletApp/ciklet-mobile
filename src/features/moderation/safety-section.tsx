import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { useLiftQuarantine, useQuarantinedMembers, useServerSafety, useSetServerPauses } from "@/api/hooks";
import { ActionSheet, Avatar, Button, Icon, type IconName, showToast } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { SAFETY_PAUSE_HOURS, isPaused } from "@/lib/safety";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { Card, CardHeader, SelectRow, SubTitle } from "./ui";

function PauseRow({ icon, title, hint, until, disabled, onPause, onResume }: {
  icon: IconName;
  title: string;
  hint: string;
  until: string | null;
  disabled: boolean;
  onPause: (hours: number) => void;
  onResume: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [hours, setHours] = useState(24);
  const [picker, setPicker] = useState(false);
  const paused = isPaused(until);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <Icon name={icon} size={16} color={paused ? colors.danger : colors.brand} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{title}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {paused
              ? t("safety.security.pausedUntil", {
                  time: new Date(until!).toLocaleString(locale === "en" ? "en-US" : "tr-TR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
                })
              : hint}
          </Text>
        </View>
      </View>
      {paused ? (
        <Button label={t("safety.security.resume")} variant="secondary" disabled={disabled} onPress={onResume} />
      ) : (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <SelectRow label={t("safety.security.hours", { count: hours })} disabled={disabled} onPress={() => setPicker(true)} />
          </View>
          <Button label={t("safety.security.pause")} variant="danger" disabled={disabled} onPress={() => onPause(hours)} />
        </View>
      )}
      <ActionSheet
        visible={picker}
        onClose={() => setPicker(false)}
        items={SAFETY_PAUSE_HOURS.map((h) => ({
          key: String(h),
          label: t("safety.security.hours", { count: h }),
          icon: (h === hours ? "check" : "timer") as IconName,
          onPress: () => {
            setHours(h);
            setPicker(false);
          },
        }))}
      />
    </View>
  );
}

/**
 * Güvenlik Eylemleri + Karantinadaki Üyeler — web `safety-section.tsx` ile
 * aynı: davet / DM duraklatma anında uygulanır (kayıt çubuğuna bağlı değil),
 * güvenlik uyarıları kanalı başlıktaki Kaydet ile gider.
 */
export function SafetySection({ serverId, canManage, channels, alertsChannelId, onAlertsChannelChange }: {
  serverId: string;
  canManage: boolean;
  channels: { id: string; name: string }[];
  alertsChannelId: string | null;
  onAlertsChannelChange: (id: string | null) => void;
}) {
  const t = useT();
  const { data: state } = useServerSafety(serverId);
  const { data: members } = useQuarantinedMembers(serverId);
  const setPauses = useSetServerPauses(serverId);
  const lift = useLiftQuarantine(serverId);
  const [picker, setPicker] = useState(false);
  const busy = setPauses.isPending || lift.isPending;
  const alertsChannel = channels.find((c) => c.id === alertsChannelId);

  const pause = (body: { invitesHours?: number; dmsHours?: number }, resumed: boolean) =>
    setPauses.mutate(body, {
      onSuccess: () => showToast(resumed ? t("safety.security.resumed") : t("safety.security.paused")),
      onError: (e) => showToast(e instanceof ApiError ? e.message : t("safety.security.failed"), "error"),
    });

  return (
    <>
      <Card>
        <CardHeader icon="lock" title={t("safety.security.title")} description={t("safety.security.description")} />
        <PauseRow
          icon="shield"
          title={t("safety.security.pauseInvites")}
          hint={t("safety.security.pauseInvitesHint")}
          until={state?.invitesPausedUntil ?? null}
          disabled={!canManage || busy}
          onPause={(h) => pause({ invitesHours: h }, false)}
          onResume={() => pause({ invitesHours: 0 }, true)}
        />
        <PauseRow
          icon="message"
          title={t("safety.security.pauseDms")}
          hint={t("safety.security.pauseDmsHint")}
          until={state?.dmsPausedUntil ?? null}
          disabled={!canManage || busy}
          onPause={(h) => pause({ dmsHours: h }, false)}
          onResume={() => pause({ dmsHours: 0 }, true)}
        />
        <SubTitle text={t("safety.security.alertsChannel")} hint={t("safety.security.alertsChannelHint")} />
        <SelectRow label={alertsChannel ? `#${alertsChannel.name}` : t("safety.security.noChannel")} disabled={!canManage} onPress={() => setPicker(true)} />
      </Card>

      <Card>
        <CardHeader icon="user" title={t("safety.quarantine.title")} description={t("safety.quarantine.description")} />
        {(members ?? []).length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted, paddingVertical: spacing.xs }}>{t("safety.quarantine.empty")}</Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {(members ?? []).map((m) => (
              <View key={m.memberId} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.raised }}>
                <Avatar imageUrl={m.profile.imageUrl} fallbackText={m.profile.username} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{m.nickname || m.profile.name || m.profile.username}</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                    {`@${m.profile.username} · ${m.quarantine?.source === "profile" ? t("safety.quarantine.profile") : t("safety.quarantine.rule", { name: m.quarantine?.ruleName ?? "AutoMod" })}`}
                  </Text>
                </View>
                {canManage ? (
                  <Button
                    label={t("safety.quarantine.lift")}
                    disabled={busy}
                    onPress={() =>
                      lift.mutate(m.memberId, {
                        onSuccess: () => showToast(t("safety.quarantine.lifted")),
                        onError: (e) => showToast(e instanceof ApiError ? e.message : t("safety.security.failed"), "error"),
                      })
                    }
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      <ActionSheet
        visible={picker}
        onClose={() => setPicker(false)}
        items={[
          {
            key: "none",
            label: t("safety.security.noChannel"),
            icon: alertsChannelId === null ? "check" : "bell-off",
            onPress: () => {
              onAlertsChannelChange(null);
              setPicker(false);
            },
          },
          ...channels.map((c) => ({
            key: c.id,
            label: `#${c.name}`,
            icon: (c.id === alertsChannelId ? "check" : "hash") as IconName,
            onPress: () => {
              onAlertsChannelChange(c.id);
              setPicker(false);
            },
          })),
        ]}
      />
    </>
  );
}
