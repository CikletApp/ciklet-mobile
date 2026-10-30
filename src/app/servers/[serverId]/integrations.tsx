import { useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  MAX_WEBHOOKS_PER_SERVER,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  STREAMING_PLATFORMS,
  WEBHOOK_NAME_MAX,
  hasServerPermission,
  useCreateLinkedRole,
  useCreateWebhook,
  useDeleteLinkedRole,
  useDeleteWebhook,
  useLinkedRoles,
  useMyPermissions,
  useRemoveIntegration,
  useRotateWebhook,
  useServerIntegrations,
  useServerRoleDetails,
  useServerWebhooks,
  useUpdateWebhook,
  type LinkedRoleRequirement,
  type ServerWebhook,
  type StreamingPlatform,
} from "@/api/hooks";
import {
  ActionSheet,
  type ActionSheetItem,
  Avatar,
  Button,
  Icon,
  type IconName,
  IconButton,
  KeyboardAvoider,
  Pressable,
  Screen,
  TextField,
  showToast,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { pickAndUploadServerImage } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Ayarları › Entegrasyonlar — web `integrations-tab.tsx` +
 * `webhooks-section.tsx` + `linked-roles-section.tsx`'in mobil karşılığı:
 * kurulu botlar (kaldırma "Sunucuyu Yönet"), gelen webhook'lar ("Webhook'ları
 * Yönet") ve bağlantılı roller (yalnızca sunucu sahibi). Webhook URL'si
 * yalnızca oluşturma ve token yenileme yanıtında gelir (sunucu özetini
 * saklar); o an gösterilip panoya kopyalanır.
 */
export default function ServerIntegrationsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: permissions } = useMyPermissions(serverId);
  const canManage = hasServerPermission(permissions, "MANAGE_SERVER");
  const canManageWebhooks = hasServerPermission(permissions, "MANAGE_WEBHOOKS");

  return (
    <Screen>
      <Stack.Screen options={{ title: "Entegrasyonlar" }} />
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing["2xl"], paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
          <BotsSection serverId={serverId} canManage={canManage} />
          {canManageWebhooks ? <WebhooksSection serverId={serverId} /> : null}
          <LinkedRolesSection serverId={serverId} />
        </ScrollView>
      </KeyboardAvoider>
    </Screen>
  );
}

function SectionTitle({ icon, title, description }: { icon: IconName; title: string; description?: string }) {
  return (
    <View style={{ gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Icon name={icon} size={16} color={colors.brand} />
        <Text style={{ ...typography.overline, color: colors.muted, flexShrink: 1 }}>{title.toLocaleUpperCase("tr-TR")}</Text>
      </View>
      {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: colors.panel,
      }}
    >
      {children}
    </View>
  );
}

function SelectRow({ label, placeholder, disabled, onPress }: { label: string | null; placeholder?: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label ?? placeholder}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : colors.panel,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ ...typography.body, color: label ? colors.text : colors.muted, flex: 1 }} numberOfLines={1}>
        {label ?? placeholder}
      </Text>
      <Icon name="chevron-down" size={16} color={colors.muted} />
    </Pressable>
  );
}

// ── Kurulu botlar ──────────────────────────────────────────────────

