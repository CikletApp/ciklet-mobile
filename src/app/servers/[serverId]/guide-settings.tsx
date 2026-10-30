import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { hasServerPermission, useMyPermissions, useSaveGuide, useServerChannels, useServerGuide, useServerSummary } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { ErrorState, Icon, Pressable, Screen, ScreenLoader, TextField, showToast } from "@/components/ui";
import { ServerGuideBody } from "@/features/server/guide-view";
import {
  AddButton,
  ChoiceSheet,
  FormCard,
  FormHint,
  FormLabel,
  RowIconButton,
  SaveHeaderButton,
  SelectButton,
  ToggleRow,
} from "@/features/server/settings-form";
import { useT } from "@/lib/i18n";
import {
  EMPTY_GUIDE,
  GUIDE_EMOJI_MAX,
  GUIDE_ITEM_DESCRIPTION_MAX,
  GUIDE_ITEM_TITLE_MAX,
  GUIDE_MAX_RESOURCES,
  GUIDE_MAX_TASKS,
  GUIDE_WELCOME_MESSAGE_MAX,
  GUIDE_WELCOME_TITLE_MAX,
  newEditorId,
  type GuideConfig,
  type GuideItem,
  type GuideItemView,
} from "@/lib/server-guide";
import { pickAndUploadServerBanner } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type ListKey = "tasks" | "resources";

const blankItem = (prefix: string): GuideItem => ({ id: newEditorId(prefix), title: "", description: null, emoji: null, channelId: "" });

const CHANNEL_TYPE: Record<string, GuideItemView["channelType"]> = {
  [ChannelType.TEXT]: "TEXT",
  [ChannelType.AUDIO]: "AUDIO",
  [ChannelType.VIDEO]: "VIDEO",
};

/**
 * Sunucu Ayarları › Sunucu Rehberi — web `guide-tab.tsx` karşılığı.
 * Karşılama (başlık, mesaj, afiş), kanallara bağlı yapılacaklar ve kaynak
 * kartları. Alttaki önizleme rehber sayfasıyla AYNI bileşeni çizer. Afiş
 * hemen yüklenir; kayıt yine "Kaydet" ile. Yetki: Sunucuyu Yönet.
 */
