import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useCreateServerFromTemplate, useTemplatePreview, type TemplateView } from "@/api/hooks";
import { Avatar, Button, EmojiText, Icon, KeyboardAvoider, ScreenLoader, TextField, showToast } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * /sablon/[kod] — şablon önizlemesi ve "Bu şablonla sunucu kur" (web
 * `components/server/template-landing` ile aynı). `ciklet://sablon/KOD`
 * ve sohbette tıklanan `https://ciklet.xyz/sablon/KOD` bağlantıları buraya
 * gelir (lib/external-link). Şablon yoksa ana sayfaya döner (web gibi).
 */
export default function TemplateLandingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const preview = useTemplatePreview(code);
  const create = useCreateServerFromTemplate(code);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (preview.error) router.replace("/");
  }, [preview.error]);

  const data = preview.data;
  if (!data) return <ScreenLoader />;
  const serverName = name ?? data.name;

  const submit = () => {
    if (create.isPending) return;
    create.mutate(serverName.trim() || data.name, {
      onSuccess: ({ id }) => {
        showToast("Sunucu kuruldu!");
        router.replace(`/servers/${id}`);
      },
      onError: (reason) =>
        showToast(reason instanceof ApiError && reason.message ? reason.message : "Sunucu kurulamadı", "error"),
    });
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Sunucu şablonu" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          {data.sourceServer ? (
            <Avatar imageUrl={data.sourceServer.imageUrl} fallbackText={data.sourceServer.name} size={48} shape="squircle" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
              <Icon name="copy" size={24} color={colors.brand} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.overline, color: colors.muted }}>SUNUCU ŞABLONU</Text>
            <Text style={{ ...typography.title, color: colors.bright }} numberOfLines={1}>
              {data.name}
            </Text>
            {data.description ? <Text style={{ ...typography.caption, color: colors.muted }}>{data.description}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(
            [
              ["Kategori", data.summary.categories],
              ["Metin", data.summary.textChannels],
              ["Ses", data.summary.voiceChannels],
              ["Rol", data.summary.roles],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.panel }}>
              <Text style={{ fontSize: 18, lineHeight: 24, ...fw(800), color: colors.bright }}>{value}</Text>
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }}>{label}</Text>
            </View>
          ))}
        </View>

        <TemplateLayout data={data} />

        <TextField label="SUNUCU ADI" value={serverName} onChangeText={setName} maxLength={100} />
        <Button
          label="Bu şablonla sunucu kur"
          fullWidth
          size="lg"
          onPress={submit}
          loading={create.isPending}
          disabled={create.isPending || !serverName.trim()}
        />
        <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted, textAlign: "center" }}>
          {`Mesajlar, üyeler ve izinler kopyalanmaz; yalnızca yerleşim ve roller.${data.usageCount > 0 ? ` ${data.usageCount} kez kullanıldı.` : ""}`}
        </Text>
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** Kategorisiz kanallar önce, sonra kategoriler; en altta roller. */
function TemplateLayout({ data }: { data: TemplateView }) {
  const grouped = [
    { title: null as string | null, channels: data.channels.filter((c) => c.categoryIndex === null) },
    ...data.categories.map((title, i) => ({ title, channels: data.channels.filter((c) => c.categoryIndex === i) })),
  ].filter((group) => group.channels.length > 0);

  return (
    <View style={{ gap: spacing.sm }}>
      {grouped.map((group, gi) => (
        <View key={gi} style={{ gap: 2 }}>
          {group.title ? (
            <EmojiText style={{ ...typography.overline, color: colors.muted }}>{group.title.toLocaleUpperCase("tr-TR")}</EmojiText>
          ) : null}
          {group.channels.map((channel, ci) => (
            <View key={ci} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Icon name={channel.type === "TEXT" ? "hash" : channel.type === "AUDIO" ? "mic" : "video"} size={14} color={colors.muted} />
              <EmojiText style={{ ...typography.body, color: colors.text }}>{channel.name}</EmojiText>
            </View>
          ))}
        </View>
      ))}
      {data.roles.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <Icon name="shield" size={14} color={colors.muted} />
          {data.roles.map((role, i) => (
            <Text
              key={i}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: role.color ?? colors.border,
                color: role.color ?? colors.text,
                fontSize: 11,
                lineHeight: 15,
                ...fw(600),
              }}
            >
              {role.name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