function BotsSection({ serverId, canManage }: { serverId: string; canManage: boolean }) {
  const { data: items, isLoading } = useServerIntegrations(serverId);
  const remove = useRemoveIntegration(serverId);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle icon="sparkles" title="Entegrasyonlar" description="Sunucuya kurulu botları yönet." />
      {isLoading ? (
        <ActivityIndicator color={colors.muted} style={{ padding: spacing.xl }} />
      ) : !items || items.length === 0 ? (
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing["2xl"] }}>
          <Icon name="sparkles" size={36} color={colors.muted} />
          <Text style={{ ...typography.body, color: colors.muted }}>Kurulu bot yok.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((it) => (
            <Row key={it.id}>
              <Avatar imageUrl={it.profile?.imageUrl ?? null} fallbackText={it.profile?.username ?? "bot"} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                  {it.profile?.name || it.profile?.username}
                  <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>{"  BOT"}</Text>
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>{`${formatDate(it.createdAt)} tarihinde eklendi`}</Text>
              </View>
              {canManage ? (
                <IconButton
                  icon="trash"
                  label="Kaldır"
                  tint={colors.danger}
                  disabled={remove.isPending && remove.variables === it.botId}
                  onPress={() => remove.mutate(it.botId)}
                />
              ) : null}
            </Row>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Gelen webhook'lar ──────────────────────────────────────────────

async function copyUrl(url: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(url);
    showToast("Webhook URL'si kopyalandı");
  } catch {
    showToast("Panoya kopyalanamadı", "error");
  }
}

function WebhooksSection({ serverId }: { serverId: string }) {
  const { data, isLoading } = useServerWebhooks(serverId);
  const create = useCreateWebhook(serverId);
  const rotate = useRotateWebhook(serverId);
  const remove = useDeleteWebhook(serverId);
  const [name, setName] = useState("");
  const [pickedChannelId, setChannelId] = useState<string | null>(null);
  const [channelPicker, setChannelPicker] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; url: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = data?.webhooks ?? [];
  const channels = data?.channels ?? [];
  // Web: ilk metin kanalı varsayılan seçili.
  const channelId = pickedChannelId ?? channels[0]?.id ?? null;
  const channel = channels.find((c) => c.id === channelId);
  const busyId = rotate.isPending ? rotate.variables : remove.isPending ? remove.variables : null;

  const onCreate = () => {
    if (!channelId || create.isPending) return;
    create.mutate(
      { name: name.trim() || "Webhook", channelId },
      {
        onSuccess: (res) => {
          setRevealed({ id: res.id, url: res.url });
          setName("");
          void copyUrl(res.url);
        },
        onError: (e) => showToast(e instanceof ApiError ? e.message : "Webhook oluşturulamadı", "error"),
      }
    );
  };

  const onRotate = (id: string) =>
    rotate.mutate(id, {
      onSuccess: (res) => {
        setRevealed({ id, url: res.url });
        void copyUrl(res.url);
      },
      onError: (e) => showToast(e instanceof ApiError ? e.message : "Token yenilenemedi", "error"),
    });

  const onRemove = (id: string) =>
    remove.mutate(id, {
      onSuccess: () => {
        if (revealed?.id === id) setRevealed(null);
        if (editingId === id) setEditingId(null);
      },
      onError: (e) => showToast(e instanceof ApiError ? e.message : "Webhook silinemedi", "error"),
    });

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle
        icon="link"
        title={`Gelen Webhook'lar — ${items.length}/${MAX_WEBHOOKS_PER_SERVER}`}
        description="Bir URL ile dış servislerden (GitHub, Jira, izleme araçları) kanala mesaj düşürür. Gövde Discord webhook biçimiyle aynıdır; URL'yi bilen herkes mesaj yazabilir, gizli tutun."
      />

      <View style={{ gap: spacing.sm }}>
        <TextField value={name} onChangeText={setName} maxLength={WEBHOOK_NAME_MAX} placeholder="Webhook adı (ör. GitHub)" />
        <SelectRow label={channel ? `#${channel.name}` : null} placeholder="Kanal seç" onPress={() => setChannelPicker(true)} />
        <Button
          label="Webhook Oluştur"
          icon="plus"
          onPress={onCreate}
          loading={create.isPending}
          disabled={!channelId || items.length >= MAX_WEBHOOKS_PER_SERVER}
          fullWidth
        />
      </View>

      {revealed ? (
        <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandSoft }}>
          <Text style={{ ...typography.overline, color: colors.brand }}>{"WEBHOOK URL'Sİ — YALNIZCA ŞİMDİ GÖSTERİLİR"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text selectable style={{ ...typography.caption, color: colors.text, flex: 1, fontFamily: "monospace" }} numberOfLines={2}>
              {revealed.url}
            </Text>
            <IconButton icon="copy" label="Kopyala" onPress={() => void copyUrl(revealed.url)} />
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.muted} style={{ padding: spacing.lg }} />
      ) : items.length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", paddingVertical: spacing.lg }}>Henüz webhook yok.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((w) => (
            <View key={w.id} style={{ gap: spacing.xs }}>
              <Row>
                {w.avatarUrl ? (
                  <Avatar imageUrl={w.avatarUrl} fallbackText={w.name} size={36} shape="squircle" />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
                    <Icon name="link" size={16} color={colors.brand} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{w.name}</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>{`#${w.channelName} · ${formatDate(w.createdAt)}`}</Text>
                </View>
                <IconButton icon="pencil" label="Düzenle" onPress={() => setEditingId(editingId === w.id ? null : w.id)} />
                <IconButton icon="rotate-ccw" label="Token'ı yenile (eski URL geçersiz olur)" disabled={busyId === w.id} onPress={() => onRotate(w.id)} />
                <IconButton icon="trash" label="Sil" tint={colors.danger} disabled={busyId === w.id} onPress={() => onRemove(w.id)} />
              </Row>
              {editingId === w.id ? (
                <WebhookEditor serverId={serverId} webhook={w} channels={channels} onDone={() => setEditingId(null)} />
              ) : null}
            </View>
          ))}
        </View>
      )}

      <ActionSheet
        visible={channelPicker}
        onClose={() => setChannelPicker(false)}
        items={channels.map((c) => ({
          key: c.id,
          label: `#${c.name}`,
          icon: (c.id === channelId ? "check" : "hash") as IconName,
          onPress: () => {
            setChannelId(c.id);
            setChannelPicker(false);
          },
        }))}
      />
    </View>
  );
}

