import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable as RNPressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useMyPermissions,
  useServerChannels,
  useServerModeration,
  useServerRoleDetails,
  useUpdateServerModeration,
  type ServerModerationSettings,
} from "@/api/hooks";
import {
  ActionSheet,
  Button,
  EmptyState,
  Icon,
  type IconName,
  KeyboardAvoider,
  Pressable,
  Screen,
  ScreenLoader,
  TextField,
  showToast,
} from "@/components/ui";
import {
  AUTOMOD_BLOCK_MESSAGE_MAX,
  AUTOMOD_CAPS_MIN_LETTERS_RANGE,
  AUTOMOD_CAPS_PERCENT_RANGE,
  AUTOMOD_MAX_DOMAINS,
  AUTOMOD_MAX_WORDS,
  AUTOMOD_MENTION_LIMIT_MAX,
  AUTOMOD_SPAM_DUPLICATES_RANGE,
  AUTOMOD_SPAM_MESSAGES_RANGE,
  AUTOMOD_SPAM_WINDOW_RANGE,
  AUTOMOD_TIMEOUT_OPTIONS,
  RULES_TEXT_MAX,
  VERIFICATION_LEVELS,
  automodTimeoutLabel,
  isRaidLocked,
  normalizeAutomodRules,
  normalizeMentionLimit,
  parseBlockedWordsText,
  parseDomainsText,
  parseVerificationLevel,
  type AutomodRules,
} from "@/lib/automod";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Düzenleme taslağı (web moderation-tab `AutomodDraft`): sayı alanları
 * metin (yazarken boş/yarım değer kalabilsin), kayıtta lib/automod
 * normalize eder.
 */
interface AutomodDraft {
  mentionLimit: string;
  linkFilter: boolean;
  domainsText: string;
  timeoutSeconds: number;
  alertChannelId: string | null;
  profanityPreset: boolean;
  allowWordsText: string;
  inviteFilter: boolean;
  blockedDomainsText: string;
  capsFilter: boolean;
  capsPercent: string;
  capsMinLetters: string;
  spamFilter: boolean;
  spamMaxMessages: string;
  spamWindowSeconds: string;
  spamMaxDuplicates: string;
  profileFilter: boolean;
  warnInChannel: boolean;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
  blockMessage: string;
}

interface ModerationDraft {
  level: number;
  wordsText: string;
  rulesRequired: boolean;
  rulesText: string;
  automod: AutomodDraft;
}

function automodDraftFrom(base: {
  mentionLimit: number;
  linkFilter: boolean;
  allowedDomains: string[];
  timeoutSeconds: number;
  alertChannelId: string | null;
  rules: AutomodRules;
}): AutomodDraft {
  const r = base.rules;
  return {
    mentionLimit: base.mentionLimit ? String(base.mentionLimit) : "",
    linkFilter: base.linkFilter,
    domainsText: base.allowedDomains.join(", "),
    timeoutSeconds: base.timeoutSeconds,
    alertChannelId: base.alertChannelId,
    profanityPreset: r.profanityPreset,
    allowWordsText: r.allowWords.join(", "),
    inviteFilter: r.inviteFilter,
    blockedDomainsText: r.blockedDomains.join(", "),
    capsFilter: r.capsFilter,
    capsPercent: String(r.capsPercent),
    capsMinLetters: String(r.capsMinLetters),
    spamFilter: r.spamFilter,
    spamMaxMessages: String(r.spamMaxMessages),
    spamWindowSeconds: String(r.spamWindowSeconds),
    spamMaxDuplicates: String(r.spamMaxDuplicates),
    profileFilter: r.profileFilter,
    warnInChannel: r.warnInChannel,
    exemptRoleIds: r.exemptRoleIds,
    exemptChannelIds: r.exemptChannelIds,
    blockMessage: r.blockMessage,
  };
}

function draftFrom(server: ServerModerationSettings): ModerationDraft {
  return {
    level: parseVerificationLevel(server.verificationLevel),
    wordsText: (server.blockedWords ?? []).join(", "),
    rulesRequired: Boolean(server.rulesRequired),
    rulesText: server.rulesText ?? "",
    automod: automodDraftFrom({
      mentionLimit: server.automodMentionLimit ?? 0,
      linkFilter: Boolean(server.automodLinkFilter),
      allowedDomains: server.automodAllowedDomains ?? [],
      timeoutSeconds: server.automodTimeoutSeconds ?? 0,
      alertChannelId: server.automodAlertChannelId ?? null,
      rules: normalizeAutomodRules(server.automodRules),
    }),
  };
}

