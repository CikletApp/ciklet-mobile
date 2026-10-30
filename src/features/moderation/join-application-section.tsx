import { useState } from "react";
import { Text, View } from "react-native";

import { ApiError } from "@/api/client";
import { usePendingApplications, useReviewApplication } from "@/api/hooks";
import { ActionSheet, Avatar, Button, type IconName, showToast, TextField } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import {
  JOIN_APPLICATION_MAX_QUESTIONS,
  JOIN_DESCRIPTION_MAX,
  JOIN_QUESTION_LABEL_MAX,
  JOIN_QUESTION_TYPES,
  JOIN_REJECT_REASON_MAX,
  newQuestionId,
  type JoinApplicationConfig,
  type JoinQuestion,
} from "@/lib/join-application";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { Card, CardHeader, SelectRow, SubTitle, Toggle, ToggleRow } from "./ui";

function QuestionEditor({ question, disabled, onChange, onRemove }: {
  question: JoinQuestion;
  disabled: boolean;
  onChange: (q: JoinQuestion) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [optionsText, setOptionsText] = useState(question.options.join("\n"));
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
      <TextField
        value={question.label}
        maxLength={JOIN_QUESTION_LABEL_MAX}
        editable={!disabled}
        placeholder={t("safety.application.questionPlaceholder")}
        onChangeText={(v) => onChange({ ...question, label: v })}
      />
      <SelectRow label={t(`safety.application.type.${question.type}`)} disabled={disabled} onPress={() => setPicker(true)} />
      {question.type === "choice" ? (
        <>
          <SubTitle text={t("safety.application.options")} />
          <TextField
            value={optionsText}
            multiline
            editable={!disabled}
            placeholder={t("safety.application.optionsPlaceholder")}
            onChangeText={(v) => {
              setOptionsText(v);
              onChange({ ...question, options: v.split("\n").map((o) => o.trim()).filter(Boolean) });
            }}
          />
        </>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Toggle value={question.required} disabled={disabled} onChange={(v) => onChange({ ...question, required: v })} />
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.application.required")}</Text>
        </View>
        {!disabled ? <Button label={t("safety.application.remove")} icon="trash" variant="ghost" onPress={onRemove} /> : null}
      </View>
      <ActionSheet
        visible={picker}
        onClose={() => setPicker(false)}
        items={JOIN_QUESTION_TYPES.map((type) => ({
          key: type,
          label: t(`safety.application.type.${type}`),
          icon: (type === question.type ? "check" : "list") as IconName,
          onPress: () => {
            onChange({ ...question, type });
            setPicker(false);
          },
        }))}
      />
    </View>
  );
}

/** Bekleyen başvurular (moderatör kuyruğu) — onay / sebepli ret anında uygulanır. */
function ApplicationQueue({ serverId, canReview }: { serverId: string; canReview: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { data } = usePendingApplications(serverId);
  const review = useReviewApplication(serverId);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const items = data ?? [];
  const dateLocale = locale === "en" ? "en-US" : "tr-TR";

  const run = (id: string, action: "approve" | "reject") =>
    review.mutate(
      { applicationId: id, action, reason: action === "reject" ? reason.trim() : undefined },
      {
        onSuccess: () => {
          setRejecting(null);
          setReason("");
          showToast(action === "approve" ? t("safety.application.approved") : t("safety.application.rejected"));
        },
        onError: (e) => showToast(e instanceof ApiError ? e.message : t("safety.security.failed"), "error"),
      }
    );

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <SubTitle text={t("safety.application.queue", { count: items.length })} />
      {items.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.application.queueEmpty")}</Text>
      ) : (
        items.map((a) => (
          <View key={a.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.raised }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Avatar imageUrl={a.profile.imageUrl} fallbackText={a.profile.username} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{a.profile.name || a.profile.username}</Text>
                <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
                  {`@${a.profile.username} · ${t("safety.application.accountCreated", { date: new Date(a.profile.createdAt).toLocaleDateString(dateLocale) })} · ${t("safety.application.appliedAt", { date: new Date(a.createdAt).toLocaleDateString(dateLocale) })}`}
                </Text>
              </View>
            </View>
            {a.answers.map((ans) => (
              <View key={ans.questionId} style={{ gap: 2 }}>
                <Text style={{ ...typography.overline, color: colors.muted }}>{ans.label.toLocaleUpperCase("tr-TR")}</Text>
                <Text style={{ ...typography.body, color: colors.text }}>{ans.value}</Text>
              </View>
            ))}
            {canReview ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label={t("safety.application.approve")} icon="check" disabled={review.isPending} onPress={() => run(a.id, "approve")} />
                <Button label={t("safety.application.reject")} icon="close" variant="danger" disabled={review.isPending} onPress={() => setRejecting(rejecting === a.id ? null : a.id)} />
              </View>
            ) : null}
            {rejecting === a.id ? (
              <View style={{ gap: spacing.sm }}>
                <TextField value={reason} maxLength={JOIN_REJECT_REASON_MAX} placeholder={t("safety.application.rejectReason")} onChangeText={setReason} />
                <Button label={t("safety.application.reject")} variant="danger" loading={review.isPending} onPress={() => run(a.id, "reject")} />
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Katılım Başvurusu — web `join-application-section.tsx` ile aynı: form
 * ayarı başlıktaki Kaydet ile gider; kuyruk anında işler.
 */
export function JoinApplicationSection({ serverId, config, disabled, canReview, hasRules, version, onChange }: {
  serverId: string;
  config: JoinApplicationConfig;
  disabled: boolean;
  canReview: boolean;
  hasRules: boolean;
  version: number;
  onChange: (next: JoinApplicationConfig) => void;
}) {
  const t = useT();
  const patch = (p: Partial<JoinApplicationConfig>) => onChange({ ...config, ...p });
  const addQuestion = () => patch({ questions: [...config.questions, { id: newQuestionId(), type: "short", label: "", required: true, options: [] }] });

  return (
    <Card>
      <CardHeader
        icon="list"
        title={t("safety.application.title")}
        description={t("safety.application.description")}
        toggle={<Toggle value={config.enabled} disabled={disabled} onChange={(v) => patch({ enabled: v })} />}
      />
      {config.enabled ? (
        <View style={{ gap: spacing.sm }}>
          <SubTitle text={t("safety.application.formDescription")} />
          <TextField
            value={config.description}
            multiline
            maxLength={JOIN_DESCRIPTION_MAX}
            editable={!disabled}
            placeholder={t("safety.application.formDescriptionPlaceholder")}
            onChangeText={(v) => patch({ description: v })}
          />
          <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>
            {t("safety.application.questions", { count: config.questions.length, max: JOIN_APPLICATION_MAX_QUESTIONS })}
          </Text>
          {config.questions.map((q) => (
            <QuestionEditor
              key={`${q.id}:${version}`}
              question={q}
              disabled={disabled}
              onChange={(next) => patch({ questions: config.questions.map((x) => (x.id === q.id ? next : x)) })}
              onRemove={() => patch({ questions: config.questions.filter((x) => x.id !== q.id) })}
            />
          ))}
          {!disabled && config.questions.length < JOIN_APPLICATION_MAX_QUESTIONS ? (
            <Button label={t("safety.application.addQuestion")} icon="plus" variant="secondary" onPress={addQuestion} />
          ) : null}
          <ToggleRow
            title={t("safety.application.requireRules")}
            hint={t("safety.application.requireRulesHint")}
            value={config.requireRules}
            disabled={disabled || !hasRules}
            onChange={(v) => patch({ requireRules: v })}
          />
        </View>
      ) : null}
      <ApplicationQueue serverId={serverId} canReview={canReview} />
    </Card>
  );
}
