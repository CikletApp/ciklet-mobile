import { useEffect, useMemo, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useMyPermissions,
  useSaveOnboarding,
  useServerChannels,
  useServerOnboarding,
  useServerRoleDetails,
} from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { Button, ErrorState, Pressable, Screen, ScreenLoader, TextField, showToast } from "@/components/ui";
import { FormCard, FormHint, FormLabel, RowIconButton, SaveHeaderButton, ToggleRow } from "@/features/server/settings-form";
import { newEditorId } from "@/lib/server-guide";
import {
  EMPTY_ONBOARDING,
  ONBOARDING_DESCRIPTION_MAX,
  ONBOARDING_LABEL_MAX,
  ONBOARDING_MAX_GRANTS,
  ONBOARDING_MAX_OPTIONS,
  ONBOARDING_MAX_QUESTIONS,
  ONBOARDING_TITLE_MAX,
  isOnboardingGrantable,
  type OnboardingConfig,
  type OnboardingOption,
  type OnboardingQuestion,
} from "@/lib/server-onboarding";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const blankOption = (): OnboardingOption => ({ id: newEditorId("o"), label: "", description: null, emoji: null, roleIds: [], channelIds: [] });
const blankQuestion = (): OnboardingQuestion => ({
  id: newEditorId("q"),
  title: "",
  multiple: false,
  required: false,
  options: [blankOption(), blankOption()],
});

/**
 * Sunucu Ayarları › Katılım Soruları — web `onboarding-tab.tsx` karşılığı.
 * Yeni üyeye sorulacak sorular; her seçenek rol ve/veya kanal verir.
 * Yönetim izni taşıyan roller listelenmez (uç da reddeder). Kural
 * ekranından önce ya da sonra gösterilir. Yetki: Sunucuyu Yönet.
 */