function rulesFromDraft(d: AutomodDraft): AutomodRules {
  return normalizeAutomodRules({
    profanityPreset: d.profanityPreset,
    allowWords: parseBlockedWordsText(d.allowWordsText),
    inviteFilter: d.inviteFilter,
    blockedDomains: parseDomainsText(d.blockedDomainsText),
    capsFilter: d.capsFilter,
    capsPercent: d.capsPercent,
    capsMinLetters: d.capsMinLetters,
    spamFilter: d.spamFilter,
    spamMaxMessages: d.spamMaxMessages,
    spamWindowSeconds: d.spamWindowSeconds,
    spamMaxDuplicates: d.spamMaxDuplicates,
    profileFilter: d.profileFilter,
    warnInChannel: d.warnInChannel,
    exemptRoleIds: d.exemptRoleIds,
    exemptChannelIds: d.exemptChannelIds,
    blockMessage: d.blockMessage,
  });
}

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

/**
 * Sunucu Ayarları › Moderasyon — web `moderation-tab.tsx`'in mobil
 * karşılığı: kural kabul ekranı, doğrulama seviyesi, baskın kilidi ve
 * AutoMod (Türkçe hazır küfür filtresi + izin listesi, yasaklı kelimeler,
 * bahsetme seli, spam sezgisi, büyük harf seli, bağlantı/davet/engelli alan
 * filtreleri, profil süzgeci, eylemler, muafiyetler). Kaydet başlıkta
 * (settings.tsx deseni); web gibi tek PATCH. AutoMod metinleri i18n
 * (automod.settings.*). Yetki "Sunucuyu Yönet" — uç da denetler.
 */
