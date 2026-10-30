import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  hasServerPermission,
  useMyPermissions,
  useServerRoleDetails,
  useUpdateRole,
  type RoleUpdate,
  type ServerRoleDetails,
} from "@/api/hooks";
import type { MyServerPermissions } from "@/api/types";
import { Divider, EmptyState, Icon, ListGroup, Pressable, Screen, ScreenLoader, SectionHeader, TextField, showToast } from "@/components/ui";
import { EmojiPickerPanel } from "@/features/chat/components/emoji-picker";
import { RoleIconBadge } from "@/features/server/role-icon-badge";
import { pickAndUploadRoleIcon } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/** Web Roller sekmesindeki renk örnekleri — aynı sıra. */
const SWATCHES = ["#e67e22", "#e91e63", "#e74c3c", "#f39c12", "#f1c40f", "#9b59b6", "#3498db", "#1abc9c", "#2ecc71", "#95a5a6"];
const ROLE_NAME_MAX = 40;

/** Web `canManageRole`: sahip/yönetici hepsini, diğerleri kendi en yüksek rolünün altını. */
function canEditRole(actor: MyServerPermissions | undefined, role: ServerRoleDetails): boolean {
  if (!actor || !hasServerPermission(actor, "MANAGE_ROLES")) return false;
  if (actor.isOwner || actor.memberRole === "ADMIN") return true;
  return actor.topPosition > role.position;
}

const iconOf = (role: ServerRoleDetails) =>
  role.iconUrl || role.iconEmoji ? { url: role.iconUrl, emoji: role.iconEmoji, name: role.name } : null;

/**
 * Sunucu rolleri — web Sunucu Ayarları › Roller sekmesinin mobil karşılığı:
 * ad, renk, ayrı gösterme (hoist), rol simgesi (görsel ya da emoji) ve
 * "Herkesin bu rolden bahsetmesine izin ver". İzin matrisi ve rol üyeleri
 * şimdilik yalnızca webde. Yetki "Rolleri Yönet" — uç ayrıca rol
 * hiyerarşisini denetler.
 */
