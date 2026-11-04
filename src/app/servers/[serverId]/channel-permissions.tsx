import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useChannel } from "@/api/hooks";
import { useServerRoleDetails } from "@/api/hooks/use-roles";
import {
  useMemberLookup,
  useOverwrites,
  useSaveOverwrites,
  type OverwriteProfile,
  type OverwriteWire,
  type PermissionsResponse,
  type PermissionsTarget,
} from "@/api/hooks/use-channel-admin";
import {
  ActionSheet,
  Avatar,
  Button,
  ErrorState,
  Icon,
  ListSkeleton,
  Pressable,
  showDialog,
  showToast,
} from "@/components/ui";
import { Card, CardHeader, ToggleRow } from "@/features/moderation/ui";
import {
  CHANNEL_PERMISSION_DETAILS,
  CHANNEL_PERMISSION_GROUPS,
  channelPermissionBit,
  type ChannelPermissionKey,
} from "@/lib/channel-permissions";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kanal / Kategori İzinleri — web `channel-settings/permissions-tab.tsx`.
 *
 * Hedefler: @everyone, roller ve tek tek üyeler. Her izin için üç durum:
 * engelle (✕) / varsayılan (／) / izin (✓). Üstte "Özel Kanal" anahtarı.
 * Kategorideki kanal eşitliyse bilgi şeridi; eşitsizse "Kategoriyle Eşitle".
 * Kategori kaydedilirken eşitsiz kanallar varsa "Kanallar eşitlensin mi?"
 * sorulur (web permission-sync-prompt).
 */

const EVERYONE = "@everyone";
const ZERO = BigInt(0);

type OverwriteMap = Record<string, { allow: bigint; deny: bigint }>;
type TriState = "deny" | "neutral" | "allow";

const keyOf = (row: { roleId: string | null; profileId: string | null }) =>
  row.roleId ? `r:${row.roleId}` : row.profileId ? `p:${row.profileId}` : EVERYONE;

function fromKey(key: string): { roleId: string | null; profileId: string | null } {
  if (key.startsWith("r:")) return { roleId: key.slice(2), profileId: null };
  if (key.startsWith("p:")) return { roleId: null, profileId: key.slice(2) };
  return { roleId: null, profileId: null };
}

function toMap(rows: OverwriteWire[]): OverwriteMap {
  const map: OverwriteMap = {};
  for (const row of rows) {
    const key = keyOf(row);
    const prev = map[key] ?? { allow: ZERO, deny: ZERO };
    map[key] = { allow: prev.allow | BigInt(row.allow), deny: prev.deny | BigInt(row.deny) };
  }
  return map;
}

function fingerprint(map: OverwriteMap): string {
  return Object.keys(map)
    .filter((key) => map[key].allow !== ZERO || map[key].deny !== ZERO)
    .sort()
    .map((key) => `${key}:${map[key].allow}:${map[key].deny}`)
    .join("|");
}

function stateOf(entry: OverwriteMap[string] | undefined, bit: bigint): TriState {
  if (!entry) return "neutral";
  if ((entry.deny & bit) === bit) return "deny";
  if ((entry.allow & bit) === bit) return "allow";
  return "neutral";
}

function withState(entry: OverwriteMap[string] | undefined, bit: bigint, next: TriState) {
  const current = entry ?? { allow: ZERO, deny: ZERO };
  return {
    allow: next === "allow" ? current.allow | bit : current.allow & ~bit,
    deny: next === "deny" ? current.deny | bit : current.deny & ~bit,
  };
}

