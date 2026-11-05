import { useState, type ReactNode } from "react";
import { Linking, Pressable, Switch, Text, TextInput, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api, cookieHeaderFor, getSession } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import { useCurrentProfile } from "@/api/hooks";
import {
  DSR_DETAILS_MAX,
  DSR_FORM_KINDS,
  accountEndpoints,
  profileExtras,
  useCancelDeletion,
  useConsents,
  useDataRequests,
  useDeletionState,
  useRequestDeletion,
  useSaveBirthDate,
  useSetConsent,
  useSubmitDataRequest,
  useWithdrawDataRequest,
  type DsrFormKind,
} from "@/api/hooks/use-account-privacy";
import { ActionSheet, Button, SectionHeader, showToast } from "@/components/ui";
import { BirthDateField, EMPTY_BIRTH_DATE, type BirthDateParts } from "@/features/auth/birth-date-field";
import { API_BASE_URL } from "@/lib/config";
import { saveLocalFile } from "@/lib/downloads";
import { INTL_LOCALES, useLocale, useT, type MessageKey } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Ayarlar → Gizlilik: yaş güvenliği ve KVKK bölümleri (web
 * `settings/privacy-compliance-sections.tsx` ile aynı metin ve davranış).
 * Her bölüm kendi verisini çeker; bunlar tercih değil EYLEM, ekranın
 * "Kaydet" düğmesine bağlanmaz.
 */

const inputStyle = {
  ...typography.body,
  color: colors.text,
  backgroundColor: colors.deep,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
} as const;

function Card({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        gap: spacing.md,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.border,
        backgroundColor: colors.panel,
      }}
    >
      {children}
    </View>
  );
}

function Desc({ children }: { children: string }) {
  return (
    <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
      {children}
    </Text>
  );
}

function errorText(error: unknown, fallback: string) {
  return userErrorMessage(error, fallback);
}

function useDates() {
  const locale = INTL_LOCALES[useLocale()];
  return {
    date: (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
    dateTime: (iso: string) =>
      new Date(iso).toLocaleString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

// ── Yaş ve güvenlik ────────────────────────────────────────────────────

function birthDateString({ day, month, year }: BirthDateParts): string | null {
  if (day === null || month === null || year === null) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function AgeSafetySection() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const saveBirthDate = useSaveBirthDate();
  const [dob, setDob] = useState<BirthDateParts>(EMPTY_BIRTH_DATE);
  const [phoneBusy, setPhoneBusy] = useState(false);

  const age = profileExtras(profile).age;
  if (!age || age.assurance === "EXEMPT") return null;

  const message = age.adultVerified
    ? age.assurance === "SELF_DECLARED"
      ? t("compliance.age.status.adultSelfDeclared")
      : t("compliance.age.status.adult")
    : age.needsBirthDate
      ? t("compliance.age.status.unknown")
      : age.canVerifyWithPhone
        ? t("compliance.age.status.needsVerification")
        : t("compliance.age.status.teen");

  const submitBirthDate = () => {
    const value = birthDateString(dob);
    if (!value) {
      showToast(t("compliance.age.prompt.invalid"), "error");
      return;
    }
    saveBirthDate.mutate(value, {
      onError: (error) => showToast(errorText(error, t("compliance.age.prompt.failed")), "error"),
    });
  };

  // Telefon doğrulaması Telegram botunda biter; dönüşte profil tazelenir.
  const verifyPhone = async () => {
    setPhoneBusy(true);
    try {
      const data = await api<{ url: string }>(endpoints.phoneTelegramStart, { method: "POST" });
      await Linking.openURL(data.url);
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: qk.currentProfile }), 5_000);
    } catch (error) {
      showToast(errorText(error, t("compliance.age.prompt.failed")), "error");
    } finally {
      setPhoneBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title={t("compliance.age.status.title").toLocaleUpperCase()} />
      <Card>
        <Text style={{ ...typography.body, color: age.adultVerified ? colors.text : colors.warning }}>{message}</Text>
        {age.needsBirthDate ? (
          <View style={{ gap: spacing.sm }}>
            <BirthDateField value={dob} onChange={setDob} />
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.age.prompt.body")}</Text>
            <Button label={t("compliance.age.status.enterBirthDate")} onPress={submitBirthDate} loading={saveBirthDate.isPending} />
          </View>
        ) : null}
        {age.canVerifyWithPhone ? (
          <Button label={t("compliance.age.status.verifyPhone")} onPress={() => void verifyPhone()} loading={phoneBusy} />
        ) : null}
        {!age.needsBirthDate ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.age.status.dobPrivate")}</Text>
        ) : null}
      </Card>
    </>
  );
}

