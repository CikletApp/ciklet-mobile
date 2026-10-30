import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useMyPermissions,
  useSaveWelcomeScreen,
  useServerChannels,
  useServerSummary,
  useWelcomeScreen,
} from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { EmojiText, ErrorState, Icon, Pressable, Screen, ScreenLoader, TextField, showToast } from "@/components/ui";
import { WelcomeScreenContent } from "@/features/server/join-flow";
import {
  AddButton,
  ChoiceSheet,
  EmojiSheet,
  FormCard,
  FormHint,
  FormLabel,
  RowIconButton,
  SaveHeaderButton,
  SelectButton,
  ToggleRow,
} from "@/features/server/settings-form";
import {
  WELCOME_CHANNEL_DESCRIPTION_MAX,
  WELCOME_DESCRIPTION_MAX,
  WELCOME_MAX_CHANNELS,
  type WelcomeScreenView,
} from "@/lib/welcome-screen";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

interface Row {
  /** Yalnızca React anahtarı; kaydedilmez. */
  key: number;
  channelId: string;
  description: string;
  emoji: string | null;
}

interface Snapshot {
  enabled: boolean;
  description: string;
  rows: Row[];
}

function rowsFromScreen(screen: WelcomeScreenView, nextKey: { current: number }): Row[] {
  return screen.channels.map((c) => ({ key: nextKey.current++, channelId: c.channelId, description: c.description, emoji: c.emoji ?? null }));
}

/** Kaydedilen hâl ile formun karşılaştırılabilir özeti (satır anahtarları hariç). */
function fingerprint(s: Snapshot): string {
  return JSON.stringify({
    enabled: s.enabled,
    description: s.description.trim(),
    rows: s.rows.map(({ channelId, description, emoji }) => [channelId, description.trim(), emoji]),
  });
}

/**
 * Sunucu Ayarları › Karşılama Ekranı — web `welcome-screen-tab.tsx`
 * karşılığı. Yeni katılan üyelere bir kez gösterilen "Sunucuyu Keşfet"
 * penceresinin ayarı: kısa açıklama ve en çok beş önerilen kanal. Alttaki
 * önizleme pencereyle AYNI bileşeni çizer. Yetki: Sunucuyu Yönet (uç denetler).
 */
