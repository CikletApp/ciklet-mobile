import { useState } from "react";
import { Text, View } from "react-native";

import { ActionSheet, Button, Icon, type IconName, IconButton, Pressable, TextField } from "@/components/ui";
import { automodTimeoutLabel } from "@/lib/automod";
import { validateAutomodRegex } from "@/lib/automod-regex";
import {
  AUTOMOD_KEYWORDS_MAX,
  AUTOMOD_REGEX_PATTERNS_MAX,
  AUTOMOD_RULE_BLOCK_MESSAGE_MAX,
  AUTOMOD_RULE_LIMITS,
  AUTOMOD_RULE_MENTION_LIMIT_MAX,
  AUTOMOD_RULE_NAME_MAX,
  AUTOMOD_RULE_TIMEOUTS,
  AUTOMOD_RULE_TYPES,
  createAutomodRule,
  parseKeywordText,
  type AutomodRuleActions,
  type AutomodRuleType,
  type AutomodRuleV2,
} from "@/lib/automod-rules";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

import { Card, CardHeader, PillPicker, SelectRow, SubTitle, Toggle, ToggleRow, Warning } from "./ui";

const TYPE_ICONS: Record<AutomodRuleType, IconName> = {
  keyword: "list",
  preset: "sparkles",
  mention_spam: "users",
  member_profile: "user",
};

/**
 * Tek kuralın düzenleyicisi — web `automod-rules-editor.tsx` RuleEditor ile
 * aynı alanlar ve metinler. Metin alanları yerel taslakta (yazarken
 * normalleştirme imleci oynatmasın); her değişiklik ayrıştırılıp kurala yazılır.
 */