// ── Açık rızalar ───────────────────────────────────────────────────────

export function ConsentsSection() {
  const t = useT();
  const fmt = useDates();
  const consents = useConsents();
  const setConsent = useSetConsent();
  const marketing = consents.data?.find((s) => s.document === "EXPLICIT_MARKETING") ?? null;

  return (
    <>
      <SectionHeader title={t("compliance.privacy.consents.title").toLocaleUpperCase()} />
      <Desc>{t("compliance.privacy.consents.desc")}</Desc>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{t("compliance.privacy.consents.marketingLabel")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.consents.marketingDesc")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {marketing
                ? t("compliance.privacy.consents.lastChanged", { date: fmt.dateTime(marketing.at) })
                : t("compliance.privacy.consents.never")}
            </Text>
          </View>
          <Switch
            value={marketing?.granted === true}
            disabled={setConsent.isPending || !consents.data}
            onValueChange={(granted) =>
              setConsent.mutate(
                { document: "EXPLICIT_MARKETING", granted },
                { onError: (error) => showToast(errorText(error, t("compliance.privacy.consents.failed")), "error") }
              )
            }
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor="#ffffff"
          />
        </View>
      </Card>
    </>
  );
}

// ── Verilerimi indir + Hesabımı sil ────────────────────────────────────

