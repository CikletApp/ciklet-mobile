import { useEffect, useMemo, useState } from "react";
import { Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import {
  FOLDER_COLOR_RE,
  FOLDER_NAME_MAX_LENGTH,
  useFolderMutations,
  useFolders,
  useMyServers,
} from "@/api/hooks";
import type { MembershipWithServer } from "@/api/types";
import { Avatar, Button, Icon, KeyboardAvoider, Pressable, SectionHeader, TextField, showToast } from "@/components/ui";
import { ColorPickerSheet } from "@/features/appearance/color-picker-sheet";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Klasör Ayarları / Klasör Oluştur — web `modals/folder-settings-modal.tsx`
 * (ad + renk: mevcut renk, özel renk seçici, iki sıra hazır palet) ve
 * web'in sürükle-bırakla klasör kurması (`POST /api/folders`, en az iki
 * sunucu). Mobilde sürükleme sıralama için kullanıldığından klasör bu
 * ekrandan kurulur; sunucu ekleme/çıkarma da burada. Bir sunucu kalınca
 * klasör sunucuda silinir (web ile aynı).
 */

/** Discord rol paleti düzeni: üst sıra canlı, alt sıra koyu tonlar. */
const PRESET_COLORS: string[][] = [
  ["#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#e91e63", "#f1c40f", "#e67e22", "#e74c3c", "#95a5a6", "#607d8b"],
  ["#11806a", "#1f8b4c", "#206694", "#71368a", "#ad1457", "#c27c0e", "#a84300", "#992d22", "#979c9f", "#546e7a"],
];
const DEFAULT_COLOR = "#5865f2";

