import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ApiError } from "@/api/client";
import {
  useAccountStanding,
  useAppealViolation,
  type AccountStatusLevel,
  type StandingViolation,
} from "@/api/hooks/use-account-privacy";
import { Button, Icon, showToast } from "@/components/ui";
import { INTL_LOCALES, useLocale, useT, type MessageKey } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "Hesabının durumu" — web `settings/account-status-card.tsx`: beş kademeli
 * aşama çubuğu, kısıtlama bildirimi, aktif/süresi dolmuş ihlaller ve itiraz.
 */

const ORDER: AccountStatusLevel[] = ["GOOD", "LIMITED", "VERY_LIMITED", "AT_RISK", "SUSPENDED"];

const LEVEL_KEY: Record<AccountStatusLevel, string> = {
  GOOD: "good",
  LIMITED: "limited",
  VERY_LIMITED: "veryLimited",
  AT_RISK: "atRisk",
  SUSPENDED: "suspended",
};

const TONE: Record<AccountStatusLevel, string> = {
  GOOD: "#23a55a",
  LIMITED: "#f0b232",
  VERY_LIMITED: "#fb923c",
  AT_RISK: "#f23f43",
  SUSPENDED: "#f23f43",
};

const APPEAL_MIN = 10;

function useDate() {
  const locale = INTL_LOCALES[useLocale()];
  return (iso: string, withTime = false) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
}

export function AccountStatusCard() {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const fmt = useDate();
  const standing = useAccountStanding();

  if (standing.isLoading) {
    return (
      <View style={{ height: 112, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  const current: AccountStatusLevel = ORDER.includes(standing.data?.accountStatus as AccountStatusLevel)
    ? (standing.data!.accountStatus as AccountStatusLevel)
    : "GOOD";
  const step = ORDER.indexOf(current);
  const tone = TONE[current];
  const label = (s: AccountStatusLevel) => t(`settingsAccount.status.levels.${LEVEL_KEY[s]}.label` as MessageKey);
  const violations = standing.data?.violations ?? [];

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        backgroundColor: colors.panel,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${tone}26`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tone }} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.title, color: colors.bright }}>
            {t("settingsAccount.status.heading")}{" "}
            <Text style={{ color: tone }}>{label(current).toLocaleLowerCase(locale)}</Text>
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {t(`settingsAccount.status.levels.${LEVEL_KEY[current]}.description` as MessageKey)}
          </Text>
        </View>
      </View>

      {/* Aşama çubuğu */}
      <View style={{ flexDirection: "row" }}>
        {ORDER.map((s, i) => {
          const reached = i <= step;
          const isCurrent = i === step;
          return (
            <View key={s} style={{ flex: 1, alignItems: "center" }}>
              {i > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: 11,
                    right: "50%",
                    width: "100%",
                    height: 2,
                    backgroundColor: reached ? tone : colors.border,
                  }}
                />
              ) : null}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: reached ? tone : colors.deep,
                  borderWidth: reached ? 0 : 2,
                  borderColor: colors.border,
                  opacity: reached && !isCurrent ? 0.7 : 1,
                }}
              >
                {isCurrent ? <Icon name="check" size={14} color="#ffffff" /> : null}
              </View>
              <Text
                numberOfLines={2}
                style={{
                  ...typography.caption,
                  fontSize: 10,
                  lineHeight: 13,
                  marginTop: spacing.xs,
                  textAlign: "center",
                  color: isCurrent ? tone : colors.muted,
                }}
              >
                {label(s)}
              </Text>
            </View>
          );
        })}
      </View>

      {standing.data?.restrictedUntil ? (
        <View style={{ borderRadius: radii.md, borderWidth: 1, borderColor: "#f0b23240", backgroundColor: "#f0b2321a", padding: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.text }}>
            <Text style={{ fontWeight: "700", color: "#f0b232" }}>{t("settingsAccount.status.restrictionLabel")}</Text>
            {t("settingsAccount.status.restrictionBody", {
              date: fmt(standing.data.restrictedUntil, true),
              actions: [
                t("settingsAccount.status.restrictedActions.join"),
                t("settingsAccount.status.restrictedActions.friend"),
                t("settingsAccount.status.restrictedActions.dm"),
              ].join(", "),
            })}
          </Text>
        </View>
      ) : null}

      <ViolationList title={t("settingsAccount.status.activeViolations")} violations={violations.filter((v) => v.active)} />
      <ViolationList title={t("settingsAccount.status.expiredViolations")} violations={violations.filter((v) => !v.active)} muted />
    </View>
  );
}

function ViolationList({ title, violations, muted }: { title: string; violations: StandingViolation[]; muted?: boolean }) {
  const t = useT();
  const fmt = useDate();
  if (violations.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{title.toLocaleUpperCase()}</Text>
      {violations.map((v) => (
        <View
          key={v.id}
          style={{
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.deep,
            padding: spacing.md,
            gap: spacing.xs,
            opacity: muted ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{v.policyLabel}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{fmt(v.createdAt)}</Text>
          </View>
          {v.content ? (
            <Text style={{ ...typography.caption, color: colors.text, backgroundColor: colors.panel, borderRadius: radii.sm, padding: spacing.sm }}>
              {v.content}
            </Text>
          ) : null}
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {v.expiresAt
              ? `${v.active ? t("settingsAccount.status.stopsAffecting") : t("settingsAccount.status.expiredOn")}${fmt(v.expiresAt)}`
              : t("settingsAccount.status.permanent")}
          </Text>
          <AppealArea violation={v} />
        </View>
      ))}
    </View>
  );
}

function AppealArea({ violation }: { violation: StandingViolation }) {
  const t = useT();
  const appeal = useAppealViolation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (violation.appealStatus === "PENDING") {
    return <Text style={{ ...typography.caption, color: "#f0b232", fontWeight: "600" }}>{t("settingsAccount.status.appeal.pending")}</Text>;
  }
  if (violation.appealStatus === "REJECTED") {
    return (
      <Text style={{ ...typography.caption, color: colors.muted }}>
        {t("settingsAccount.status.appeal.rejected")}
        {violation.appealResponse ? ` ${violation.appealResponse}` : ""}
      </Text>
    );
  }
  if (!violation.canAppeal) return null;

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={{ ...typography.caption, color: colors.brand, fontWeight: "600" }}>{t("settingsAccount.status.appeal.open")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        autoFocus
        placeholder={t("settingsAccount.status.appeal.placeholder")}
        placeholderTextColor={colors.muted}
        style={{
          ...typography.caption,
          color: colors.text,
          minHeight: 72,
          textAlignVertical: "top",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.md,
          backgroundColor: colors.panel,
          padding: spacing.sm,
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
        <Button label={t("settingsAccount.common.cancel")} variant="ghost" disabled={appeal.isPending} onPress={() => setOpen(false)} />
        <Button
          label={appeal.isPending ? t("settingsAccount.status.appeal.sending") : t("settingsAccount.status.appeal.submit")}
          loading={appeal.isPending}
          disabled={text.trim().length < APPEAL_MIN}
          onPress={() =>
            appeal.mutate(
              { id: violation.id, text: text.trim() },
              {
                onSuccess: () => {
                  showToast(t("settingsAccount.status.appeal.sent"));
                  setOpen(false);
                },
                onError: (error) =>
                  showToast(error instanceof ApiError && error.message ? error.message : t("settingsAccount.status.appeal.failed"), "error"),
              }
            )
          }
        />
      </View>
    </View>
  );
}
