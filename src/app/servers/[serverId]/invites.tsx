import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useMyPermissions, useServerEvents, useServerRoleDetails } from "@/api/hooks";
import { Button, ErrorState, IconButton, ListSkeleton, SectionHeader, showToast } from "@/components/ui";
import {
  INVITE_AGE_OPTIONS,
  INVITE_MAX_ROLES,
  INVITE_USE_OPTIONS,
  formatInviteExpiry,
  grantableInviteRoles,
  useCreateServerInvite,
  useDeleteServerInvite,
  usePauseServerInvite,
  useServerInvites,
  type ServerInviteRow,
} from "@/features/invites/invite-options";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Ayarları › Davetler — web `server-settings/invites-tab` ile aynı:
 * süre / kullanım sınırı, geçici üyelik, katılınca verilecek roller (yalnızca
 * "Rolleri Yönet" ve kendi en yüksek rolünün altındakiler) ve bağlı etkinlik;
 * liste, kopyala/paylaş, duraklat, sil. Yetki uçta (Sunucuyu Yönet / Kanalları
 * Yönet; rol veren davet ayrıca hiyerarşi).
 */
export default function ServerInvitesScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const invites = useServerInvites(serverId);
  const { data: me } = useMyPermissions(serverId);
  const { data: roles } = useServerRoleDetails(serverId);
  const { data: events } = useServerEvents(serverId);
  const create = useCreateServerInvite(serverId);
  const pause = usePauseServerInvite(serverId);
  const remove = useDeleteServerInvite(serverId);

  const [maxAge, setMaxAge] = useState<number>(604800);
  const [maxUses, setMaxUses] = useState<number>(0);
  const [temporary, setTemporary] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);

  const roleChoices = grantableInviteRoles(roles ?? [], me);
  const upcoming = (events ?? []).filter((event) => event.status === "SCHEDULED" || event.status === "ACTIVE");
  const items = invites.data ?? [];

  const toggleRole = (id: string) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= INVITE_MAX_ROLES ? prev : [...prev, id]));

  const submit = () => {
    if (create.isPending) return;
    create.mutate(
      { maxAgeSeconds: maxAge || undefined, maxUses: maxUses || undefined, temporary, roleIds, eventId },
      {
        onSuccess: () => {
          setTemporary(false);
          setRoleIds([]);
          setEventId(null);
        },
        onError: (reason) => showToast(apiMessage(reason, "Davet oluşturulamadı."), "error"),
      }
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Davetler" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <View
          style={{
            margin: spacing.lg,
            padding: spacing.lg,
            gap: spacing.md,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <OptionLabel title="SÜRE" />
          <Chips options={INVITE_AGE_OPTIONS.map((o) => ({ key: String(o.value), label: o.label }))} selected={[String(maxAge)]} onToggle={(key) => setMaxAge(Number(key))} />
          <OptionLabel title="MAKS. KULLANIM" />
          <Chips options={INVITE_USE_OPTIONS.map((o) => ({ key: String(o.value), label: o.label }))} selected={[String(maxUses)]} onToggle={(key) => setMaxUses(Number(key))} />

          {upcoming.length > 0 ? (
            <>
              <OptionLabel title="ETKİNLİK" />
              <Chips
                options={[{ key: "", label: "Etkinlik yok" }, ...upcoming.map((event) => ({ key: event.id, label: event.name }))]}
                selected={[eventId ?? ""]}
                onToggle={(key) => setEventId(key || null)}
              />
            </>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Geçici üyelik</Text>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Bu davetle katılanlar, kendilerine bir rol verilmezse bağlantıları kopunca sunucudan çıkarılır.
              </Text>
            </View>
            <Switch value={temporary} onValueChange={setTemporary} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
          </View>

          {roleChoices.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Katılınca verilecek roller</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  Yalnızca senin en yüksek rolünün altındaki roller verilebilir. Rol alan üye geçici sayılmaz.
                </Text>
              </View>
              <Chips
                options={roleChoices.map((role) => ({ key: role.id, label: role.name, dot: role.color ?? "#99aab5" }))}
                selected={roleIds}
                onToggle={toggleRole}
              />
            </View>
          ) : null}

          <Button label="Davet Oluştur" icon="plus" onPress={submit} loading={create.isPending} disabled={create.isPending} />
        </View>

        <SectionHeader title={`DAVETLER — ${items.length}`} />
        {invites.isLoading ? (
          <ListSkeleton rows={3} />
        ) : invites.error ? (
          <ErrorState message={apiMessage(invites.error, "Davetler yüklenemedi.")} onRetry={() => void invites.refetch()} />
        ) : items.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>Henüz davet yok.</Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {items.map((item) => (
              <InviteCard
                key={item.code}
                item={item}
                busy={(pause.isPending && pause.variables?.code === item.code) || (remove.isPending && remove.variables === item.code)}
                onCopy={() => void copyLink(item.code)}
                onPause={() =>
                  pause.mutate(
                    { code: item.code, paused: !item.paused },
                    { onError: (reason) => showToast(apiMessage(reason, "Güncellenemedi"), "error") }
                  )
                }
                onDelete={() => remove.mutate(item.code, { onError: (reason) => showToast(apiMessage(reason, "Silinemedi"), "error") })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function OptionLabel({ title }: { title: string }) {
  return <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>;
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { key: string; label: string; dot?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {options.map((option) => {
        const on = selected.includes(option.key);
        return (
          <Pressable
            key={option.key || "none"}
            onPress={() => onToggle(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: on ? colors.brand : colors.border,
              backgroundColor: on ? colors.raised : "transparent",
            }}
          >
            {option.dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: option.dot }} /> : null}
            <Text style={{ ...typography.caption, ...fw(600), color: on ? colors.bright : colors.muted }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InviteCard({
  item,
  busy,
  onCopy,
  onPause,
  onDelete,
}: {
  item: ServerInviteRow;
  busy: boolean;
  onCopy: () => void;
  onPause: () => void;
  onDelete: () => void;
}) {
  const uses = `${item.uses}${item.maxUses ? `/${item.maxUses}` : ""} kullanım`;
  const flags = [item.paused ? "Duraklatıldı" : null, item.temporary ? "Geçici" : null].filter(Boolean).join(" · ");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        backgroundColor: colors.panel,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1} selectable>
          {item.code}
          {flags ? <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>{`  ${flags}`}</Text> : null}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
          {`${item.inviter ? `${item.inviter.username} • ` : ""}${uses} • ${formatInviteExpiry(item.expiresAt)}`}
        </Text>
        {item.roles?.length || item.event ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 }}>
            {item.roles?.map((role) => (
              <View key={role.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.raised }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: role.color ?? "#99aab5" }} />
                <Text style={{ fontSize: 11, lineHeight: 15, ...fw(600), color: colors.muted }}>{role.name}</Text>
              </View>
            ))}
            {item.event ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full, backgroundColor: colors.raised }}>
                <Text style={{ fontSize: 11, lineHeight: 15, ...fw(600), color: colors.muted }}>{`Etkinlik: ${item.event.name}`}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.muted} style={{ width: 96 }} />
      ) : (
        <>
          <IconButton icon="copy" label="Kopyala" background="transparent" tint={colors.muted} size={32} onPress={onCopy} />
          <IconButton icon={item.paused ? "play" : "lock"} label={item.paused ? "Devam et" : "Duraklat"} background="transparent" tint={colors.muted} size={32} onPress={onPause} />
          <IconButton icon="trash" label="Sil" background="transparent" tint={colors.danger} size={32} onPress={onDelete} />
        </>
      )}
    </View>
  );
}

async function copyLink(code: string) {
  const url = `https://ciklet.xyz/i/${code}`;
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(url);
    showToast("Davet bağlantısı kopyalandı");
  } catch {
    void Share.share({ message: url });
  }
}

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}
