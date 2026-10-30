import { ScrollView, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { hasServerPermission, useMyPermissions, useServerWidget, useUpdateServerWidget } from "@/api/hooks";
import { Divider, ErrorState, IconButton, ListGroup, ListRow, ListSkeleton, SectionHeader, showToast } from "@/components/ui";
import { openGuardedLink } from "@/lib/external-link";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Ayarları › Widget — web `server-settings/widget-tab` ile aynı
 * (Discord "Server Widget"): widget'ı aç/kapat, "Katıl" düğmesinin davet
 * kanalı, Sunucu Kimliği / JSON API / hazır gömme kodu (kopyala) ve
 * önizleme. Yetki: Sunucuyu Yönet — uç denetler. Değişiklik anında kaydedilir.
 */
export default function ServerWidgetScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: permissions } = useMyPermissions(serverId);
  const widget = useServerWidget(serverId);
  const update = useUpdateServerWidget(serverId);

  const canManage = hasServerPermission(permissions, "MANAGE_SERVER");
  const settings = widget.data;
  const disabled = !canManage || update.isPending;

  const save = (patch: { enabled?: boolean; channel_id?: string | null }) => {
    if (disabled) return;
    update.mutate(patch, {
      onSuccess: () => showToast("Widget ayarları kaydedildi"),
      onError: (reason) => showToast(apiMessage(reason, "Widget ayarları kaydedilemedi"), "error"),
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
      <Stack.Screen options={{ title: "Widget" }} />
      <SectionHeader title="SUNUCU WIDGET'I" />
      <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg }}>
        Widget açıkken sunucunun çevrimiçi üyeleri ve herkesin görebildiği ses kanalları başka sitelere gömülebilir. Üyelerin gerçek kimlikleri, görünmez ve çevrimdışı üyeler gösterilmez.
      </Text>

      {widget.isLoading ? (
        <ListSkeleton rows={4} />
      ) : widget.error || !settings ? (
        <ErrorState message={apiMessage(widget.error, "Widget ayarları yüklenemedi.")} onRetry={() => void widget.refetch()} />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <ListGroup>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, opacity: disabled ? 0.6 : 1 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...typography.body, color: colors.text }}>Sunucu Widget&apos;ını Etkinleştir</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>Kapalıyken JSON API ve gömülü widget &quot;Widget devre dışı&quot; döner.</Text>
                </View>
                <Switch
                  value={settings.enabled}
                  disabled={disabled}
                  onValueChange={(value) => save({ enabled: value })}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#ffffff"
                />
              </View>
            </ListGroup>
          </View>

          <SectionHeader title="DAVET KANALI" />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <ListGroup>
              <ListRow
                title="Davet yok"
                detail={!settings.channel_id ? "Seçili" : undefined}
                chevron={false}
                disabled={disabled}
                onPress={() => save({ channel_id: null })}
              />
              {settings.invite_channels.map((channel) => (
                <View key={channel.id}>
                  <Divider inset={52} />
                  <ListRow
                    icon={channel.type === "TEXT" ? "hash" : "volume"}
                    title={channel.name}
                    detail={settings.channel_id === channel.id ? "Seçili" : undefined}
                    chevron={false}
                    disabled={disabled}
                    onPress={() => save({ channel_id: channel.id })}
                  />
                </View>
              ))}
            </ListGroup>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Widget&apos;taki &quot;Katıl&quot; düğmesi bu kanala süresiz bir davet açar. Yalnızca herkesin görebildiği kanallar seçilebilir.
            </Text>
          </View>

          <SectionHeader title="SUNUCU KİMLİĞİ" />
          <CopyField value={settings.server_id} onCopy={() => void copyText(settings.server_id, "Sunucu kimliği")} />

          <SectionHeader title="JSON API" />
          <CopyField value={settings.json_url} onCopy={() => void copyText(settings.json_url, "JSON API adresi")} />

          <SectionHeader title="HAZIR WIDGET" />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Bu kodu sitene yapıştır; widget 350×500 boyutunda açılır. Açık tema için adresteki theme=dark değerini theme=light yap.
            </Text>
            <CopyField value={settings.embed_html} multiline onCopy={() => void copyText(settings.embed_html, "Gömme kodu")} />
            <ListGroup>
              <ListRow icon="arrow-up-right" title="Önizle" onPress={() => openGuardedLink(`${settings.widget_url}?theme=dark`)} />
            </ListGroup>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function CopyField({ value, onCopy, multiline }: { value: string; onCopy: () => void; multiline?: boolean }) {
  return (
    <View style={{ paddingHorizontal: multiline ? 0 : spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: spacing.sm,
          paddingLeft: spacing.lg,
          paddingRight: spacing.xs,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          backgroundColor: colors.panel,
        }}
      >
        <Text
          style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.text, ...fw(500) }}
          numberOfLines={multiline ? undefined : 1}
          selectable
        >
          {value}
        </Text>
        <IconButton icon="copy" label="Kopyala" background="transparent" tint={colors.muted} size={32} onPress={onCopy} />
      </View>
    </View>
  );
}

async function copyText(value: string, label: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(value);
    showToast(`${label} kopyalandı`);
  } catch {
    showToast("Panoya kopyalanamadı", "error");
  }
}

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}