function ReauthInputs({
  password,
  totp,
  twoFactor,
  onPassword,
  onTotp,
  editable,
}: {
  password: string;
  totp: string;
  twoFactor: boolean;
  onPassword: (v: string) => void;
  onTotp: (v: string) => void;
  editable: boolean;
}) {
  const t = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.deletion.passwordLabel")}</Text>
      <TextInput
        value={password}
        onChangeText={onPassword}
        secureTextEntry
        autoComplete="current-password"
        editable={editable}
        style={inputStyle}
        placeholderTextColor={colors.muted}
      />
      {twoFactor ? (
        <>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settingsAccount.common.totpLabel")}</Text>
          <TextInput
            value={totp}
            onChangeText={onTotp}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            editable={editable}
            placeholder={t("settingsAccount.common.totpPlaceholder")}
            style={inputStyle}
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
    </View>
  );
}

function useTwoFactorEnabled(): boolean {
  const queryClient = useQueryClient();
  const status = queryClient.getQueryData<{ enabled?: boolean }>(["account-two-factor"]);
  return status?.enabled === true;
}

/** Arşiv ZIP olarak iner: `api()` JSON çözdüğü için ham istek atılır. */
async function downloadDataExport(body: Record<string, string>): Promise<string> {
  const session = await getSession();
  const res = await fetch(`${API_BASE_URL}${accountEndpoints.dataExport}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/zip, application/json",
      ...(session ? { Cookie: cookieHeaderFor(session) } : {}),
    },
    body: JSON.stringify(body),
    credentials: "omit",
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = "";
    try {
      message = (JSON.parse(raw) as { error?: string }).error ?? "";
    } catch {
      /* düz metin */
    }
    throw new ApiError(res.status, message);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "ciklet-verilerim.zip";
  const file = new File(Paths.cache, `${Date.now()}-${name}`);
  file.write(new Uint8Array(await res.arrayBuffer()));
  const result = await saveLocalFile(file, name, "application/zip");
  return result;
}

export function DataRightsSection() {
  const t = useT();
  const fmt = useDates();
  const twoFactor = useTwoFactorEnabled();
  const deletion = useDeletionState();
  const requestDeletion = useRequestDeletion();
  const cancelDeletion = useCancelDeletion();

  const [exportConfirming, setExportConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportTotp, setExportTotp] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");

  const exportReady = exportPassword.length > 0 && (!twoFactor || exportTotp.trim().length >= 6);

  const download = async () => {
    setExporting(true);
    try {
      const result = await downloadDataExport(
        twoFactor ? { password: exportPassword, totp: exportTotp.trim() } : { password: exportPassword }
      );
      setExportConfirming(false);
      setExportPassword("");
      setExportTotp("");
      if (result !== "cancelled") showToast(t("compliance.privacy.export.button"));
    } catch (error) {
      showToast(errorText(error, t("compliance.privacy.export.failed")), "error");
    } finally {
      setExporting(false);
    }
  };

  const pending = deletion.data?.pending ?? null;

  return (
    <>
      <SectionHeader title={t("compliance.privacy.export.title").toLocaleUpperCase()} />
      <Desc>{t("compliance.privacy.export.desc")}</Desc>
      <Card>
        {exportConfirming ? (
          <>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.export.confirmBody")}</Text>
            <ReauthInputs
              password={exportPassword}
              totp={exportTotp}
              twoFactor={twoFactor}
              onPassword={setExportPassword}
              onTotp={setExportTotp}
              editable={!exporting}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button
                label={t("common.cancel")}
                variant="ghost"
                                disabled={exporting}
                onPress={() => {
                  setExportConfirming(false);
                  setExportPassword("");
                  setExportTotp("");
                }}
              />
              <Button
                label={exporting ? t("compliance.privacy.export.preparing") : t("compliance.privacy.export.confirm")}
                                loading={exporting}
                disabled={!exportReady}
                onPress={() => void download()}
              />
            </View>
          </>
        ) : (
          <Button label={t("compliance.privacy.export.button")} onPress={() => setExportConfirming(true)} />
        )}
      </Card>

      <SectionHeader title={t("compliance.privacy.deletion.title").toLocaleUpperCase()} />
      <Desc>{t("compliance.privacy.deletion.desc")}</Desc>
      <Card danger>
        {pending ? (
          <>
            <Text style={{ ...typography.body, color: colors.text }}>
              {t("compliance.privacy.deletion.pending", { date: fmt.date(pending.createdAt), due: fmt.date(pending.dueAt) })}
            </Text>
            {pending.status === "PENDING" ? (
              <Button
                label={t("compliance.privacy.deletion.cancel")}
                variant="secondary"
                loading={cancelDeletion.isPending}
                onPress={() =>
                  cancelDeletion.mutate(undefined, {
                    onSuccess: () => showToast(t("compliance.privacy.deletion.cancelled")),
                    onError: (error) => showToast(errorText(error, t("compliance.privacy.deletion.failed")), "error"),
                  })
                }
              />
            ) : null}
          </>
        ) : confirming ? (
          <>
            <Text style={{ ...typography.bodyStrong, color: colors.danger }}>{t("compliance.privacy.deletion.confirmTitle")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.deletion.confirmBody")}</Text>
            {deletion.data && deletion.data.ownedServers > 0 ? (
              <Text style={{ ...typography.caption, color: colors.warning }}>
                {t("compliance.privacy.deletion.ownsServers", { count: String(deletion.data.ownedServers) })}
              </Text>
            ) : null}
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.deletion.passwordLabel")}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              style={inputStyle}
              placeholderTextColor={colors.muted}
            />
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.deletion.reasonLabel")}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={1000}
              style={{ ...inputStyle, minHeight: 64, textAlignVertical: "top" }}
              placeholderTextColor={colors.muted}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button
                label={t("common.cancel")}
                variant="ghost"
                                disabled={requestDeletion.isPending}
                onPress={() => setConfirming(false)}
              />
              <Button
                label={t("compliance.privacy.deletion.confirm")}
                variant="danger"
                                loading={requestDeletion.isPending}
                disabled={!password}
                onPress={() =>
                  requestDeletion.mutate(
                    { password, reason },
                    {
                      onSuccess: () => {
                        showToast(t("compliance.privacy.deletion.requested"));
                        setConfirming(false);
                        setPassword("");
                        setReason("");
                      },
                      onError: (error) => showToast(errorText(error, t("compliance.privacy.deletion.failed")), "error"),
                    }
                  )
                }
              />
            </View>
          </>
        ) : (
          <Button label={t("compliance.privacy.deletion.button")} variant="danger" onPress={() => setConfirming(true)} />
        )}
      </Card>
    </>
  );
}

// ── KVKK başvurusu (m.11) ──────────────────────────────────────────────

export function KvkkRequestSection() {
  const t = useT();
  const fmt = useDates();
  const [kind, setKind] = useState<DsrFormKind>("ACCESS");
  const [details, setDetails] = useState("");
  const [kindOpen, setKindOpen] = useState(false);
  const requests = useDataRequests();
  const submit = useSubmitDataRequest();
  const withdraw = useWithdrawDataRequest();
  const kindLabel = (k: string) => t(`compliance.privacy.dsr.kinds.${k}` as MessageKey);

  return (
    <>
      <SectionHeader title={t("compliance.privacy.dsr.title").toLocaleUpperCase()} />
      <Desc>{t("compliance.privacy.dsr.desc")}</Desc>
      <Card>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.dsr.kindLabel")}</Text>
        <Pressable
          onPress={() => setKindOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ ...inputStyle, paddingVertical: spacing.md, opacity: pressed ? 0.8 : 1 })}
        >
          <Text style={{ ...typography.body, color: colors.text }}>{kindLabel(kind)}</Text>
        </Pressable>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("compliance.privacy.dsr.detailsLabel")}</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={DSR_DETAILS_MAX}
          placeholder={t("compliance.privacy.dsr.detailsPlaceholder")}
          placeholderTextColor={colors.muted}
          style={{ ...inputStyle, minHeight: 96, textAlignVertical: "top" }}
        />
        <Button
          label={t("compliance.privacy.dsr.submit")}
          loading={submit.isPending}
          disabled={details.trim().length < 10}
          onPress={() =>
            submit.mutate(
              { kind, details },
              {
                onSuccess: () => {
                  showToast(t("compliance.privacy.dsr.submitted"));
                  setDetails("");
                },
                onError: (error) => showToast(errorText(error, t("compliance.privacy.dsr.failed")), "error"),
              }
            )
          }
        />

        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Text style={{ ...typography.overline, color: colors.muted }}>{t("compliance.privacy.dsr.history").toLocaleUpperCase()}</Text>
        {!requests.data ? null : requests.data.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted, fontStyle: "italic" }}>{t("compliance.privacy.dsr.empty")}</Text>
        ) : (
          requests.data.map((r) => (
            <View key={r.id} style={{ backgroundColor: colors.deep, borderRadius: radii.md, padding: spacing.md, gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }}>{kindLabel(r.kind)}</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {t(`compliance.privacy.dsr.statuses.${r.status}` as MessageKey)}
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {fmt.date(r.createdAt)} · {t("compliance.privacy.dsr.due", { date: fmt.date(r.dueAt) })}
              </Text>
              {r.response ? (
                <Text style={{ ...typography.caption, color: colors.text }}>
                  {t("compliance.privacy.dsr.response")}: {r.response}
                </Text>
              ) : null}
              {r.status === "PENDING" && r.kind !== "UNDERAGE_ACCOUNT" ? (
                <Button
                  label={t("compliance.privacy.dsr.withdraw")}
                  variant="ghost"
                                    disabled={withdraw.isPending}
                  onPress={() =>
                    withdraw.mutate(r.id, {
                      onError: (error) => showToast(errorText(error, t("compliance.privacy.dsr.failed")), "error"),
                    })
                  }
                />
              ) : null}
            </View>
          ))
        )}
      </Card>
      <ActionSheet
        visible={kindOpen}
        onClose={() => setKindOpen(false)}
        header={<Text style={{ ...typography.bodyStrong, color: colors.bright, padding: spacing.lg }}>{t("compliance.privacy.dsr.kindLabel")}</Text>}
        items={DSR_FORM_KINDS.map((k) => ({
          key: k,
          label: kindLabel(k),
          icon: kind === k ? "check" : "file",
          onPress: () => setKind(k),
        }))}
      />
    </>
  );
}

// ── Yasal metinler ─────────────────────────────────────────────────────

const LEGAL_PAGES = {
  kvkkNotice: "/yasal/kvkk-aydinlatma-metni",
  explicitConsent: "/yasal/acik-riza-metni",
  cookies: "/yasal/cerez-politikasi",
  hostingProvider: "/yasal/yer-saglayici-bilgileri",
  transparency: "/yasal/seffaflik-raporu",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export function LegalLinksSection() {
  const t = useT();
  const links: { href: string; label: string }[] = [
    { href: LEGAL_PAGES.kvkkNotice, label: t("compliance.privacy.legal.kvkk") },
    { href: LEGAL_PAGES.explicitConsent, label: t("compliance.privacy.legal.explicit") },
    { href: LEGAL_PAGES.cookies, label: t("compliance.privacy.legal.cookies") },
    { href: LEGAL_PAGES.privacy, label: t("compliance.privacy.legal.privacy") },
    { href: LEGAL_PAGES.terms, label: t("compliance.privacy.legal.terms") },
    { href: LEGAL_PAGES.hostingProvider, label: t("compliance.privacy.legal.provider") },
    { href: LEGAL_PAGES.transparency, label: t("compliance.privacy.legal.transparency") },
  ];
  return (
    <>
      <SectionHeader title={t("compliance.privacy.legal.title").toLocaleUpperCase()} />
      <Desc>{t("compliance.privacy.legal.desc")}</Desc>
      <Card>
        {links.map((link) => (
          <Pressable
            key={link.href}
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${link.href}`).catch(() => {})}
          >
            <Text style={{ ...typography.bodyStrong, color: colors.brand }}>{link.label}</Text>
          </Pressable>
        ))}
      </Card>
    </>
  );
}