export default function ChannelPermissionsScreen() {
  const { serverId, channelId, categoryId } = useLocalSearchParams<{ serverId: string; channelId?: string; categoryId?: string }>();
  const target: PermissionsTarget = channelId ? { kind: "channel", channelId } : { kind: "category", categoryId: categoryId ?? "" };
  const channel = useChannel(serverId, channelId);
  const roles = useServerRoleDetails(serverId);
  const query = useOverwrites(serverId, target);
  const save = useSaveOverwrites(serverId, target);

  const [initial, setInitial] = useState<OverwriteMap>({});
  const [draft, setDraft] = useState<OverwriteMap>({});
  const [profiles, setProfiles] = useState<Record<string, OverwriteProfile>>({});
  const [selected, setSelected] = useState<string>(EVERYONE);
  const [picking, setPicking] = useState(false);

  const apply = (data: PermissionsResponse) => {
    const map = toMap(data.overwrites ?? []);
    setInitial(map);
    setDraft(map);
    setProfiles((prev) => ({ ...prev, ...Object.fromEntries((data.profiles ?? []).map((p) => [p.id, p])) }));
  };
  const loadedAt = query.dataUpdatedAt;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (query.data) apply(query.data);
  }, [loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = query.data;
  const canManage = target.kind === "channel" ? meta?.viewer?.canManagePermissions !== false : meta?.canManage !== false;
  const locked = !canManage || save.isPending;
  const isDirty = useMemo(() => fingerprint(draft) !== fingerprint(initial), [draft, initial]);
  const isCategory = target.kind === "category";
  const unsynced = (meta?.channels ?? []).filter((c) => !c.permissionsSynced);

  const viewBit = channelPermissionBit("VIEW_CHANNELS");
  const isPrivate = stateOf(draft[EVERYONE], viewBit) === "deny";
  const setPrivate = (next: boolean) =>
    setDraft((prev) => ({ ...prev, [EVERYONE]: withState(prev[EVERYONE], viewBit, next ? "deny" : "neutral") }));
  const setState = (key: string, permission: ChannelPermissionKey, next: TriState) =>
    setDraft((prev) => ({ ...prev, [key]: withState(prev[key], channelPermissionBit(permission), next) }));

  const fail = (fallback: string) => (error: unknown) =>
    showToast(error instanceof ApiError ? error.message : fallback, "error");

  const submit = (syncChannelIds: string[] = []) => {
    const overwrites: OverwriteWire[] = Object.entries(draft)
      .filter(([, entry]) => entry.allow !== ZERO || entry.deny !== ZERO)
      .map(([key, entry]) => ({ ...fromKey(key), allow: entry.allow.toString(), deny: entry.deny.toString() }));
    save.mutate(isCategory ? { overwrites, syncChannelIds } : { overwrites }, {
      onSuccess: (data) => {
        apply(data);
        showToast(isCategory ? "Kategori izinleri kaydedildi" : "Kanal izinleri kaydedildi");
      },
      onError: fail("İzinler kaydedilemedi"),
    });
  };

  const onSave = () => {
    if (!canManage || save.isPending) return;
    // Kategori: eşitsiz kanallar bu değişikliği almaz — Discord gibi sor.
    if (isCategory && unsynced.length > 0) {
      const names = unsynced.slice(0, 5).map((c) => c.name).join(", ") + (unsynced.length > 5 ? "…" : "");
      showDialog(
        "Kanallar eşitlensin mi?",
        `Bu kategorideki ${unsynced.length} kanalın izinleri kategoriyle eşitlenmemiş: ${names}. Kategoriyle eşitlersen kanalların kendi izinleri silinir ve kategorinin izinlerini kullanırlar.`,
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Geçerli İzinleri Koru", onPress: () => submit([]) },
          { text: "Kategoriyle Eşitle", onPress: () => submit(unsynced.map((c) => c.id)) },
        ]
      );
      return;
    }
    submit();
  };

  const syncWithCategory = () =>
    save.mutate(
      { synced: true },
      {
        onSuccess: (data) => {
          apply(data);
          showToast("Kanal kategoriyle eşitlendi");
        },
        onError: fail("Eşitlenemedi"),
      }
    );

  const roleTargets = [
    { id: EVERYONE, name: "@everyone", color: null as string | null },
    ...(roles.data ?? []).map((role) => ({ id: `r:${role.id}`, name: role.name, color: role.color })),
  ];
  const memberKeys = Object.keys(draft).filter((key) => key.startsWith("p:"));
  const memberIds = new Set(memberKeys.map((key) => key.slice(2)));
  const hasCustom = (key: string) => Boolean(draft[key] && (draft[key].allow !== ZERO || draft[key].deny !== ZERO));

  const addMember = (profile: OverwriteProfile) => {
    setProfiles((prev) => ({ ...prev, [profile.id]: profile }));
    const key = `p:${profile.id}`;
    setDraft((prev) => (prev[key] ? prev : { ...prev, [key]: { allow: ZERO, deny: ZERO } }));
    setSelected(key);
  };
  const removeMember = (key: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (selected === key) setSelected(EVERYONE);
  };

  // Ses kanalında metin/uygulama izinleri anlamsız; kategori hepsini kapsar.
  const isVoice = channel ? channel.type !== "TEXT" : false;
  const groups = CHANNEL_PERMISSION_GROUPS.filter((group) => {
    if (isCategory) return true;
    return isVoice
      ? group.title === "Genel Kanal İzinleri" || group.title === "Üyelik İzinleri" || group.voiceOnly
      : !group.voiceOnly;
  });

  const selectedLabel = selected.startsWith("p:")
    ? (profiles[selected.slice(2)]?.name ?? profiles[selected.slice(2)]?.username ?? "Üye")
    : (roleTargets.find((item) => item.id === selected)?.name ?? "@everyone");

  const title = isCategory ? "Kategori İzinleri" : "Kanal İzinleri";

  if (query.isLoading || roles.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title }} />
        <ListSkeleton rows={8} />
      </View>
    );
  }
  if (query.error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title }} />
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : "İzinler yüklenemedi"}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          {isCategory
            ? "Kategoriyle eşitli kanallar bu izinleri kullanır. Yöneticiler ve sunucu sahibi bu kısıtlamalardan etkilenmez."
            : "Bu kanalda kimin ne yapabileceğini rol ya da üye bazında ayarla. Yöneticiler ve sunucu sahibi bu kısıtlamalardan etkilenmez."}
        </Text>

        {!isCategory && meta?.category ? (
          <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.brandSoft }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Icon name="link" size={16} color={colors.brand} />
            <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>
              İzinler <Text style={fw(700)}>{meta.category.name}</Text> kategorisiyle{" "}
              {meta.synced ? "eşitli. Burada değişiklik kaydedersen eşitleme kalkar." : "eşitli değil."}
            </Text>
            </View>
            {!meta.synced && canManage ? (
              <Button label="Kategoriyle Eşitle" disabled={save.isPending || isDirty} onPress={syncWithCategory} />
            ) : null}
          </View>
        ) : null}

        {isCategory && (meta?.channels?.length ?? 0) > 0 ? (
          <Card>
            <CardHeader title="Kanallar" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {meta!.channels!.map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radii.full,
                    backgroundColor: c.permissionsSynced ? colors.brandSoft : colors.raised,
                  }}
                  accessibilityLabel={`${c.name}, ${c.permissionsSynced ? "kategoriyle eşitli" : "kendi izinleri var"}`}
                >
                  {c.permissionsSynced ? <Icon name="link" size={11} color={colors.brand} /> : null}
                  <Text style={{ ...typography.caption, ...fw(600), color: c.permissionsSynced ? colors.brand : colors.muted }}>{c.name}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <ToggleRow
            title={isCategory ? "Özel Kategori" : "Özel Kanal"}
            hint="Yalnızca seçilen roller ve üyeler görür. Açınca @everyone için “Kanalı Görüntüle” kapanır; görmesi gerekenlere aşağıdaki listeden ✓ ver."
            value={isPrivate}
            disabled={locked}
            onChange={setPrivate}
          />
        </Card>

        <Card>
          <CardHeader icon="users" title="Roller" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {roleTargets.map((item) => (
              <TargetChip
                key={item.id}
                label={item.name}
                color={item.color}
                active={selected === item.id}
                custom={hasCustom(item.id)}
                onPress={() => setSelected(item.id)}
              />
            ))}
          </View>
          {(roles.data ?? []).length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Henüz rol yok; roller Sunucu Ayarları → Roller sekmesinden oluşturulur.
            </Text>
          ) : null}
          <CardHeader icon="user" title="Üyeler" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {memberKeys.map((key) => {
              const p = profiles[key.slice(2)];
              return (
                <TargetChip
                  key={key}
                  label={p?.name ?? p?.username ?? "Ayrılmış üye"}
                  avatar={{ id: key.slice(2), imageUrl: p?.imageUrl ?? null, fallback: p?.username ?? key }}
                  active={selected === key}
                  custom={hasCustom(key)}
                  onPress={() => setSelected(key)}
                  onRemove={locked ? undefined : () => removeMember(key)}
                />
              );
            })}
            {!locked ? (
              <Pressable
                onPress={() => setPicking(true)}
                haptic="light"
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  minHeight: 32,
                  paddingHorizontal: 10,
                  borderRadius: radii.full,
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                <Icon name="plus" size={14} color={colors.brand} />
                <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Üye ekle</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>
          Düzenlenen: <Text style={{ color: colors.bright }}>{selectedLabel}</Text>
        </Text>

        {groups.map((group) => (
          <Card key={group.title}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{group.title}</Text>
            {group.keys.map((key, index) => {
              const detail = CHANNEL_PERMISSION_DETAILS[key];
              return (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: spacing.md,
                    paddingTop: index === 0 ? 0 : spacing.md,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ ...typography.caption, ...fw(700), color: colors.text }}>{detail.title}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>{detail.description}</Text>
                  </View>
                  <TriStateControl
                    value={stateOf(draft[selected], channelPermissionBit(key))}
                    disabled={locked}
                    label={detail.title}
                    onChange={(next) => setState(selected, key, next)}
                  />
                </View>
              );
            })}
          </Card>
        ))}
      </ScrollView>

      {canManage && isDirty ? (
        <View
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.xl,
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button label="Sıfırla" variant="secondary" fullWidth disabled={save.isPending} onPress={() => setDraft(initial)} />
          </View>
          <View style={{ flex: 2 }}>
            <Button label="Değişiklikleri Kaydet" fullWidth loading={save.isPending} onPress={onSave} />
          </View>
        </View>
      ) : null}

      <MemberPickerSheet
        serverId={serverId}
        visible={picking}
        exclude={memberIds}
        onClose={() => setPicking(false)}
        onPick={(profile) => {
          addMember(profile);
          setPicking(false);
        }}
      />
    </View>
  );
}

