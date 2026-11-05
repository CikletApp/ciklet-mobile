import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import {
  hasServerPermission,
  useMyPermissions,
  useServerDetails,
  useServerMemberPages,
  useServerRoleDetails,
  useUpdateRole,
  type RoleUpdate,
  type ServerRoleDetails,
} from "@/api/hooks";
import { useCreateRole, useDeleteRole, useToggleRoleMember, useUpdateRolePermissions } from "@/api/hooks/use-server-admin";
import type { MyServerPermissions } from "@/api/types";
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  Icon,
  ListGroup,
  Pressable,
  Screen,
  ScreenLoader,
  SectionHeader,
  TextField,
  showDialog,
  showToast,
} from "@/components/ui";
import { ROLE_PERMISSIONS, ROLE_PERMISSION_GROUPS, roleHasPermission, toggleRolePermission } from "@/lib/role-permissions";
import { EmojiPickerPanel } from "@/features/chat/components/emoji-picker";
import { RoleIconBadge } from "@/features/server/role-icon-badge";
import { BoostLockedPill } from "@/features/server-boost/boost-ui";
import { BOOST_PINK, effectiveServerPerks, requiredTier } from "@/lib/server-boost";
import { pickAndUploadRoleIcon } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

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
 * rol oluşturma (önce ad/renk, sonra "Oluştur"), ad, renk, ayrı gösterme
 * (hoist), rol simgesi (görsel ya da emoji), "Herkesin bu rolden
 * bahsetmesine izin ver", izin matrisi, üye atama ve rolü silme. Yetki
 * "Rolleri Yönet" — uç ayrıca rol hiyerarşisini ve aktörde olmayan izin
 * bitlerini denetler.
 */