export default function ServerModerationScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const t = useT();
  const { data: server, isLoading, error } = useServerModeration(serverId);
  const { data: permissions } = useMyPermissions(serverId);
  const { data: channels } = useServerChannels(serverId);
  const { data: roles } = useServerRoleDetails(serverId);
  const update = useUpdateServerModeration(serverId);

  const [draft, setDraft] = useState<ModerationDraft | null>(null);
  const [saved, setSaved] = useState<ModerationDraft | null>(null);
  const [picker, setPicker] = useState<"level" | "timeout" | "alert" | null>(null);

  useEffect(() => {
    if (!server || saved) return;
    const initial = draftFrom(server);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setSaved(initial);
  }, [server, saved]);

  if (isLoading || (server && !draft)) return <ScreenLoader label="Moderasyon ayarları yükleniyor…" />;
  if (error || !server || !draft || !saved) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Moderasyon" }} />
        <EmptyState icon="shield" title={error instanceof ApiError ? error.message : "Moderasyon ayarları yüklenemedi."} />
      </Screen>
    );
  }

  const canManage = hasServerPermission(permissions, "MANAGE_SERVER");
  const disabled = !canManage;
  const automod = draft.automod;
  const patch = (next: Partial<ModerationDraft>) => setDraft((current) => (current ? { ...current, ...next } : current));
  const patchAutomod = (next: Partial<AutomodDraft>) =>
    setDraft((current) => (current ? { ...current, automod: { ...current.automod, ...next } } : current));
  const toggleIn = (key: "exemptRoleIds" | "exemptChannelIds", id: string) =>
    patchAutomod({ [key]: automod[key].includes(id) ? automod[key].filter((x) => x !== id) : [...automod[key], id] });

  const textChannels = (channels ?? []).filter((c) => c.type === ChannelType.TEXT);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = isRaidLocked(server.raidLockUntil);
  const wordCount = parseBlockedWordsText(draft.wordsText).length;
  const alertChannel = textChannels.find((c) => c.id === automod.alertChannelId);

  const save = () => {
    if (!canManage || !dirty || update.isPending) return;
    const blockedWords = parseBlockedWordsText(draft.wordsText);
    const mentionLimit = normalizeMentionLimit(automod.mentionLimit);
    const domains = parseDomainsText(automod.domainsText);
    const rules = rulesFromDraft(automod);
    update.mutate(
      {
        verificationLevel: draft.level,
        blockedWords,
        rulesRequired: draft.rulesRequired,
        rulesText: draft.rulesText.trim() || null,
        automodMentionLimit: mentionLimit,
        automodLinkFilter: automod.linkFilter,
        automodAllowedDomains: domains,
        automodTimeoutSeconds: automod.timeoutSeconds,
        automodAlertChannelId: automod.alertChannelId,
        automodRules: rules,
      },
      {
        onSuccess: () => {
          const normalized: ModerationDraft = {
            level: draft.level,
            wordsText: blockedWords.join(", "),
            rulesRequired: draft.rulesRequired,
            rulesText: draft.rulesText,
            automod: automodDraftFrom({
              mentionLimit,
              linkFilter: automod.linkFilter,
              allowedDomains: domains,
              timeoutSeconds: automod.timeoutSeconds,
              alertChannelId: automod.alertChannelId,
              rules,
            }),
          };
          setDraft(normalized);
          setSaved(normalized);
          showToast("Moderasyon ayarları kaydedildi.");
        },
        onError: (reason) => showToast(reason instanceof ApiError ? reason.message : "Kaydedilemedi.", "error"),
      }
    );
  };

  const reset = () => setDraft(saved);

  const clearRaidLock = () => {
    update.mutate(
      { clearRaidLock: true },
      {
        onSuccess: () => showToast("Baskın kilidi kaldırıldı."),
        onError: (reason) => showToast(reason instanceof ApiError ? reason.message : "Kilit kaldırılamadı.", "error"),
      }
    );
  };

  const levelOption = VERIFICATION_LEVELS.find((l) => l.value === draft.level) ?? VERIFICATION_LEVELS[0];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Moderasyon",
          headerRight: canManage
            ? () => (
                <RNPressable onPress={save} disabled={!dirty || update.isPending} accessibilityRole="button">
                  {update.isPending ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <Text style={{ ...typography.bodyStrong, color: dirty ? colors.brand : colors.muted }}>Kaydet</Text>
                  )}
                </RNPressable>
              )
            : undefined,
        }}
      />
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
          {dirty ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.raised }}>
              <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>Kaydedilmemiş değişikliklerin var.</Text>
              <Button label="Geri Al" variant="ghost" onPress={reset} />
              <Button label="Kaydet" onPress={save} loading={update.isPending} disabled={!canManage} />
            </View>
          ) : null}

          {/* Kural kabul ekranı */}
          <Card>
            <CardHeader
              icon="list"
              title="Kural Kabul Ekranı"
              description="Açıkken üyeler kuralları kabul etmeden mesaj gönderemez; sahip ve yöneticiler muaf. Mevcut üyeler de ilk mesajdan önce kabul eder."
              toggle={<Toggle value={draft.rulesRequired} disabled={disabled} onChange={(v) => patch({ rulesRequired: v })} />}
            />
            <TextField
              value={draft.rulesText}
              editable={!disabled}
              multiline
              maxLength={RULES_TEXT_MAX}
              onChangeText={(v) => patch({ rulesText: v })}
              placeholder={"1. Saygılı ol.\n2. Spam yok.\n3. Kanal konularına uy."}
            />
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "right" }}>{`${draft.rulesText.length}/${RULES_TEXT_MAX}`}</Text>
            {draft.rulesRequired && !draft.rulesText.trim() ? <Warning text="Metin boşken kapı devreye girmez." /> : null}
          </Card>

          {/* Doğrulama seviyesi */}
          <Card>
            <CardHeader icon="shield" title="Doğrulama Seviyesi" description="Yeni üyelerin katılmadan önce sağlaması gereken şart. Mevcut üyeleri etkilemez." />
            <SelectRow label={`${levelOption.label} — ${levelOption.desc}`} disabled={disabled} onPress={() => setPicker("level")} />
          </Card>

          {/* Baskın koruması */}
          <Card>
            <CardHeader icon="flag" title="Baskın Koruması" description="Bir dakikada 10 ve üzeri katılım olursa sunucu 10 dakika yeni katılımlara kapanır; denetim günlüğüne düşer." />
            {locked ? (
              <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: `${colors.danger}1a` }}>
                <Text style={{ ...typography.caption, ...fw(600), color: colors.danger }}>
                  {`Kilit etkin: ${formatTime(server.raidLockUntil!)}'e kadar katılım kapalı.`}
                </Text>
                {canManage ? <Button label="Kilidi kaldır" variant="danger" onPress={clearRaidLock} loading={update.isPending} /> : null}
              </View>
            ) : (
              <Text style={{ ...typography.body, color: colors.bright }}>Kilit yok; katılımlar normal.</Text>
            )}
          </Card>

          {/* Türkçe hazır küfür filtresi: tek dokunuşla açılan ön ayar. */}
          <Card highlight={!automod.profanityPreset}>
            <CardHeader
              icon="sparkles"
              title={t("automod.settings.preset.title")}
              description={t("automod.settings.preset.description")}
              toggle={automod.profanityPreset ? <Toggle value disabled={disabled} onChange={(v) => patchAutomod({ profanityPreset: v })} /> : null}
            />
            {!automod.profanityPreset ? (
              <Button label={t("automod.settings.preset.enable")} disabled={disabled} onPress={() => patchAutomod({ profanityPreset: true })} />
            ) : null}
            <SubTitle text={t("automod.settings.preset.allowTitle")} hint={t("automod.settings.preset.allowDescription")} />
            <TextField
              value={automod.allowWordsText}
              editable={!disabled}
              multiline
              autoCapitalize="none"
              onChangeText={(v) => patchAutomod({ allowWordsText: v })}
              placeholder={t("automod.settings.preset.allowPlaceholder")}
            />
          </Card>

          {/* Yasaklı kelimeler */}
          <Card>
            <CardHeader title={t("automod.settings.words.title")} description={t("automod.settings.words.description", { max: AUTOMOD_MAX_WORDS })} />
            <TextField
              value={draft.wordsText}
              editable={!disabled}
              multiline
              autoCapitalize="none"
              onChangeText={(v) => patch({ wordsText: v })}
              placeholder={t("automod.settings.words.placeholder")}
            />
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("automod.settings.words.count", { count: wordCount })}</Text>
          </Card>

          {/* Bahsetme seli */}
          <Card>
            <CardHeader icon="users" title={t("automod.settings.mentions.title")} description={t("automod.settings.mentions.description", { max: AUTOMOD_MENTION_LIMIT_MAX })} />
            <TextField
              value={automod.mentionLimit}
              editable={!disabled}
              keyboardType="number-pad"
              onChangeText={(v) => patchAutomod({ mentionLimit: digitsOnly(v) })}
              placeholder={t("automod.settings.mentions.off")}
            />
          </Card>

          {/* Spam sezgisi */}
          <Card>
            <CardHeader
              icon="rotate-ccw"
              title={t("automod.settings.spam.title")}
              description={t("automod.settings.spam.description")}
              toggle={<Toggle value={automod.spamFilter} disabled={disabled} onChange={(v) => patchAutomod({ spamFilter: v })} />}
            />
            <NumberField label={t("automod.settings.spam.maxMessages")} value={automod.spamMaxMessages} range={AUTOMOD_SPAM_MESSAGES_RANGE} disabled={disabled || !automod.spamFilter} onChange={(v) => patchAutomod({ spamMaxMessages: v })} />
            <NumberField label={t("automod.settings.spam.window")} value={automod.spamWindowSeconds} range={AUTOMOD_SPAM_WINDOW_RANGE} disabled={disabled || !automod.spamFilter} onChange={(v) => patchAutomod({ spamWindowSeconds: v })} />
            <NumberField label={t("automod.settings.spam.duplicates")} value={automod.spamMaxDuplicates} range={AUTOMOD_SPAM_DUPLICATES_RANGE} disabled={disabled || !automod.spamFilter} onChange={(v) => patchAutomod({ spamMaxDuplicates: v })} />
          </Card>

          {/* Büyük harf seli */}
          <Card>
            <CardHeader
              icon="message"
              title={t("automod.settings.caps.title")}
              description={t("automod.settings.caps.description")}
              toggle={<Toggle value={automod.capsFilter} disabled={disabled} onChange={(v) => patchAutomod({ capsFilter: v })} />}
            />
            <NumberField label={t("automod.settings.caps.percent")} value={automod.capsPercent} range={AUTOMOD_CAPS_PERCENT_RANGE} disabled={disabled || !automod.capsFilter} onChange={(v) => patchAutomod({ capsPercent: v })} />
            <NumberField label={t("automod.settings.caps.minLetters")} value={automod.capsMinLetters} range={AUTOMOD_CAPS_MIN_LETTERS_RANGE} disabled={disabled || !automod.capsFilter} onChange={(v) => patchAutomod({ capsMinLetters: v })} />
          </Card>

          {/* Bağlantı filtresi + davet + engelli alanlar */}
          <Card>
            <CardHeader
              icon="link"
              title={t("automod.settings.linkFilter.title")}
              description={t("automod.settings.linkFilter.description", { max: AUTOMOD_MAX_DOMAINS })}
              toggle={<Toggle value={automod.linkFilter} disabled={disabled} onChange={(v) => patchAutomod({ linkFilter: v })} />}
            />
            <TextField
              value={automod.domainsText}
              editable={!disabled && automod.linkFilter}
              multiline
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={(v) => patchAutomod({ domainsText: v })}
              placeholder="youtube.com, github.com"
            />
            {automod.linkFilter && parseDomainsText(automod.domainsText).length === 0 ? <Warning text={t("automod.settings.linkFilter.emptyWarning")} /> : null}

            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <SubTitle text={t("automod.settings.links.inviteTitle")} hint={t("automod.settings.links.inviteDescription")} />
              </View>
              <Toggle value={automod.inviteFilter} disabled={disabled} onChange={(v) => patchAutomod({ inviteFilter: v })} />
            </View>

            <SubTitle text={t("automod.settings.links.blockedTitle")} hint={t("automod.settings.links.blockedDescription")} />
            <TextField
              value={automod.blockedDomainsText}
              editable={!disabled}
              multiline
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={(v) => patchAutomod({ blockedDomainsText: v })}
              placeholder="ornek-kumar.com, phishing.example"
            />
          </Card>

          {/* Profil süzgeci */}
          <Card>
            <CardHeader
              icon="user"
              title={t("automod.settings.profile.title")}
              description={t("automod.settings.profile.description")}
              toggle={<Toggle value={automod.profileFilter} disabled={disabled} onChange={(v) => patchAutomod({ profileFilter: v })} />}
            />
          </Card>

          {/* Eylemler */}
          <Card>
            <CardHeader icon="timer" title={t("automod.settings.actionsSection.title")} description={t("automod.settings.actionsSection.description")} />
            <SubTitle text={t("automod.settings.actionsSection.timeout")} />
            <SelectRow label={automodTimeoutLabel(automod.timeoutSeconds, t)} disabled={disabled} onPress={() => setPicker("timeout")} />
            <SubTitle text={t("automod.settings.actionsSection.alertChannel")} />
            <SelectRow
              label={alertChannel ? `#${alertChannel.name}` : t("automod.settings.actionsSection.noAlert")}
              disabled={disabled}
              onPress={() => setPicker("alert")}
            />

            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <SubTitle text={t("automod.settings.actions.warnTitle")} hint={t("automod.settings.actions.warnDescription")} />
              </View>
              <Toggle value={automod.warnInChannel} disabled={disabled} onChange={(v) => patchAutomod({ warnInChannel: v })} />
            </View>

            <SubTitle text={t("automod.settings.actions.blockMessageTitle")} hint={t("automod.settings.actions.blockMessageDescription")} />
            <TextField
              value={automod.blockMessage}
              editable={!disabled}
              maxLength={AUTOMOD_BLOCK_MESSAGE_MAX}
              onChangeText={(v) => patchAutomod({ blockMessage: v })}
              placeholder={t("automod.settings.actions.blockMessagePlaceholder")}
            />
          </Card>

          {/* Muafiyetler */}
          <Card>
            <CardHeader icon="eye-off" title={t("automod.settings.exempt.title")} description={t("automod.settings.exempt.description")} />
            <SubTitle text={t("automod.settings.exempt.roles")} />
            <PillPicker
              items={(roles ?? []).map((r) => ({ id: r.id, label: r.name, color: r.color }))}
              selected={automod.exemptRoleIds}
              disabled={disabled}
              emptyLabel={t("automod.settings.exempt.none")}
              onToggle={(id) => toggleIn("exemptRoleIds", id)}
            />
            <SubTitle text={t("automod.settings.exempt.channels")} />
            <PillPicker
              items={textChannels.map((c) => ({ id: c.id, label: `#${c.name}` }))}
              selected={automod.exemptChannelIds}
              disabled={disabled}
              emptyLabel={t("automod.settings.exempt.none")}
              onToggle={(id) => toggleIn("exemptChannelIds", id)}
            />
          </Card>

        </ScrollView>
      </KeyboardAvoider>

      <ActionSheet
        visible={picker === "level"}
        onClose={() => setPicker(null)}
        items={VERIFICATION_LEVELS.map((l) => ({
          key: String(l.value),
          label: l.label,
          detail: l.desc,
          icon: l.value === draft.level ? "check" : "shield",
          onPress: () => {
            patch({ level: l.value });
            setPicker(null);
          },
        }))}
      />
      <ActionSheet
        visible={picker === "timeout"}
        onClose={() => setPicker(null)}
        items={AUTOMOD_TIMEOUT_OPTIONS.map((o) => ({
          key: String(o.seconds),
          label: t(o.key),
          icon: o.seconds === automod.timeoutSeconds ? "check" : "timer",
          onPress: () => {
            patchAutomod({ timeoutSeconds: o.seconds });
            setPicker(null);
          },
        }))}
      />
      <ActionSheet
        visible={picker === "alert"}
        onClose={() => setPicker(null)}
        items={[
          {
            key: "none",
            label: t("automod.settings.actionsSection.noAlert"),
            icon: automod.alertChannelId === null ? "check" : "bell-off",
            onPress: () => {
              patchAutomod({ alertChannelId: null });
              setPicker(null);
            },
          },
          ...textChannels.map((c) => ({
            key: c.id,
            label: `#${c.name}`,
            icon: (c.id === automod.alertChannelId ? "check" : "hash") as IconName,
            onPress: () => {
              patchAutomod({ alertChannelId: c.id });
              setPicker(null);
            },
          })),
        ]}
      />
    </Screen>
  );
}