function TargetChip({
  label,
  color,
  avatar,
  active,
  custom,
  onPress,
  onRemove,
}: {
  label: string;
  color?: string | null;
  avatar?: { id: string; imageUrl: string | null; fallback: string };
  active: boolean;
  custom: boolean;
  onPress: () => void;
  onRemove?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      haptic="light"
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}${custom ? ", özelleştirildi" : ""}`}
      accessibilityHint={onRemove ? "Basılı tutarak listeden kaldır" : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 32,
        paddingHorizontal: 10,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : "transparent",
      }}
    >
      {avatar ? (
        <Avatar profileId={avatar.id} imageUrl={avatar.imageUrl} fallbackText={avatar.fallback} size={18} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color || colors.muted }} />
      )}
      <Text style={{ ...typography.caption, ...fw(active ? 700 : 500), color: active ? colors.bright : colors.muted }} numberOfLines={1}>
        {label}
      </Text>
      {custom ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand }} /> : null}
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="Üyeyi listeden kaldır">
          <Icon name="close" size={12} color={colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Discord'un ✕ ／ ✓ üçlüsü. */
function TriStateControl({
  value,
  disabled,
  label,
  onChange,
}: {
  value: TriState;
  disabled: boolean;
  label: string;
  onChange: (next: TriState) => void;
}) {
  const options: { id: TriState; text: string; a11y: string; on: string }[] = [
    { id: "deny", text: "✕", a11y: "Engelle", on: colors.danger },
    { id: "neutral", text: "／", a11y: "Varsayılan", on: colors.raised },
    { id: "allow", text: "✓", a11y: "İzin ver", on: colors.success },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        overflow: "hidden",
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map((option, index) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            disabled={disabled}
            haptic="light"
            noHitSlop
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            accessibilityLabel={option.a11y}
            style={{
              width: 38,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: colors.border,
              backgroundColor: active ? option.on : "transparent",
            }}
          >
            <Text
              style={{
                ...typography.bodyStrong,
                color: active && option.id !== "neutral" ? "#ffffff" : active ? colors.bright : colors.muted,
              }}
            >
              {option.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Üye ekle: sunucu üyelerinde ad önekiyle arama (`/api/members`). */
function MemberPickerSheet({
  serverId,
  visible,
  exclude,
  onClose,
  onPick,
}: {
  serverId: string;
  visible: boolean;
  exclude: ReadonlySet<string>;
  onClose: () => void;
  onPick: (profile: OverwriteProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const lookup = useMemberLookup(serverId, debounced, visible);
  // Sayfa kaydırmıyor: klavye açıkken sığacak kadar sonuç; arama daraltır.
  const items = (lookup.data ?? []).filter((m) => !exclude.has(m.id)).slice(0, 6);

  return (
    <ActionSheet
      visible={visible}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      header={
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            minHeight: 40,
            borderRadius: radii.md,
            backgroundColor: colors.raised,
          }}
        >
          <Icon name="search" size={15} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Üye ara"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            autoCapitalize="none"
            style={{ ...typography.body, color: colors.text, flex: 1, paddingVertical: spacing.sm }}
          />
        </View>
      }
      items={
        items.length > 0
          ? items.map((m) => ({
              key: m.id,
              label: m.name ?? m.username,
              detail: `@${m.username}`,
              icon: "user" as const,
              avatar: { imageUrl: m.imageUrl, fallbackText: m.username },
              onPress: () => onPick(m),
            }))
          : [
              {
                key: "empty",
                label: lookup.isFetching ? "Aranıyor…" : "Üye bulunamadı.",
                icon: "search" as const,
                onPress: () => undefined,
              },
            ]
      }
    />
  );
}