export default function ServerRolesScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: roles, isLoading } = useServerRoleDetails(serverId);
  const { data: actor } = useMyPermissions(serverId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canManage = hasServerPermission(actor, "MANAGE_ROLES");
  const create = useCreateRole(serverId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);

  const selected = roles?.find((role) => role.id === selectedId) ?? null;

  if (isLoading) return <ScreenLoader label="Roller yükleniyor…" />;

  if (selected) {
    return <RoleEditor serverId={serverId} role={selected} editable={canEditRole(actor, selected)} onBack={() => setSelectedId(null)} />;
  }

  const cancelCreate = () => {
    setCreating(false);
    setNewName("");
    setNewColor(null);
  };

  const submitCreate = () => {
    const name = newName.trim().slice(0, ROLE_NAME_MAX);
    if (!name || create.isPending) return;
    create.mutate(
      { name, color: newColor },
      {
        onSuccess: (role) => {
          cancelCreate();
          // Oluşturduktan sonra düzenlemeye geç (web ile aynı).
          if (role?.id) setSelectedId(role.id);
        },
        onError: (error) => showToast(userErrorMessage(error, "Rol oluşturulamadı."), "error"),
      }
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Roller — ${roles?.length ?? 0}` }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
        {canManage && !creating ? (
          <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Button label="Rol Oluştur" icon="plus" onPress={() => setCreating(true)} />
          </View>
        ) : null}
        {creating ? (
          <View
            style={{
              marginHorizontal: spacing.lg,
              marginTop: spacing.md,
              padding: spacing.lg,
              gap: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.brand,
              backgroundColor: colors.panel,
            }}
          >
            <Text style={{ ...typography.overline, color: colors.muted }}>YENİ ROL</Text>
            <TextField
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={submitCreate}
              maxLength={ROLE_NAME_MAX}
              placeholder="Rol adı (örn. Moderatör)"
              autoFocus
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
              <Pressable
                onPress={() => setNewColor(null)}
                accessibilityRole="button"
                accessibilityLabel="Renksiz"
                accessibilityState={{ selected: !newColor }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: !newColor ? colors.brand : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ ...typography.caption, color: colors.muted }}>—</Text>
              </Pressable>
              {SWATCHES.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setNewColor(color)}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  accessibilityState={{ selected: newColor === color }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: color,
                    borderWidth: 2,
                    borderColor: newColor === color ? colors.bright : "transparent",
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
              <Button label="Vazgeç" variant="ghost" onPress={cancelCreate} />
              <Button
                label={create.isPending ? "Oluşturuluyor…" : "Oluştur"}
               
                disabled={!newName.trim() || create.isPending}
                onPress={submitCreate}
              />
            </View>
          </View>
        ) : null}
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
                      {role.premiumSubscriber ? <Icon name="gem" size={14} color={BOOST_PINK} /> : null}
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
  // Rol simgesi Takviye Seviye 2 ister (uç 403 premium_tier_required);
  // seviyesi düşen sunucuda mevcut simge kalır, kaldırmak serbest.
  const { data: server } = useServerDetails(serverId);
  const iconsLocked = !effectiveServerPerks(server).roleIcons;
  const [name, setName] = useState(role.name);
  const [iconBusy, setIconBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const updatePermissions = useUpdateRolePermissions(serverId);
  const toggleMember = useToggleRoleMember(serverId);
  const removeRole = useDeleteRole(serverId);
  const memberPages = useServerMemberPages(serverId, "");
  const members = useMemo(() => memberPages.data?.pages.flatMap((page) => page.items) ?? [], [memberPages.data]);
  /** Yanıt gelene kadar anahtarın yeni hâli (liste tazelenince düşer). */
  const [assignOverride, setAssignOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(role.name);
  }, [role.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPermission = (key: keyof typeof ROLE_PERMISSIONS, on: boolean) => {
    if (!editable) return;
    updatePermissions.mutate(
      { roleId: role.id, permissions: toggleRolePermission(role.permissions, key, on) },
      { onError: (error) => showToast(userErrorMessage(error, "İzinler kaydedilemedi."), "error") }
    );
  };

  const assign = (memberId: string, assigned: boolean) => {
    setAssignOverride((map) => ({ ...map, [memberId]: assigned }));
    toggleMember.mutate(
      { roleId: role.id, memberId, assigned },
      {
        onError: (error) => {
          setAssignOverride((map) => ({ ...map, [memberId]: !assigned }));
          showToast(userErrorMessage(error, "Rol atanamadı."), "error");
        },
      }
    );
  };

  const confirmDelete = () =>
    showDialog(`"${role.name}" rolü silinsin mi?`, "Bu rolü taşıyan üyelerden de kaldırılır.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Rolü Sil",
        style: "destructive",
        onPress: () =>
          removeRole.mutate(role.id, {
            onSuccess: onBack,
            onError: (error) => showToast(userErrorMessage(error, "Rol silinemedi."), "error"),
          }),
      },
    ]);

  const patch = (input: RoleUpdate, failure = "Rol kaydedilemedi.") =>
    update.mutateAsync({ roleId: role.id, input }).catch((error: unknown) => {
      showToast(userErrorMessage(error, failure), "error");
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
      showToast(userErrorMessage(error, "Rol simgesi yüklenemedi."), "error");
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
        {/* Yönetilen rol (web role-service metni): atama/silme yok. */}
        {role.premiumSubscriber ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            <Icon name="gem" size={14} color={BOOST_PINK} />
            <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
              Server Booster rolü takviye edenlere kendiliğinden verilir; elle atanamaz.
            </Text>
          </View>
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

        {/* Rol simgesi (Discord "role icon") — Takviye Seviye 2 (lib/server-boost). */}
        <SectionHeader title="ROL SİMGESİ" />
        {iconsLocked ? (
          <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
            <BoostLockedPill tier={requiredTier("roleIcons")} />
          </View>
        ) : null}
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
          <ChipButton label={iconBusy ? "Yükleniyor…" : "Görsel yükle"} disabled={!editable || iconBusy || iconsLocked} onPress={() => void uploadIcon()} busy={iconBusy} />
          <ChipButton label="Emoji seç" disabled={!editable || iconsLocked} onPress={() => setEmojiOpen(true)} />
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

        {/* İzinler (web roles-tab, lib/role-permissions ROLE_PERMISSION_GROUPS). */}
        <SectionHeader title="İZİNLER" />
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          Bu rolü taşıyanlara sunucu genelinde eklenen yetkiler. Kanal ayarları bunları kanal bazında kısıtlayabilir. Kendinde olmayan bir izni veremezsin.
        </Text>
        {ROLE_PERMISSION_GROUPS.map((group) => (
          <View key={group.title} style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, ...fw(600), color: colors.muted, marginBottom: spacing.xs }}>{group.title}</Text>
            <ListGroup>
              {group.keys.map((key, index) => (
                <View key={key}>
                  {index > 0 ? <Divider inset={16} /> : null}
                  <ToggleRow
                    title={ROLE_PERMISSIONS[key].title}
                    titleColor={key === "ADMINISTRATOR" ? colors.danger : undefined}
                    subtitle={ROLE_PERMISSIONS[key].description}
                    value={roleHasPermission(role.permissions, key)}
                    disabled={!editable}
                    onChange={(on) => setPermission(key, on)}
                  />
                </View>
              ))}
            </ListGroup>
          </View>
        ))}

        {/* Üye atama (web: POST /roles/{id}/members). */}
        <SectionHeader title="ÜYELER" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {members.length === 0 && memberPages.isLoading ? (
            <ActivityIndicator color={colors.muted} style={{ paddingVertical: spacing.lg }} />
          ) : (
            <ListGroup>
              {members.map((member, index) => {
                const assigned = assignOverride[member.id] ?? member.roles.some((item) => item.id === role.id);
                const label = member.nickname?.trim() || member.profile.name?.trim() || member.profile.username;
                return (
                  <View key={member.id}>
                    {index > 0 ? <Divider inset={56} /> : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm,
                        opacity: !editable || role.premiumSubscriber ? 0.6 : 1,
                      }}
                    >
                      <Avatar profileId={member.profile.id} imageUrl={member.profile.imageUrl} fallbackText={member.profile.username} size={28} />
                      <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={1}>
                        {label}
                      </Text>
                      <Switch
                        value={assigned}
                        disabled={!editable || role.premiumSubscriber === true}
                        onValueChange={(next) => assign(member.id, next)}
                        trackColor={{ false: colors.border, true: colors.brand }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>
                );
              })}
            </ListGroup>
          )}
          {memberPages.hasNextPage ? (
            <Pressable
              onPress={() => void memberPages.fetchNextPage()}
              disabled={memberPages.isFetchingNextPage}
              accessibilityRole="button"
              style={{ alignItems: "center", paddingVertical: spacing.md }}
            >
              {memberPages.isFetchingNextPage ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>Daha fazla üye yükle</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {editable && !role.premiumSubscriber ? (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}
          >
            <Icon name="trash" size={16} color={colors.danger} />
            <Text style={{ ...typography.body, ...fw(600), color: colors.danger }}>Rolü Sil</Text>
          </Pressable>
        ) : null}
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
  titleColor,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  titleColor?: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: titleColor ?? colors.text }}>{title}</Text>
        {subtitle ? <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
    </View>
  );
}