function RuleEditor({ rule, disabled, roles, channels, onChange }: {
  rule: AutomodRuleV2;
  disabled: boolean;
  roles: { id: string; name: string; color: string | null }[];
  channels: { id: string; name: string }[];
  onChange: (next: AutomodRuleV2) => void;
}) {
  const t = useT();
  const [keywordsText, setKeywordsText] = useState(rule.keywords.join(", "));
  const [regexText, setRegexText] = useState(rule.regexPatterns.join("\n"));
  const [allowText, setAllowText] = useState(rule.allowList.join(", "));
  const [picker, setPicker] = useState<"alert" | "timeout" | null>(null);
  const usesWords = rule.type === "keyword" || rule.type === "member_profile";
  const usesPresets = rule.type === "preset" || rule.type === "member_profile";
  const patch = (p: Partial<AutomodRuleV2>) => onChange({ ...rule, ...p });
  const patchActions = (p: Partial<AutomodRuleActions>) => onChange({ ...rule, actions: { ...rule.actions, ...p } });
  const patterns = regexText.split("\n").map((l) => l.trim()).filter(Boolean);
  const regexErrors = patterns.map((p) => ({ p, e: validateAutomodRegex(p) })).filter((x) => x.e);
  const toggleId = (key: "exemptRoleIds" | "exemptChannelIds", id: string) =>
    patch({ [key]: rule[key].includes(id) ? rule[key].filter((x) => x !== id) : [...rule[key], id] } as Partial<AutomodRuleV2>);
  const noTrigger = usesWords && rule.keywords.length === 0 && patterns.length === 0 && rule.presets.length === 0;
  const alertChannel = channels.find((c) => c.id === rule.actions.alertChannelId);

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
      <TextField label={t("safety.rules.name")} value={rule.name} maxLength={AUTOMOD_RULE_NAME_MAX} editable={!disabled} onChangeText={(v) => patch({ name: v })} />

      {usesWords ? (
        <>
          <SubTitle text={t("safety.rules.keywords")} hint={t("safety.rules.keywordsHint", { max: AUTOMOD_KEYWORDS_MAX })} />
          <TextField
            value={keywordsText}
            editable={!disabled}
            multiline
            autoCapitalize="none"
            onChangeText={(v) => {
              setKeywordsText(v);
              patch({ keywords: parseKeywordText(v) });
            }}
            placeholder={t("safety.rules.keywordsPlaceholder")}
          />
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.rules.keywordsCount", { count: rule.keywords.length })}</Text>

          <SubTitle text={t("safety.rules.regex")} hint={t("safety.rules.regexHint", { max: AUTOMOD_REGEX_PATTERNS_MAX })} />
          <TextField
            value={regexText}
            editable={!disabled}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(v) => {
              setRegexText(v);
              patch({ regexPatterns: v.split("\n").map((l) => l.trim()).filter(Boolean) });
            }}
            placeholder={t("safety.rules.regexPlaceholder")}
          />
          {patterns.length > AUTOMOD_REGEX_PATTERNS_MAX ? <Warning danger text={t("safety.rules.regexTooMany", { max: AUTOMOD_REGEX_PATTERNS_MAX })} /> : null}
          {regexErrors.map((x) => (
            <Warning key={x.p} danger text={t("safety.rules.regexError", { pattern: x.p, error: x.e ?? "" })} />
          ))}
        </>
      ) : null}

      {usesPresets ? (
        <>
          <SubTitle text={t("safety.rules.presets")} />
          <ToggleRow
            title={t("safety.rules.presetProfanity")}
            hint={t("safety.rules.presetProfanityHint")}
            value={rule.presets.includes("profanity")}
            disabled={disabled}
            onChange={(v) => patch({ presets: v ? ["profanity"] : [] })}
          />
        </>
      ) : null}

      {rule.type !== "mention_spam" ? (
        <>
          <SubTitle text={t("safety.rules.allow")} hint={t("safety.rules.allowHint")} />
          <TextField
            value={allowText}
            editable={!disabled}
            multiline
            autoCapitalize="none"
            onChangeText={(v) => {
              setAllowText(v);
              patch({ allowList: parseKeywordText(v, rule.type === "preset" ? 1000 : 100) });
            }}
            placeholder={t("safety.rules.allowPlaceholder")}
          />
        </>
      ) : null}

      {rule.type === "mention_spam" ? (
        <>
          <SubTitle text={t("safety.rules.mentionLimit")} hint={t("safety.rules.mentionLimitHint", { max: AUTOMOD_RULE_MENTION_LIMIT_MAX })} />
          <TextField
            value={String(rule.mentionLimit)}
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={(v) => {
              const n = Number(v.replace(/[^0-9]/g, ""));
              patch({ mentionLimit: Math.min(AUTOMOD_RULE_MENTION_LIMIT_MAX, Math.max(1, n || 1)) });
            }}
          />
          <ToggleRow title={t("safety.rules.raid")} hint={t("safety.rules.raidHint")} value={rule.raidProtection} disabled={disabled} onChange={(v) => patch({ raidProtection: v })} />
        </>
      ) : null}

      {noTrigger ? <Warning text={t("safety.rules.noTrigger")} /> : null}

      <Text style={{ ...typography.overline, color: colors.muted, marginTop: spacing.xs }}>{t("safety.rules.actions").toLocaleUpperCase("tr-TR")}</Text>
      {rule.type !== "member_profile" ? (
        <>
          <ToggleRow title={t("safety.rules.block")} hint={t("safety.rules.blockHint")} value={rule.actions.block} disabled={disabled} onChange={(v) => patchActions({ block: v })} />
          {rule.actions.block ? (
            <TextField
              label={t("safety.rules.blockMessage")}
              value={rule.actions.blockMessage}
              maxLength={AUTOMOD_RULE_BLOCK_MESSAGE_MAX}
              editable={!disabled}
              onChangeText={(v) => patchActions({ blockMessage: v })}
              placeholder={t("safety.rules.blockMessagePlaceholder")}
            />
          ) : null}
        </>
      ) : null}
      <SubTitle text={t("safety.rules.alert")} />
      <SelectRow label={alertChannel ? `#${alertChannel.name}` : t("safety.rules.noAlert")} disabled={disabled} onPress={() => setPicker("alert")} />
      <SubTitle text={t("safety.rules.timeout")} />
      <SelectRow label={automodTimeoutLabel(rule.actions.timeoutSeconds, t)} disabled={disabled} onPress={() => setPicker("timeout")} />
      <Text style={{ ...typography.caption, color: colors.muted }}>{t("safety.rules.alertHint")}</Text>
      <ToggleRow
        title={t("safety.rules.quarantine")}
        hint={rule.type === "member_profile" ? t("safety.rules.quarantineProfileHint") : t("safety.rules.quarantineHint")}
        value={rule.actions.quarantine}
        disabled={disabled || rule.type === "member_profile"}
        onChange={(v) => patchActions({ quarantine: v })}
      />

      <SubTitle text={t("safety.rules.exemptRoles")} />
      <PillPicker
        items={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))}
        selected={rule.exemptRoleIds}
        disabled={disabled}
        emptyLabel={t("safety.rules.none")}
        onToggle={(id) => toggleId("exemptRoleIds", id)}
      />
      {rule.type !== "member_profile" ? (
        <>
          <SubTitle text={t("safety.rules.exemptChannels")} />
          <PillPicker
            items={channels.map((c) => ({ id: c.id, label: `#${c.name}` }))}
            selected={rule.exemptChannelIds}
            disabled={disabled}
            emptyLabel={t("safety.rules.none")}
            onToggle={(id) => toggleId("exemptChannelIds", id)}
          />
        </>
      ) : null}

      <ActionSheet
        visible={picker === "alert"}
        onClose={() => setPicker(null)}
        items={[
          {
            key: "none",
            label: t("safety.rules.noAlert"),
            icon: rule.actions.alertChannelId === null ? "check" : "bell-off",
            onPress: () => {
              patchActions({ alertChannelId: null });
              setPicker(null);
            },
          },
          ...channels.map((c) => ({
            key: c.id,
            label: `#${c.name}`,
            icon: (c.id === rule.actions.alertChannelId ? "check" : "hash") as IconName,
            onPress: () => {
              patchActions({ alertChannelId: c.id });
              setPicker(null);
            },
          })),
        ]}
      />
      <ActionSheet
        visible={picker === "timeout"}
        onClose={() => setPicker(null)}
        items={AUTOMOD_RULE_TIMEOUTS.map((s) => ({
          key: String(s),
          label: automodTimeoutLabel(s, t),
          icon: (s === rule.actions.timeoutSeconds ? "check" : "timer") as IconName,
          onPress: () => {
            patchActions({ timeoutSeconds: s });
            setPicker(null);
          },
        }))}
      />
    </View>
  );
}