export default function FolderScreen() {
  const t = useT();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const creating = folderId === "new";
  const { data: folders } = useFolders();
  const { data: memberships } = useMyServers();
  const folder = creating ? undefined : folders?.find((f) => f.id === folderId);
  const { create, update, addServer, removeServer } = useFolderMutations();

  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [customOpen, setCustomOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!folder) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(folder.name ?? "");
    setColor(folder.color && FOLDER_COLOR_RE.test(folder.color) ? folder.color : DEFAULT_COLOR);
  }, [folder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => memberships ?? [], [memberships]);
  const inFolder = useMemo(
    () =>
      folder
        ? folder.members
            .map((m) => all.find((s) => s.serverId === m.serverId))
            .filter((m): m is MembershipWithServer => Boolean(m))
        : [],
    [folder, all]
  );
  // Başka klasördeki sunucular eklenemez (web'de de önce klasörden çıkarılır).
  const candidates = useMemo(() => all.filter((m) => !m.folderId), [all]);

  const fail = (fallback: string) => (error: unknown) =>
    showToast(userErrorMessage(error, fallback), "error");

  const togglePick = (serverId: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });

  const save = () => {
    if (creating) {
      if (picked.size < 2) return;
      create.mutate([...picked], {
        onSuccess: (created) => {
          // Yeni klasör sunucuda varsayılan ad/renkle doğar; seçilenleri yaz.
          update.mutate(
            { folderId: created.id, name: name.trim(), color },
            { onSettled: () => router.back() }
          );
        },
        onError: fail(t("parityScreens.folders.createFailed")),
      });
      return;
    }
    if (!folder) return;
    update.mutate(
      { folderId: folder.id, name: name.trim(), color },
      { onSuccess: () => router.back(), onError: fail(t("parityScreens.folders.saveFailed")) }
    );
  };

  const remove = (serverId: string) => {
    if (!folder) return;
    const last = inFolder.length <= 2;
    removeServer.mutate(
      { folderId: folder.id, serverId },
      {
        // İki sunucudan biri çıkınca klasör dağılır; ekran anlamsızlaşır.
        onSuccess: () => (last ? router.back() : undefined),
        onError: fail(t("parityScreens.folders.removeFailed")),
      }
    );
  };

  const add = (serverId: string) => {
    if (!folder) return;
    addServer.mutate({ folderId: folder.id, serverId }, { onError: fail(t("parityScreens.folders.addFailed")) });
  };

  const isPreset = PRESET_COLORS.flat().includes(color.toLowerCase());
  const busy = create.isPending || update.isPending;

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{ title: creating ? t("parityScreens.folders.createTitle") : t("parityScreens.folders.settingsTitle") }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <TextField
          label={t("parityScreens.folders.nameLabel")}
          value={name}
          onChangeText={setName}
          maxLength={FOLDER_NAME_MAX_LENGTH}
          placeholder={t("parityScreens.folders.defaultName")}
        />

        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>{t("parityScreens.folders.colorLabel")}</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View
              accessibilityLabel={t("parityScreens.folders.currentColor")}
              style={{ height: 56, width: 96, borderRadius: radii.md, backgroundColor: color, borderWidth: 1, borderColor: colors.border }}
            />
            <RNPressable
              onPress={() => setCustomOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("parityScreens.folders.customColor")}
              style={{
                height: 56,
                width: 96,
                borderRadius: radii.md,
                backgroundColor: isPreset ? colors.warning : color,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ position: "absolute", top: 6, right: 6 }}>
                <Icon name="pencil" size={16} color="#ffffff" />
              </View>
            </RNPressable>
          </View>
          <View style={{ gap: 6 }} accessibilityRole="radiogroup">
            {PRESET_COLORS.map((row, i) => (
              <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {row.map((preset) => {
                  const active = color.toLowerCase() === preset;
                  return (
                    <RNPressable
                      key={preset}
                      onPress={() => setColor(preset)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={preset}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radii.sm,
                        backgroundColor: preset,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {active ? <Icon name="check" size={16} color="#ffffff" /> : null}
                    </RNPressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {creating ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t("parityScreens.folders.pickServers")} />
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {t("parityScreens.folders.pickHint")}
            </Text>
            {candidates.map((m) => (
              <ServerPickRow
                key={m.serverId}
                membership={m}
                trailing={
                  <Icon
                    name={picked.has(m.serverId) ? "check" : "plus"}
                    size={18}
                    color={picked.has(m.serverId) ? colors.brand : colors.muted}
                  />
                }
                selected={picked.has(m.serverId)}
                onPress={() => togglePick(m.serverId)}
              />
            ))}
          </View>
        ) : folder ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t("parityScreens.folders.inFolder", { count: inFolder.length })} />
              {inFolder.map((m) => (
                <ServerPickRow
                  key={m.serverId}
                  membership={m}
                  trailing={<Icon name="close" size={18} color={colors.danger} />}
                  actionLabel={t("parityScreens.folders.removeServer", { name: m.server.name })}
                  onPress={() => remove(m.serverId)}
                />
              ))}
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.folders.removeHint")}</Text>
            </View>
            {candidates.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <SectionHeader title={t("parityScreens.folders.addServers")} />
                {candidates.map((m) => (
                  <ServerPickRow
                    key={m.serverId}
                    membership={m}
                    trailing={<Icon name="plus" size={18} color={colors.brand} />}
                    actionLabel={t("parityScreens.folders.addServer", { name: m.server.name })}
                    onPress={() => add(m.serverId)}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Button
          label={creating ? t("parityScreens.folders.create") : t("parityScreens.folders.done")}
          fullWidth
          size="lg"
          loading={busy}
          disabled={creating ? picked.size < 2 : !folder}
          onPress={save}
        />
      </ScrollView>
      <ColorPickerSheet
        visible={customOpen}
        title={t("parityScreens.folders.colorLabel")}
        value={FOLDER_COLOR_RE.test(color) ? color : DEFAULT_COLOR}
        onClose={() => setCustomOpen(false)}
        onApply={(next) => {
          setCustomOpen(false);
          setColor(next);
        }}
      />
    </KeyboardAvoider>
  );
}

function ServerPickRow({
  membership,
  trailing,
  selected,
  actionLabel,
  onPress,
}: {
  membership: MembershipWithServer;
  trailing: React.ReactNode;
  selected?: boolean;
  actionLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={actionLabel ?? membership.server.name}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: selected ? colors.raised : pressed ? colors.panel : "transparent",
      })}
    >
      <Avatar
        imageUrl={membership.server.imageUrl}
        fallbackText={membership.server.name}
        size={40}
        radius={radii.md}
        backgroundColor={colors.bento}
      />
      <Text style={{ ...typography.bodyStrong, color: colors.text, flex: 1 }} numberOfLines={1}>
        {membership.server.name}
      </Text>
      {trailing}
    </Pressable>
  );
}