export default function WelcomeScreenSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerSummary(serverId);
  const { data: channels } = useServerChannels(serverId);
  const { data: permissions } = useMyPermissions(serverId);
  const query = useWelcomeScreen(serverId);
  const save = useSaveWelcomeScreen(serverId);

  const textChannels = useMemo(
    () => (channels ?? []).filter((c) => c.type === ChannelType.TEXT && !(c as ChannelExtras).parentChannelId),
    [channels]
  );
  const channelName = (id: string) => textChannels.find((c) => c.id === id)?.name ?? null;

  const nextKey = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<Snapshot>({ enabled: false, description: "", rows: [] });
  const [channelPicker, setChannelPicker] = useState<number | null>(null);
  const [emojiPicker, setEmojiPicker] = useState<number | null>(null);

  const apply = (data: WelcomeScreenView) => {
    const loadedRows = rowsFromScreen(data, nextKey);
    setEnabled(data.enabled);
    setDescription(data.description ?? "");
    setRows(loadedRows);
    setSaved({ enabled: data.enabled, description: data.description ?? "", rows: loadedRows });
  };

  useEffect(() => {
    if (!query.data || loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    apply(query.data);
    setLoaded(true);
  }, [query.data, loaded]);

  if (query.isLoading || (!loaded && !query.error)) return <ScreenLoader />;
  if (query.error && !loaded) {
    return <ErrorState message="Karşılama ekranı yüklenemedi." onRetry={() => void query.refetch()} />;
  }

  const disabled = !hasServerPermission(permissions, "MANAGE_SERVER");
  const isDirty = fingerprint({ enabled, description, rows }) !== fingerprint(saved);

  const onSave = () => {
    if (rows.some((r) => !r.channelId || !r.description.trim())) {
      showToast("Her önerilen kanal için bir kanal ve açıklama seç.", "error");
      return;
    }
    save.mutate(
      {
        enabled,
        description: description.trim() || null,
        channels: rows.map((r) => ({ channelId: r.channelId, description: r.description.trim(), emoji: r.emoji })),
      },
      {
        onSuccess: apply,
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Karşılama ekranı kaydedilemedi.", "error"),
      }
    );
  };

  const usedIds = new Set(rows.map((r) => r.channelId));
  const canAdd = !disabled && rows.length < WELCOME_MAX_CHANNELS && textChannels.some((c) => !usedIds.has(c.id));
  const updateRow = (key: number, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const moveRow = (index: number, delta: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row);
      return next;
    });
  const addRow = () => {
    const first = textChannels.find((c) => !usedIds.has(c.id));
    setRows((prev) => [...prev, { key: nextKey.current++, channelId: first?.id ?? "", description: "", emoji: null }]);
  };

  const previewChannels = rows.flatMap((r) => {
    const name = channelName(r.channelId);
    return name && r.description.trim() ? [{ channelId: r.channelId, description: r.description.trim(), emoji: r.emoji, channelName: name }] : [];
  });
  const pickerRow = rows.find((r) => r.key === channelPicker);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Karşılama Ekranı",
          headerRight: disabled ? undefined : () => <SaveHeaderButton dirty={isDirty} busy={save.isPending} onPress={onSave} />,
        }}
      />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <FormHint>
          Sunucunu Keşfet&apos;ten önizleyenlere ve yeni katılan üyelere bir kez gösterilir. Sunucunu kısaca tanıt ve ilk nereye bakmaları gerektiğini göster.
        </FormHint>

        <FormCard>
          <ToggleRow
            title="Karşılama ekranını göster"
            subtitle={enabled ? "Önizleyenler ve yeni üyeler bu pencereyi görür." : "Kapalıyken kimseye gösterilmez; ayarların saklanır."}
            value={enabled}
            disabled={disabled}
            onChange={setEnabled}
          />
        </FormCard>

        <FormCard gap={spacing.sm}>
          <FormLabel counter={`${description.length}/${WELCOME_DESCRIPTION_MAX}`}>Sunucu açıklaması</FormLabel>
          <FormHint>Bu sunucu ne hakkında? Tek cümle yeter.</FormHint>
          <TextField
            value={description}
            onChangeText={setDescription}
            editable={!disabled}
            multiline
            maxLength={WELCOME_DESCRIPTION_MAX}
            placeholder="Oyun severlerin buluşma noktası. Takım bul, turnuvalara katıl!"
          />
        </FormCard>

        <FormCard>
          <View style={{ gap: 2 }}>
            <FormLabel counter={`${rows.length}/${WELCOME_MAX_CHANNELS}`}>Önerilen kanallar</FormLabel>
            <FormHint>&quot;Burada yapılabilecek en önemli şeyler&quot; başlığı altında listelenir.</FormHint>
          </View>

          {rows.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.deep }}>
              Henüz kanal eklenmedi.
            </Text>
          ) : null}

          {rows.map((row, index) => (
            <View key={row.key} style={{ gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.deep }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setEmojiPicker(row.key)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Emoji seç"
                  style={{ width: 44, height: 44, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}
                >
                  {row.emoji ? <EmojiText style={{ fontSize: 22, lineHeight: 28 }}>{row.emoji}</EmojiText> : <Icon name="emoji" size={20} color={colors.muted} />}
                </Pressable>
                {row.emoji && !disabled ? (
                  <Pressable onPress={() => updateRow(row.key, { emoji: null })} accessibilityRole="button" accessibilityLabel="Emojiyi kaldır">
                    <Text style={{ ...typography.caption, ...fw(600), color: colors.danger }}>Emojiyi kaldır</Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }} />
                {!disabled ? (
                  <>
                    <RowIconButton icon="chevron-down" rotate={180} label="Yukarı taşı" disabled={index === 0} onPress={() => moveRow(index, -1)} />
                    <RowIconButton icon="chevron-down" label="Aşağı taşı" disabled={index === rows.length - 1} onPress={() => moveRow(index, 1)} />
                    <RowIconButton icon="trash" label="Kanalı kaldır" danger onPress={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} />
                  </>
                ) : null}
              </View>
              <SelectButton
                icon="hash"
                value={channelName(row.channelId)}
                placeholder="Kanal seç"
                disabled={disabled}
                onPress={() => setChannelPicker(row.key)}
              />
              <TextField
                value={row.description}
                onChangeText={(value) => updateRow(row.key, { description: value })}
                editable={!disabled}
                maxLength={WELCOME_CHANNEL_DESCRIPTION_MAX}
                placeholder="Örn. Katılmadan önce kuralları oku!"
                accessibilityLabel="Kanal açıklaması"
              />
            </View>
          ))}

          {canAdd ? <AddButton label="Kanal ekle" onPress={addRow} /> : null}
        </FormCard>

        {/* Canlı önizleme — pencereyle aynı gövde */}
        <View style={{ gap: spacing.sm }}>
          <FormLabel>Önizleme</FormLabel>
          <View style={{ padding: spacing.xl, borderRadius: radii.bentoWrapper, borderCurve: "continuous", backgroundColor: colors.bento, opacity: enabled ? 1 : 0.5 }}>
            <Text style={{ ...typography.title, fontSize: 18, ...fw(700), color: colors.bright, marginBottom: spacing.lg }}>Sunucuyu Keşfet</Text>
            <WelcomeScreenContent
              serverName={server?.name ?? ""}
              serverImageUrl={server?.imageUrl || null}
              description={description.trim() || null}
              channels={previewChannels}
            />
            <View style={{ marginTop: spacing.xl, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.bento, backgroundColor: colors.panel }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Şimdilik sadece bakıyorum</Text>
            </View>
          </View>
          {!enabled ? <FormHint>Karşılama ekranı kapalı.</FormHint> : null}
        </View>
      </ScrollView>

      <ChoiceSheet
        visible={channelPicker !== null}
        title="Kanal seç"
        options={textChannels
          .filter((c) => c.id === pickerRow?.channelId || !usedIds.has(c.id))
          .map((c) => ({ id: c.id, label: c.name, icon: "hash" as const }))}
        selected={pickerRow ? [pickerRow.channelId] : []}
        onClose={() => setChannelPicker(null)}
        onPick={(id) => {
          if (channelPicker !== null) updateRow(channelPicker, { channelId: id });
          setChannelPicker(null);
        }}
      />
      <EmojiSheet
        visible={emojiPicker !== null}
        title="Emoji seç"
        onClose={() => setEmojiPicker(null)}
        onEmoji={(emoji) => {
          if (emojiPicker !== null) updateRow(emojiPicker, { emoji });
        }}
      />
    </Screen>
  );
}