export default function ServerRolesScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: roles, isLoading } = useServerRoleDetails(serverId);
  const { data: actor } = useMyPermissions(serverId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = roles?.find((role) => role.id === selectedId) ?? null;

  if (isLoading) return <ScreenLoader label="Roller yükleniyor…" />;

  if (selected) {
    return <RoleEditor serverId={serverId} role={selected} editable={canEditRole(actor, selected)} onBack={() => setSelectedId(null)} />;
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Roller" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }}>
        {!roles || roles.length === 0 ? (
          <EmptyState icon="shield" title="Henüz rol yok." />
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <ListGroup>
              {roles.map((role, index) => (
                <View key={role.id}>
                  {index > 0 ? <Divider inset={16} /> : null}
                  <Pressable
                    onPress={() => setSelectedId(role.id)}
                    accessibilityRole="button"
                    accessibilityLabel={role.name}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: role.color || colors.muted }} />
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                      <Text style={{ ...typography.body, ...fw(600), color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
                        {role.name}
                      </Text>
                      <RoleIconBadge icon={iconOf(role)} size={16} />
                    </View>
                    <Text style={{ ...typography.caption, color: colors.muted }}>{`${role._count?.members ?? 0} üye`}</Text>
                    <Icon name="chevron-right" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </ListGroup>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function RoleEditor({
  serverId,
  role,
  editable,
  onBack,
}: {
  serverId: string;
  role: ServerRoleDetails;
  editable: boolean;
  onBack: () => void;
}) {
  const update = useUpdateRole(serverId);
  const [name, setName] = useState(role.name);
  const [iconBusy, setIconBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(role.name);
  }, [role.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (input: RoleUpdate, failure = "Rol kaydedilemedi.") =>
    update.mutateAsync({ roleId: role.id, input }).catch((error: unknown) => {
      showToast(error instanceof ApiError ? error.message : failure, "error");
    });

  const saveName = () => {
    const next = name.trim().slice(0, ROLE_NAME_MAX);
    if (!editable || !next || next === role.name) return;
    void patch({ name: next });
  };

  const uploadIcon = async () => {
    if (!editable || iconBusy) return;
    setIconBusy(true);
    try {
      const url = await pickAndUploadRoleIcon();
      if (url) await patch({ iconUrl: url, iconEmoji: null }, "Rol simgesi kaydedilemedi.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Rol simgesi yüklenemedi.", "error");
    } finally {
      setIconBusy(false);
    }
  };

  const icon = iconOf(role);

  return (
    <Screen>
      <Stack.Screen options={{ title: role.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>← Rollere dön</Text>
        </Pressable>

        {!editable ? (
          <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            Bu rol senin en yüksek rolünün üstünde ya da eşit; düzenleyemezsin.
          </Text>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <TextField
            label="ROL ADI"
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            maxLength={ROLE_NAME_MAX}
            editable={editable}
          />
        </View>

        <SectionHeader title="ROL RENGİ" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {SWATCHES.map((color) => (
            <Pressable
              key={color}
              disabled={!editable}
              onPress={() => void patch({ color })}
              accessibilityRole="button"
              accessibilityLabel={color}
              accessibilityState={{ selected: role.color === color }}
              style={{
                width: 34,
                height: 34,
                borderRadius: radii.md,
                backgroundColor: color,
                borderWidth: role.color === color ? 3 : 0,
                borderColor: colors.bright,
                opacity: editable ? 1 : 0.5,
              }}
            />
          ))}
        </View>

        <SectionHeader title="GÖRÜNÜM" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title="Üyeleri bu rolle ayrı göster (hoist)"
              value={role.hoist}
              disabled={!editable}
              onChange={(hoist) => void patch({ hoist })}
            />
          </ListGroup>
        </View>

        {/* Rol simgesi (Discord "role icon"). Discord'da Takviye seviye 2
            ister; Server Boost gelince orada kapanacak, şimdilik herkese açık. */}
        <SectionHeader title="ROL SİMGESİ" />
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          Üyelerin adının yanında görünür (en yüksek simgeli rolünki). Kare bir görsel (PNG, JPG, GIF ya da WebP; en fazla 256 KB) ya da bir emoji seç.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              backgroundColor: colors.raised,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon ? <RoleIconBadge icon={icon} size={32} /> : <Text style={{ ...typography.caption, color: colors.muted }}>Yok</Text>}
          </View>
          <ChipButton label={iconBusy ? "Yükleniyor…" : "Görsel yükle"} disabled={!editable || iconBusy} onPress={() => void uploadIcon()} busy={iconBusy} />
          <ChipButton label="Emoji seç" disabled={!editable} onPress={() => setEmojiOpen(true)} />
          {icon ? (
            <ChipButton
              label="Simgeyi kaldır"
              danger
              disabled={!editable}
              onPress={() => void patch({ iconUrl: null, iconEmoji: null }, "Rol simgesi kaydedilemedi.")}
            />
          ) : null}
        </View>

        <SectionHeader title="BAHSETME" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title="Herkesin bu rolden bahsetmesine izin ver"
              subtitle={'Not: "@herkes, @burada ve rolleri etiketle" izni olan üyeler bu rolden her zaman bahsedebilir.'}
              value={role.mentionable}
              disabled={!editable}
              onChange={(mentionable) => void patch({ mentionable })}
            />
          </ListGroup>
        </View>
      </ScrollView>

      <Modal visible={emojiOpen} transparent animationType="slide" onRequestClose={() => setEmojiOpen(false)}>
        <RNPressable onPress={() => setEmojiOpen(false)} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View
            onStartShouldSetResponder={() => true}
            style={{
              height: 440,
              marginHorizontal: spacing.sm,
              marginBottom: spacing.sm,
              borderRadius: radii.xl,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.bentoBorder,
              backgroundColor: colors.panel,
              overflow: "hidden",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Rol simgesi için emoji</Text>
              <Pressable onPress={() => setEmojiOpen(false)} accessibilityRole="button" accessibilityLabel="Kapat" style={{ padding: spacing.xs }}>
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <EmojiPickerPanel
              onEmoji={(emoji) => {
                setEmojiOpen(false);
                void patch({ iconEmoji: emoji, iconUrl: null }, "Rol simgesi kaydedilemedi.");
              }}
            />
          </View>
        </RNPressable>
      </Modal>
    </Screen>
  );
}

function ChipButton({
  label,
  onPress,
  disabled,
  danger,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: danger ? "transparent" : colors.raised,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : null}
      <Text style={{ ...typography.caption, ...fw(600), color: danger ? colors.danger : colors.text }}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
    </View>
  );
}