export default function OnboardingSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: permissions } = useMyPermissions(serverId);
  const { data: allChannels } = useServerChannels(serverId);
  const roles = useServerRoleDetails(serverId);
  const query = useServerOnboarding(serverId);
  const save = useSaveOnboarding(serverId);

  const channels = useMemo(() => (allChannels ?? []).filter((c) => !(c as ChannelExtras).parentChannelId), [allChannels]);
  const grantableRoles = useMemo(() => (roles.data ?? []).filter((r) => isOnboardingGrantable(r.permissions)), [roles.data]);

  const [config, setConfig] = useState<OnboardingConfig>(EMPTY_ONBOARDING);
  const [saved, setSaved] = useState<OnboardingConfig | null>(null);

  useEffect(() => {
    if (!query.data || saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(query.data.config);
    setSaved(query.data.config);
  }, [query.data, saved]);

  if (query.error && !saved) return <ErrorState message="Katılım soruları yüklenemedi." onRetry={() => void query.refetch()} />;
  if (!saved || roles.isLoading) return <ScreenLoader />;

  const disabled = !hasServerPermission(permissions, "MANAGE_SERVER");
  const isDirty = JSON.stringify(config) !== JSON.stringify(saved);

  const onSave = () =>
    save.mutate(config, {
      onSuccess: ({ config: next }) => {
        setConfig(next);
        setSaved(next);
        showToast("Katılım soruları kaydedildi.");
      },
      onError: (error) => showToast(error instanceof ApiError ? error.message : "Katılım soruları kaydedilemedi.", "error"),
    });

  const updateQuestion = (qid: string, patch: Partial<OnboardingQuestion>) =>
    setConfig((prev) => ({ ...prev, questions: prev.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }));
  const updateOption = (qid: string, oid: string, patch: Partial<OnboardingOption>) =>
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qid ? { ...q, options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) } : q)),
    }));
  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : list.length < ONBOARDING_MAX_GRANTS ? [...list, id] : list;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Katılım Soruları",
          headerRight: disabled ? undefined : () => <SaveHeaderButton dirty={isDirty} busy={save.isPending} onPress={onSave} />,
        }}
      />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <FormHint>
          Yeni üyelere katıldıklarında sorulur. Her seçenek rol ve/veya kanal verebilir: roller hemen bağlanır, üye ilk seçtiği kanala
          yönlendirilir. Özel bir kanalı açmak için seçeneğe o kanalı görebilen bir rol bağla. Yönetim izni taşıyan roller burada verilemez.
        </FormHint>

        <FormCard gap={spacing.lg}>
          <ToggleRow
            title="Katılım sorularını göster"
            subtitle="Kapalıyken sorular kimseye gösterilmez."
            value={config.enabled}
            disabled={disabled}
            onChange={(v) => setConfig((p) => ({ ...p, enabled: v }))}
          />
          <ToggleRow
            title="Kural ekranından önce sor"
            subtitle="Kapalıysa sorular kurallar kabul edildikten sonra gelir."
            value={config.beforeRules}
            disabled={disabled}
            onChange={(v) => setConfig((p) => ({ ...p, beforeRules: v }))}
          />
        </FormCard>

        {config.questions.map((q, qi) => (
          <FormCard key={q.id} gap={spacing.lg}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <FormLabel>{`${qi + 1}. Soru`}</FormLabel>
                <TextField
                  value={q.title}
                  editable={!disabled}
                  maxLength={ONBOARDING_TITLE_MAX}
                  onChangeText={(title) => updateQuestion(q.id, { title })}
                  placeholder="Örn. Hangi oyunları oynuyorsun?"
                />
              </View>
              <RowIconButton
                icon="trash"
                label="Soruyu sil"
                danger
                disabled={disabled}
                onPress={() => setConfig((p) => ({ ...p, questions: p.questions.filter((x) => x.id !== q.id) }))}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xl }}>
              <InlineSwitch label="Birden çok seçim" value={q.multiple} disabled={disabled} onChange={(v) => updateQuestion(q.id, { multiple: v })} />
              <InlineSwitch label="Zorunlu" value={q.required} disabled={disabled} onChange={(v) => updateQuestion(q.id, { required: v })} />
            </View>

            {q.options.map((o) => (
              <View key={o.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 60 }}>
                    <TextField
                      value={o.emoji ?? ""}
                      editable={!disabled}
                      maxLength={8}
                      onChangeText={(value) => updateOption(q.id, o.id, { emoji: value || null })}
                      placeholder="🙂"
                      accessibilityLabel="Emoji"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={o.label}
                      editable={!disabled}
                      maxLength={ONBOARDING_LABEL_MAX}
                      onChangeText={(label) => updateOption(q.id, o.id, { label })}
                      placeholder="Seçenek"
                    />
                  </View>
                  <RowIconButton
                    icon="close"
                    label="Seçeneği sil"
                    disabled={disabled || q.options.length <= 2}
                    onPress={() => updateQuestion(q.id, { options: q.options.filter((x) => x.id !== o.id) })}
                  />
                </View>
                <TextField
                  value={o.description ?? ""}
                  editable={!disabled}
                  maxLength={ONBOARDING_DESCRIPTION_MAX}
                  onChangeText={(value) => updateOption(q.id, o.id, { description: value || null })}
                  placeholder="Kısa açıklama (isteğe bağlı)"
                />
                <ChipPicker
                  label="Verilen roller"
                  empty="Verilebilecek rol yok."
                  items={grantableRoles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
                  selected={o.roleIds}
                  disabled={disabled}
                  onToggle={(id) => updateOption(q.id, o.id, { roleIds: toggleIn(o.roleIds, id) })}
                />
                <ChipPicker
                  label="Verilen kanallar"
                  empty="Kanal yok."
                  items={channels.map((c) => ({ id: c.id, name: `#${c.name}`, color: null }))}
                  selected={o.channelIds}
                  disabled={disabled}
                  onToggle={(id) => updateOption(q.id, o.id, { channelIds: toggleIn(o.channelIds, id) })}
                />
              </View>
            ))}
            {q.options.length < ONBOARDING_MAX_OPTIONS ? (
              <Pressable
                onPress={() => updateQuestion(q.id, { options: [...q.options, blankOption()] })}
                disabled={disabled}
                accessibilityRole="button"
                style={{ alignSelf: "flex-start", paddingVertical: spacing.xs, opacity: disabled ? 0.5 : 1 }}
              >
                <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>+ Seçenek ekle</Text>
              </Pressable>
            ) : null}
          </FormCard>
        ))}

        {config.questions.length < ONBOARDING_MAX_QUESTIONS ? (
          <Button
            label="Soru ekle"
            icon="plus"
            disabled={disabled}
            onPress={() => setConfig((p) => ({ ...p, questions: [...p.questions, blankQuestion()] }))}
            style={{ alignSelf: "flex-start" }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function InlineSwitch({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, opacity: disabled ? 0.45 : 1 }}>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
      <Text style={{ ...typography.caption, color: colors.text }}>{label}</Text>
    </View>
  );
}

function ChipPicker({
  label,
  empty,
  items,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  empty: string;
  items: { id: string; name: string; color: string | null }[];
  selected: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <FormLabel>{label}</FormLabel>
      {items.length === 0 ? (
        <FormHint>{empty}</FormHint>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {items.map((item) => {
            const on = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => onToggle(item.id)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: 180,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radii.full,
                  borderWidth: 1,
                  borderColor: on ? colors.brand : colors.border,
                  backgroundColor: on ? colors.brandSoft : "transparent",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {item.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} /> : null}
                <Text style={{ ...typography.caption, fontSize: 12, ...fw(500), color: on ? colors.bright : colors.muted }} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