export default function GuideSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const t = useT();
  const { data: server } = useServerSummary(serverId);
  const { data: allChannels } = useServerChannels(serverId);
  const { data: permissions } = useMyPermissions(serverId);
  const query = useServerGuide(serverId);
  const save = useSaveGuide(serverId);

  // Rehber yalnızca üst düzey kanallara bağlanır (uç da aynısını ister).
  const channels = useMemo(() => (allChannels ?? []).filter((c) => !(c as ChannelExtras).parentChannelId), [allChannels]);
  const channelById = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const [config, setConfig] = useState<GuideConfig>(EMPTY_GUIDE);
  const [saved, setSaved] = useState<GuideConfig | null>(null);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState<{ list: ListKey; id: string } | null>(null);

  useEffect(() => {
    if (!query.data || saved) return;
    const loaded = query.data.config ?? EMPTY_GUIDE;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(loaded);
    setSaved(loaded);
  }, [query.data, saved]);

  if (query.error && !saved) return <ErrorState message={t("serverGuide.settings.loadFailed")} onRetry={() => void query.refetch()} />;
  if (!saved) return <ScreenLoader />;

  const disabled = !hasServerPermission(permissions, "MANAGE_SERVER");
  const isDirty = JSON.stringify(config) !== JSON.stringify(saved);
  const patch = (next: Partial<GuideConfig>) => setConfig((prev) => ({ ...prev, ...next }));

  const onSave = () => {
    if (uploading) {
      showToast(t("serverGuide.settings.uploading"), "error");
      return;
    }
    save.mutate(config, {
      onSuccess: ({ config: next }) => {
        setConfig(next);
        setSaved(next);
        showToast(t("serverGuide.settings.saved"));
      },
      onError: (error) => showToast(error instanceof ApiError ? error.message : t("serverGuide.settings.saveFailed"), "error"),
    });
  };

  const uploadBanner = async () => {
    if (disabled || uploading) return;
    setUploading(true);
    try {
      const url = await pickAndUploadServerBanner();
      if (url) patch({ bannerUrl: url });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("serverGuide.errors.bannerInvalid"), "error");
    } finally {
      setUploading(false);
    }
  };

  const updateItem = (list: ListKey, id: string, next: Partial<GuideItem>) =>
    setConfig((prev) => ({ ...prev, [list]: prev[list].map((item) => (item.id === id ? { ...item, ...next } : item)) }));
  const removeItem = (list: ListKey, id: string) => setConfig((prev) => ({ ...prev, [list]: prev[list].filter((item) => item.id !== id) }));
  const moveItem = (list: ListKey, index: number, delta: -1 | 1) =>
    setConfig((prev) => {
      const items = [...prev[list]];
      const target = index + delta;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...prev, [list]: items };
    });

  // Önizleme: kanal adı ayarlardaki listeden; kanalı seçilmemiş öğe gösterilmez.
  const previewItems = (items: GuideItem[]): GuideItemView[] =>
    items.flatMap((item) => {
      const channel = channelById.get(item.channelId);
      if (!channel || !item.title.trim()) return [];
      return [{ ...item, channelName: channel.name, channelType: CHANNEL_TYPE[channel.type] ?? "TEXT" }];
    });

  const pickerItem = picker ? config[picker.list].find((item) => item.id === picker.id) : undefined;

  const listProps = {
    channels,
    disabled,
    channelName: (id: string) => channelById.get(id)?.name ?? null,
    onUpdate: updateItem,
    onRemove: removeItem,
    onMove: moveItem,
    onPickChannel: (list: ListKey, id: string) => setPicker({ list, id }),
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t("serverGuide.title"),
          headerRight: disabled ? undefined : () => <SaveHeaderButton dirty={isDirty} busy={save.isPending} onPress={onSave} />,
        }}
      />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <FormHint>{t("serverGuide.settings.description")}</FormHint>

        <FormCard>
          <ToggleRow
            title={t("serverGuide.settings.enable")}
            subtitle={t("serverGuide.settings.enableHint")}
            value={config.enabled}
            disabled={disabled}
            onChange={(enabled) => patch({ enabled })}
          />
          {saved.enabled && !isDirty ? (
            <Pressable
              onPress={() => router.push(`/servers/${serverId}/guide`)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
            >
              <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>{t("serverGuide.settings.preview")}</Text>
              <Icon name="arrow-up-right" size={15} color={colors.brand} />
            </Pressable>
          ) : null}
        </FormCard>

        {/* ── Karşılama ── */}
        <FormCard>
          <FormLabel>{t("serverGuide.settings.welcomeSection")}</FormLabel>
          <View style={{ gap: spacing.xs }}>
            <FormLabel>{t("serverGuide.settings.banner")}</FormLabel>
            <View style={{ height: 128, borderRadius: radii.xl, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.deep }}>
              {config.bannerUrl ? (
                <Image source={{ uri: config.bannerUrl }} contentFit="cover" style={{ position: "absolute", inset: 0 }} />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="image" size={30} color={colors.muted} />
                </View>
              )}
              {uploading ? (
                <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.scrim }}>
                  <ActivityIndicator color={colors.bright} />
                </View>
              ) : null}
              {!disabled ? (
                <Pressable
                  onPress={() => void uploadBanner()}
                  accessibilityRole="button"
                  style={{ position: "absolute", right: spacing.md, bottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.md, backgroundColor: colors.scrim }}
                >
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.bright }}>
                    {config.bannerUrl ? t("serverGuide.settings.bannerChange") : t("serverGuide.settings.bannerUpload")}
                  </Text>
                </Pressable>
              ) : null}
              {config.bannerUrl && !disabled ? (
                <Pressable
                  onPress={() => patch({ bannerUrl: null })}
                  accessibilityRole="button"
                  accessibilityLabel={t("serverGuide.settings.bannerRemove")}
                  style={{ position: "absolute", right: spacing.md, top: spacing.md, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger }}
                >
                  <Icon name="close" size={15} color="#ffffff" />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={{ gap: spacing.xs }}>
            <FormLabel>{t("serverGuide.settings.welcomeTitle")}</FormLabel>
            <TextField
              value={config.welcomeTitle ?? ""}
              editable={!disabled}
              maxLength={GUIDE_WELCOME_TITLE_MAX}
              onChangeText={(value) => patch({ welcomeTitle: value || null })}
              placeholder={t("serverGuide.settings.welcomeTitlePlaceholder", { server: server?.name ?? "" })}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <FormLabel counter={`${(config.welcomeMessage ?? "").length}/${GUIDE_WELCOME_MESSAGE_MAX}`}>{t("serverGuide.settings.welcomeMessage")}</FormLabel>
            <TextField
              value={config.welcomeMessage ?? ""}
              editable={!disabled}
              multiline
              maxLength={GUIDE_WELCOME_MESSAGE_MAX}
              onChangeText={(value) => patch({ welcomeMessage: value || null })}
              placeholder={t("serverGuide.settings.welcomeMessagePlaceholder")}
            />
          </View>
        </FormCard>

        <ItemList
          {...listProps}
          list="tasks"
          title={t("serverGuide.settings.tasksSection")}
          hint={t("serverGuide.settings.tasksHint", { max: GUIDE_MAX_TASKS })}
          addLabel={t("serverGuide.settings.addTask")}
          titlePlaceholder={t("serverGuide.settings.taskTitlePlaceholder")}
          items={config.tasks}
          max={GUIDE_MAX_TASKS}
          numbered
          onAdd={() => patch({ tasks: [...config.tasks, blankItem("t")] })}
        />

        <ItemList
          {...listProps}
          list="resources"
          title={t("serverGuide.settings.resourcesSection")}
          hint={t("serverGuide.settings.resourcesHint", { max: GUIDE_MAX_RESOURCES })}
          addLabel={t("serverGuide.settings.addResource")}
          titlePlaceholder={t("serverGuide.settings.resourceTitlePlaceholder")}
          items={config.resources}
          max={GUIDE_MAX_RESOURCES}
          onAdd={() => patch({ resources: [...config.resources, blankItem("r")] })}
        />

        {/* ── Önizleme ── */}
        <View style={{ gap: spacing.xs }}>
          <FormLabel>{t("serverGuide.settings.previewTitle")}</FormLabel>
          <FormHint>{t("serverGuide.settings.previewHint")}</FormHint>
          <View pointerEvents="none" style={{ marginTop: spacing.sm, borderRadius: radii.bentoWrapper, overflow: "hidden", backgroundColor: colors.chat }}>
            <ServerGuideBody
              preview
              serverId={serverId}
              serverName={server?.name ?? ""}
              serverImageUrl={server?.imageUrl || null}
              guide={{
                welcomeTitle: config.welcomeTitle,
                welcomeMessage: config.welcomeMessage,
                bannerUrl: config.bannerUrl,
                tasks: previewItems(config.tasks),
                resources: previewItems(config.resources),
                completed: [],
              }}
            />
          </View>
        </View>
      </ScrollView>

      <ChoiceSheet
        visible={picker !== null}
        title={t("serverGuide.settings.channelPick")}
        options={channels.map((c) => ({ id: c.id, label: c.name, icon: c.type === ChannelType.TEXT ? ("hash" as const) : ("volume" as const) }))}
        selected={pickerItem ? [pickerItem.channelId] : []}
        empty={t("serverGuide.settings.noChannels")}
        onClose={() => setPicker(null)}
        onPick={(channelId) => {
          if (picker) updateItem(picker.list, picker.id, { channelId });
          setPicker(null);
        }}
      />
    </Screen>
  );
}

