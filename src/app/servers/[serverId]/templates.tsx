import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import {
  MAX_TEMPLATES_PER_SERVER,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_NAME_MAX,
  hasServerPermission,
  useCreateServerTemplate,
  useDeleteServerTemplate,
  useMyPermissions,
  useServerDetails,
  useServerTemplates,
  useSyncServerTemplate,
  type ServerTemplateRow,
} from "@/api/hooks";
import { Button, ErrorState, IconButton, KeyboardAvoider, ListSkeleton, SectionHeader, TextField, showToast } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Ayarları › Şablonlar — web `server-settings/templates-tab` ile aynı:
 * sunucunun yerleşiminden paylaşılabilir şablon üret (bağlantı panoya
 * kopyalanır), bağlantıyı kopyala, "Güncelle" anlık görüntüyü bugünkü hâle
 * çeker, sil. Yetki: Sunucuyu Yönet — uç denetler.
 */
export default function ServerTemplatesScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerDetails(serverId);
  const { data: permissions } = useMyPermissions(serverId);
  const templates = useServerTemplates(serverId);
  const create = useCreateServerTemplate(serverId);
  const sync = useSyncServerTemplate(serverId);
  const remove = useDeleteServerTemplate(serverId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canManage = hasServerPermission(permissions, "MANAGE_SERVER");
  const items = templates.data ?? [];
  const busyId = sync.isPending ? sync.variables : remove.isPending ? remove.variables : null;

  const submit = () => {
    if (create.isPending || items.length >= MAX_TEMPLATES_PER_SERVER) return;
    create.mutate(
      { name: name.trim() || server?.name || "", description: description.trim() || undefined },
      {
        onSuccess: (row) => {
          setName("");
          setDescription("");
          void copyLink(row.url);
        },
        onError: (reason) => showToast(apiMessage(reason, "Şablon oluşturulamadı"), "error"),
      }
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Şablonlar" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <SectionHeader title={`ŞABLONLAR — ${items.length}/${MAX_TEMPLATES_PER_SERVER}`} />
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg }}>
          Kanal yerleşimini, rolleri ve birkaç ayarı bağlantıyla paylaş; açan kişi aynı yerleşimle yeni bir sunucu kurar. Mesajlar ve üyeler kopyalanmaz.
        </Text>

        {canManage ? (
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
            <TextField
              value={name}
              onChangeText={setName}
              maxLength={TEMPLATE_NAME_MAX}
              placeholder={`Şablon adı (varsayılan: ${server?.name ?? ""})`}
            />
            <TextField
              value={description}
              onChangeText={setDescription}
              maxLength={TEMPLATE_DESCRIPTION_MAX}
              placeholder="Kısa açıklama (isteğe bağlı)"
            />
            <Button
              label="Bu sunucudan şablon oluştur"
              icon="plus"
              onPress={submit}
              loading={create.isPending}
              disabled={create.isPending || items.length >= MAX_TEMPLATES_PER_SERVER}
            />
          </View>
        ) : null}

        {templates.isLoading ? (
          <ListSkeleton rows={3} />
        ) : templates.error ? (
          <ErrorState message={apiMessage(templates.error, "Şablonlar yüklenemedi.")} onRetry={() => void templates.refetch()} />
        ) : items.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center", padding: spacing.xl }}>Henüz şablon yok.</Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {items.map((item) => (
              <TemplateCard
                key={item.id}
                item={item}
                canManage={canManage}
                busy={busyId === item.id}
                onCopy={() => void copyLink(item.url)}
                onSync={() =>
                  sync.mutate(item.id, {
                    onSuccess: () => showToast("Şablon sunucunun bugünkü hâline güncellendi"),
                    onError: (reason) => showToast(apiMessage(reason, "Güncellenemedi"), "error"),
                  })
                }
                onDelete={() =>
                  remove.mutate(item.id, {
                    onError: (reason) => showToast(apiMessage(reason, "Silinemedi"), "error"),
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

function TemplateCard({
  item,
  canManage,
  busy,
  onCopy,
  onSync,
  onDelete,
}: {
  item: ServerTemplateRow;
  canManage: boolean;
  busy: boolean;
  onCopy: () => void;
  onSync: () => void;
  onDelete: () => void;
}) {
  const summary = item.summary
    ? `${item.summary.categories} kategori · ${item.summary.textChannels} metin · ${item.summary.voiceChannels} ses · ${item.summary.roles} rol`
    : "—";
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
        <Text style={{ ...typography.body, ...fw(600), color: colors.bright }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
          {`${summary} · ${item.usageCount} kullanım · ${formatDate(item.updatedAt)}`}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1} selectable>
          {item.url}
        </Text>
      </View>
      <IconButton icon="copy" label="Bağlantıyı kopyala" background="transparent" tint={colors.muted} size={32} onPress={onCopy} />
      {canManage ? (
        busy ? (
          <ActivityIndicator color={colors.muted} style={{ width: 64 }} />
        ) : (
          <>
            <IconButton icon="rotate-ccw" label="Sunucunun bugünkü hâliyle güncelle" background="transparent" tint={colors.muted} size={32} onPress={onSync} />
            <IconButton icon="trash" label="Sil" background="transparent" tint={colors.danger} size={32} onPress={onDelete} />
          </>
        )
      ) : null}
    </View>
  );
}

async function copyLink(url: string) {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(url);
    showToast("Şablon bağlantısı kopyalandı");
  } catch {
    showToast("Panoya kopyalanamadı", "error");
  }
}

function apiMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError && reason.message ? reason.message : fallback;
}