/**
 * AutoMod v2 kuralları — web `AutomodRulesEditor` ile aynı: kural listesi,
 * tür başına sınır, satır içi düzenleyici. Kaydet başlıkta; `version`
 * değişince düzenleyiciler yeniden kurulur (taslak metinler sıfırlanır).
 */
export function AutomodRulesEditor({ rules, legacy, disabled, roles, channels, version, onChange }: {
  rules: AutomodRuleV2[];
  legacy: boolean;
  disabled: boolean;
  roles: { id: string; name: string; color: string | null }[];
  channels: { id: string; name: string }[];
  version: number;
  onChange: (next: AutomodRuleV2[]) => void;
}) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const count = (type: AutomodRuleType) => rules.filter((r) => r.type === type).length;

  const add = (type: AutomodRuleType) => {
    const rule = createAutomodRule(type, t(`safety.rules.type.${type}`));
    onChange([...rules, rule]);
    setOpenId(rule.id);
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader icon="list" title={t("safety.rules.title")} description={t("safety.rules.description", { max: AUTOMOD_RULE_LIMITS.keyword })} />
      {!disabled ? <Button label={t("safety.rules.add")} icon="plus" variant={adding ? "secondary" : "primary"} onPress={() => setAdding((v) => !v)} /> : null}
      {legacy && rules.length > 0 ? <Warning text={t("safety.rules.legacyNote")} /> : null}

      {adding ? (
        <View style={{ gap: spacing.xs }}>
          {AUTOMOD_RULE_TYPES.map((type) => {
            const full = count(type) >= AUTOMOD_RULE_LIMITS[type];
            return (
              <Pressable
                key={type}
                disabled={full}
                onPress={() => add(type)}
                haptic="light"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.raised : "transparent",
                  opacity: full ? 0.5 : 1,
                })}
              >
                <Icon name={TYPE_ICONS[type]} size={16} color={colors.brand} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>
                    {t(`safety.rules.type.${type}`)}
                    {type === "keyword" ? <Text style={{ color: colors.muted }}>{` (${count(type)}/${AUTOMOD_RULE_LIMITS.keyword})`}</Text> : null}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>{full ? t("safety.rules.limitReached") : t(`safety.rules.typeHint.${type}`)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {rules.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", paddingVertical: spacing.md }}>{t("safety.rules.empty")}</Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {rules.map((rule) => {
            const open = openId === rule.id;
            return (
              <View key={`${rule.id}:${version}`} style={{ padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Icon name={TYPE_ICONS[rule.type]} size={16} color={colors.brand} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{rule.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>{t(`safety.rules.type.${rule.type}`)}</Text>
                  </View>
                  <Toggle value={rule.enabled} disabled={disabled} onChange={(v) => onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: v } : r)))} />
                  <IconButton icon={open ? "check" : "pencil"} label={open ? t("safety.rules.done") : t("safety.rules.edit")} onPress={() => setOpenId(open ? null : rule.id)} />
                  {!disabled ? (
                    <IconButton icon="trash" label={t("safety.rules.delete")} tint={colors.danger} onPress={() => onChange(rules.filter((r) => r.id !== rule.id))} />
                  ) : null}
                </View>
                {open ? (
                  <RuleEditor
                    rule={rule}
                    disabled={disabled}
                    roles={roles}
                    channels={channels}
                    onChange={(next) => onChange(rules.map((r) => (r.id === rule.id ? next : r)))}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
