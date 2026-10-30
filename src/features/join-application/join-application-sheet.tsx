import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, View } from "react-native";
import { create } from "zustand";

import { ApiError } from "@/api/client";
import { useJoinApplicationForm, useSubmitJoinApplication } from "@/api/hooks";
import { Button, Icon, Pressable, showToast, TextField } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { answerMax } from "@/lib/join-application";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Katılım başvurusu formu (Discord "Apply to Join") — web
 * `join-application-dialog.tsx` ile aynı akış ve metinler. Davetle ya da
 * keşfetten katılım `code: "application_required"` dönünce açılır.
 */
interface JoinApplicationStore {
  serverId: string | null;
  code: string | null;
  open: (serverId: string, code?: string | null) => void;
  close: () => void;
}

export const useJoinApplicationStore = create<JoinApplicationStore>((set) => ({
  serverId: null,
  code: null,
  open: (serverId, code = null) => set({ serverId, code }),
  close: () => set({ serverId: null, code: null }),
}));

/** Katılım hatası başvuru gerektiriyorsa formu açar; true = açıldı. */
export function openApplicationIfRequired(error: unknown, fallbackServerId: string, code?: string | null): boolean {
  if (!(error instanceof ApiError) || error.code !== "application_required") return false;
  const body = error.body as { serverId?: unknown } | undefined;
  useJoinApplicationStore.getState().open(typeof body?.serverId === "string" ? body.serverId : fallbackServerId, code ?? null);
  return true;
}

function ApplicationForm({ serverId, code, onClose }: { serverId: string; code: string | null; onClose: () => void }) {
  const t = useT();
  const form = useJoinApplicationForm(serverId, code);
  const submit = useSubmitJoinApplication(serverId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [reapply, setReapply] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!form.error) return;
    showToast(form.error instanceof ApiError ? form.error.message : t("safety.security.failed"), "error");
    onClose();
  }, [form.error, onClose, t]);

  const data = form.data;
  const status = submitted ? "PENDING" : (data?.application?.status ?? null);
  const showForm = data && (status === null || status === "APPROVED" || reapply);
  const missingRequired = data?.questions.some((q) => q.required && !(answers[q.id] ?? "").trim()) ?? true;
  const canSubmit = Boolean(data) && !missingRequired && (!data?.requireRules || rulesAccepted) && !submit.isPending;

  const send = () =>
    submit.mutate(
      { code, rulesAccepted, answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })) },
      {
        onSuccess: () => {
          showToast(t("safety.application.submitted"));
          setSubmitted(true);
          setReapply(false);
        },
        onError: (e) => showToast(e instanceof ApiError ? e.message : t("safety.security.failed"), "error"),
      }
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Icon name="list" size={18} color={colors.brand} />
        <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }} numberOfLines={2}>
          {data ? t("safety.application.formTitle", { server: data.server.name }) : t("safety.application.title")}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t("safety.application.cancel")} hitSlop={12}>
          <Icon name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
      {!data ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
          {data.description ? <Text style={{ ...typography.body, color: colors.muted }}>{data.description}</Text> : null}
          {!showForm ? (
            <View style={{ gap: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.text }}>
                {status === "PENDING" ? t("safety.application.pending") : t("safety.application.rejectedStatus")}
              </Text>
              {status === "REJECTED" && data.application?.rejectionReason ? (
                <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.raised }}>
                  {data.application.rejectionReason}
                </Text>
              ) : null}
              {status === "REJECTED" ? <Button label={t("safety.application.reapply")} onPress={() => setReapply(true)} /> : null}
            </View>
          ) : (
            <>
              {data.questions.map((q) => (
                <View key={q.id} style={{ gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.bright }}>
                    {q.label}
                    {q.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                  </Text>
                  {q.type === "choice" ? (
                    q.options.map((o) => {
                      const on = answers[q.id] === o;
                      return (
                        <Pressable
                          key={o}
                          onPress={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                          haptic="light"
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={{
                            padding: spacing.md,
                            borderRadius: radii.lg,
                            borderWidth: 1,
                            borderColor: on ? colors.brand : colors.border,
                            backgroundColor: on ? colors.brandSoft : "transparent",
                          }}
                        >
                          <Text style={{ ...typography.body, color: on ? colors.bright : colors.text }}>{o}</Text>
                        </Pressable>
                      );
                    })
                  ) : (
                    <TextField
                      value={answers[q.id] ?? ""}
                      multiline={q.type === "paragraph"}
                      maxLength={answerMax(q.type)}
                      placeholder={t("safety.application.answerPlaceholder")}
                      onChangeText={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                  )}
                </View>
              ))}
              {data.requireRules && data.rulesText ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ ...typography.overline, color: colors.muted }}>{t("safety.application.rules").toLocaleUpperCase("tr-TR")}</Text>
                  <Text style={{ ...typography.caption, color: colors.text, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.raised }}>{data.rulesText}</Text>
                  <Pressable
                    onPress={() => setRulesAccepted((v) => !v)}
                    haptic="light"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: rulesAccepted }}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: rulesAccepted ? colors.brand : colors.border,
                        backgroundColor: rulesAccepted ? colors.brand : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {rulesAccepted ? <Icon name="check" size={14} color="#ffffff" /> : null}
                    </View>
                    <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>{t("safety.application.rulesAccept")}</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
                <Button label={t("safety.application.cancel")} variant="ghost" onPress={onClose} />
                <Button label={t("safety.application.submit")} onPress={send} loading={submit.isPending} disabled={!canSubmit} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** Kök düzene bir kez yerleşir; depo açınca form gelir. */
export function JoinApplicationHost() {
  const { serverId, code, close } = useJoinApplicationStore();
  return (
    <Modal visible={Boolean(serverId)} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      {serverId ? <ApplicationForm key={`${serverId}:${code ?? ""}`} serverId={serverId} code={code} onClose={close} /> : null}
    </Modal>
  );
}