function ItemList({
  list,
  title,
  hint,
  addLabel,
  titlePlaceholder,
  items,
  max,
  numbered = false,
  channels,
  disabled,
  channelName,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onPickChannel,
}: {
  list: ListKey;
  title: string;
  hint: string;
  addLabel: string;
  titlePlaceholder: string;
  items: GuideItem[];
  max: number;
  numbered?: boolean;
  channels: readonly unknown[];
  disabled: boolean;
  channelName: (id: string) => string | null;
  onAdd: () => void;
  onUpdate: (list: ListKey, id: string, next: Partial<GuideItem>) => void;
  onRemove: (list: ListKey, id: string) => void;
  onMove: (list: ListKey, index: number, delta: -1 | 1) => void;
  onPickChannel: (list: ListKey, id: string) => void;
}) {
  const t = useT();
  return (
    <FormCard>
      <View style={{ gap: 2 }}>
        <FormLabel>{title}</FormLabel>
        <FormHint>{hint}</FormHint>
      </View>

      {items.map((item, index) => (
        <View key={item.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            {numbered ? (
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
                <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>{index + 1}</Text>
              </View>
            ) : null}
            <View style={{ width: 60 }}>
              <TextField
                value={item.emoji ?? ""}
                editable={!disabled}
                maxLength={GUIDE_EMOJI_MAX}
                onChangeText={(value) => onUpdate(list, item.id, { emoji: value || null })}
                placeholder="🙂"
                accessibilityLabel={t("serverGuide.settings.emoji")}
              />
            </View>
            <View style={{ flex: 1 }} />
            <RowIconButton icon="chevron-down" rotate={180} label={t("serverGuide.settings.moveUp")} disabled={disabled || index === 0} onPress={() => onMove(list, index, -1)} />
            <RowIconButton icon="chevron-down" label={t("serverGuide.settings.moveDown")} disabled={disabled || index === items.length - 1} onPress={() => onMove(list, index, 1)} />
            <RowIconButton icon="trash" danger label={t("serverGuide.settings.remove")} disabled={disabled} onPress={() => onRemove(list, item.id)} />
          </View>
          <TextField
            value={item.title}
            editable={!disabled}
            maxLength={GUIDE_ITEM_TITLE_MAX}
            onChangeText={(value) => onUpdate(list, item.id, { title: value })}
            placeholder={titlePlaceholder}
          />
          <TextField
            value={item.description ?? ""}
            editable={!disabled}
            maxLength={GUIDE_ITEM_DESCRIPTION_MAX}
            onChangeText={(value) => onUpdate(list, item.id, { description: value || null })}
            placeholder={t("serverGuide.settings.descriptionPlaceholder")}
          />
          {channels.length === 0 ? (
            <FormHint>{t("serverGuide.settings.noChannels")}</FormHint>
          ) : (
            <SelectButton
              icon="hash"
              value={channelName(item.channelId)}
              placeholder={t("serverGuide.settings.channelPick")}
              disabled={disabled}
              onPress={() => onPickChannel(list, item.id)}
            />
          )}
        </View>
      ))}

      {items.length < max ? <AddButton label={addLabel} disabled={disabled} onPress={onAdd} /> : null}
    </FormCard>
  );
}