function Card({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: highlight ? colors.brand : colors.border,
        backgroundColor: colors.panel,
      }}
    >
      {children}
    </View>
  );
}

function CardHeader({ icon, title, description, toggle }: { icon?: IconName; title: string; description: string; toggle?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {icon ? <Icon name={icon} size={14} color={colors.muted} /> : null}
          <Text style={{ ...typography.overline, color: colors.muted, flexShrink: 1 }}>{title.toLocaleUpperCase("tr-TR")}</Text>
        </View>
        <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text>
      </View>
      {toggle}
    </View>
  );
}

function SubTitle({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ gap: 2, marginTop: spacing.xs }}>
      <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{text}</Text>
      {hint ? <Text style={{ ...typography.caption, color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

function Warning({ text }: { text: string }) {
  return <Text style={{ ...typography.caption, color: colors.warning }}>{text}</Text>;
}

function Toggle({ value, disabled, onChange }: { value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.brand }}
      thumbColor="#ffffff"
    />
  );
}

function NumberField({
  label,
  value,
  range,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  range: { min: number; max: number };
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      hint={`${range.min}–${range.max}`}
      value={value}
      editable={!disabled}
      keyboardType="number-pad"
      maxLength={String(range.max).length}
      onChangeText={(v) => onChange(digitsOnly(v))}
    />
  );
}

function SelectRow({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={2}>
        {label}
      </Text>
      <Icon name="chevron-down" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Çoklu seçim: seçili öğe vurgulu hap (web PillPicker). */
function PillPicker({
  items,
  selected,
  disabled,
  emptyLabel,
  onToggle,
}: {
  items: { id: string; label: string; color?: string | null }[];
  selected: string[];
  disabled: boolean;
  emptyLabel: string;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return <Text style={{ ...typography.caption, color: colors.muted }}>{emptyLabel}</Text>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {items.map((item) => {
        const on = selected.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            disabled={disabled}
            haptic="light"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 32,
              paddingHorizontal: 10,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: on ? colors.brand : colors.border,
              backgroundColor: on ? colors.brandSoft : "transparent",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {item.color !== undefined ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color || "#99aab5" }} /> : null}
            <Text style={{ ...typography.caption, ...fw(on ? 700 : 500), color: on ? colors.bright : colors.muted }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