/** Ad / kanal / avatar düzenleme (`PATCH /webhooks/:id`; bot profili de aynı ada ve görsele geçer). */
function WebhookEditor({
  serverId,
  webhook,
  channels,
  onDone,
}: {
  serverId: string;
  webhook: ServerWebhook;
  channels: { id: string; name: string }[];
  onDone: () => void;
}) {
  const update = useUpdateWebhook(serverId);
  const [name, setName] = useState(webhook.name);
  const [channelId, setChannelId] = useState(webhook.channelId);
  const [avatarUrl, setAvatarUrl] = useState(webhook.avatarUrl);
  const [picker, setPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const channel = channels.find((c) => c.id === channelId);
  const dirty = name.trim() !== webhook.name || channelId !== webhook.channelId || avatarUrl !== webhook.avatarUrl;

  const changeAvatar = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const url = await pickAndUploadServerImage();
      if (url) setAvatarUrl(url);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Görsel yüklenemedi.", "error");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!dirty || update.isPending) return;
    update.mutate(
      {
        webhookId: webhook.id,
        input: {
          ...(name.trim() !== webhook.name ? { name: name.trim() || "Webhook" } : {}),
          ...(channelId !== webhook.channelId ? { channelId } : {}),
          ...(avatarUrl !== webhook.avatarUrl ? { avatarUrl } : {}),
        },
      },
      {
        onSuccess: onDone,
        onError: (e) => showToast(e instanceof ApiError ? e.message : "Webhook kaydedilemedi", "error"),
      }
    );
  };

  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable onPress={() => void changeAvatar()} accessibilityRole="button" accessibilityLabel="Avatarı değiştir">
          {avatarUrl ? (
            <Avatar imageUrl={avatarUrl} fallbackText={name || "Webhook"} size={48} shape="squircle" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
              <Icon name="image" size={20} color={colors.brand} />
            </View>
          )}
          {uploading ? <ActivityIndicator color={colors.brand} style={{ position: "absolute", inset: 0 }} /> : null}
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
          <Button label="Avatarı değiştir" variant="secondary" onPress={() => void changeAvatar()} disabled={uploading} />
          {avatarUrl ? <Button label="Kaldır" variant="ghost" onPress={() => setAvatarUrl(null)} disabled={uploading} /> : null}
        </View>
      </View>
      <TextField label="AD" value={name} onChangeText={setName} maxLength={WEBHOOK_NAME_MAX} placeholder="Webhook adı (ör. GitHub)" />
      <SelectRow label={channel ? `#${channel.name}` : `#${webhook.channelName}`} onPress={() => setPicker(true)} />
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
        <Button label="Vazgeç" variant="ghost" onPress={onDone} />
        <Button label="Kaydet" onPress={save} loading={update.isPending} disabled={!dirty || uploading} />
      </View>
      <ActionSheet
        visible={picker}
        onClose={() => setPicker(false)}
        items={channels.map((c) => ({
          key: c.id,
          label: `#${c.name}`,
          icon: (c.id === channelId ? "check" : "hash") as IconName,
          onPress: () => {
            setChannelId(c.id);
            setPicker(false);
          },
        }))}
      />
    </View>
  );
}

// ── Bağlantılı roller ──────────────────────────────────────────────

function LinkedRolesSection({ serverId }: { serverId: string }) {
  const t = useT();
  const { data } = useLinkedRoles(serverId);
  const { data: roleList } = useServerRoleDetails(data?.owner ? serverId : undefined);
  const create = useCreateLinkedRole(serverId);
  const remove = useDeleteLinkedRole(serverId);
  const [form, setForm] = useState<{ roleId: string; platform: StreamingPlatform; requirement: LinkedRoleRequirement }>({
    roleId: "",
    platform: "twitch",
    requirement: "subscriber",
  });
  const [picker, setPicker] = useState<"role" | "platform" | "requirement" | null>(null);

  const header = <SectionTitle icon="link" title={t("streaming.linkedRoles.title")} description={t("streaming.linkedRoles.description")} />;

  if (!data) {
    return (
      <View style={{ gap: spacing.md }}>
        {header}
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("streaming.linkedRoles.loading")}</Text>
      </View>
    );
  }

  const roles = (roleList ?? []).filter((role) => role.name !== "@everyone");
  const linkedRoleIds = new Set(data.items.map((i) => i.role.id));
  const needsBroadcaster = !data.broadcaster[form.platform];
  const requirement: LinkedRoleRequirement = form.platform === "kick" ? "subscriber" : form.requirement;
  const requirementLabel = (r: LinkedRoleRequirement) => (r === "follower" ? t("streaming.linkedRoles.follower") : t("streaming.linkedRoles.subscriber"));
  const selectedRole = roles.find((r) => r.id === form.roleId);

  const onCreate = () => {
    if (create.isPending || !form.roleId) return;
    create.mutate(
      { ...form, requirement },
      {
        onSuccess: () => {
          showToast(t("streaming.linkedRoles.created"));
          setForm((f) => ({ ...f, roleId: "" }));
        },
        onError: () => showToast(t("streaming.linkedRoles.createFailed"), "error"),
      }
    );
  };

  const pickerItems: ActionSheetItem[] =
    picker === "role"
      ? roles
          .filter((r) => !linkedRoleIds.has(r.id))
          .map((r) => ({
            key: r.id,
            label: r.name,
            icon: r.id === form.roleId ? "check" : "shield",
            onPress: () => {
              setForm((f) => ({ ...f, roleId: r.id }));
              setPicker(null);
            },
          }))
      : picker === "platform"
        ? STREAMING_PLATFORMS.map((p) => ({
            key: p,
            label: PLATFORM_LABELS[p],
            icon: p === form.platform ? "check" : "video",
            onPress: () => {
              setForm((f) => ({ ...f, platform: p }));
              setPicker(null);
            },
          }))
        : (["subscriber", ...(form.platform === "twitch" ? ["follower"] : [])] as LinkedRoleRequirement[]).map((r) => ({
            key: r,
            label: requirementLabel(r),
            icon: r === requirement ? "check" : "user",
            onPress: () => {
              setForm((f) => ({ ...f, requirement: r }));
              setPicker(null);
            },
          }));

  return (
    <View style={{ gap: spacing.md }}>
      {header}
      {!data.owner ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("streaming.linkedRoles.ownerOnly")}</Text>
      ) : (
        <>
          <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.panel }}>
            <SelectRow label={selectedRole?.name ?? null} placeholder={t("streaming.linkedRoles.selectRole")} onPress={() => setPicker("role")} />
            <SelectRow label={PLATFORM_LABELS[form.platform]} onPress={() => setPicker("platform")} />
            <SelectRow label={requirementLabel(requirement)} onPress={() => setPicker("requirement")} />
            <Button
              label={t("streaming.linkedRoles.add")}
              onPress={onCreate}
              loading={create.isPending}
              disabled={!form.roleId || needsBroadcaster}
              fullWidth
            />
            {needsBroadcaster ? (
              <Text style={{ ...typography.caption, color: colors.warning }}>
                {t("streaming.linkedRoles.needsBroadcaster", { platform: PLATFORM_LABELS[form.platform] })}
              </Text>
            ) : null}
            {form.platform === "kick" ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("streaming.linkedRoles.followerTwitchOnly")}</Text>
            ) : null}
          </View>

          {data.items.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("streaming.linkedRoles.empty")}</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {data.items.map((item) => (
                <Row key={item.id}>
                  <View style={{ width: 32, height: 32, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: PLATFORM_COLORS[item.platform] }}>
                    <Text style={{ ...typography.caption, ...fw(800), color: item.platform === "kick" ? "#000" : "#fff" }}>
                      {PLATFORM_LABELS[item.platform].charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...typography.bodyStrong, color: item.role.color || colors.bright }} numberOfLines={1}>
                      {item.role.name}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
                      {`${PLATFORM_LABELS[item.platform]} · ${requirementLabel(item.requirement)} · ${t("streaming.linkedRoles.granted", { count: item.grantedCount })}`}
                      {item.lastSyncedAt
                        ? ` · ${t("streaming.linkedRoles.lastSynced", { time: new Date(item.lastSyncedAt).toLocaleString() })}`
                        : ""}
                    </Text>
                  </View>
                  <IconButton
                    icon="trash"
                    label={t("streaming.linkedRoles.remove")}
                    tint={colors.danger}
                    onPress={() => remove.mutate(item.id, { onError: () => showToast(t("streaming.linkedRoles.removeFailed"), "error") })}
                  />
                </Row>
              ))}
            </View>
          )}
        </>
      )}
      <ActionSheet visible={picker !== null} onClose={() => setPicker(null)} items={pickerItems} />
    </View>
  );
}
