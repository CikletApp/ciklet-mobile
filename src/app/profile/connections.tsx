import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { ApiError } from "@/api/client";
import {
  useProfileConnections,
  useRemoveConnection,
  useSaveConnection,
  useSpotifyLink,
  useStreamingConnection,
  useUnlinkSpotify,
  useUnlinkStreaming,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  type StreamingPlatform,
} from "@/api/hooks";
import type { ConnectionType } from "@/api/types";
import {
  Button,
  Icon,
  IconButton,
  Pressable,
  Screen,
  ScreenLoader,
  SectionHeader,
  TextField,
  showDialog,
  showToast,
} from "@/components/ui";
import { CONNECTION_TYPES, connectionMeta, normalizeHandle } from "@/lib/profile-extras";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Profil → Bağlantılar (web: Ayarlar → Profil → Bağlantılar).
 *
 * Bağlantı bir GİRİŞ yöntemi değil; yalnızca profilde gösterilen hesap
 * tanıtıcısı. Platform başına tek kayıt (PUT aynı türü günceller), göz
 * düğmesi profilde gizler. Spotify gerçek hesapla OAuth üzerinden
 * doğrulanıyor ve dönüş adresi tarayıcı oturumu istiyor; bu yüzden mobilde
 * yalnızca durumu gösterilir ve kaldırılabilir, bağlama webden yapılır.
 */
export default function ConnectionsScreen() {
  const { data: items, isLoading } = useProfileConnections();
  const { data: spotify } = useSpotifyLink();
  const save = useSaveConnection();
  const remove = useRemoveConnection();
  const unlinkSpotify = useUnlinkSpotify();
  const [type, setType] = useState<ConnectionType>("steam");
  const [handle, setHandle] = useState("");

  const manualTypes = CONNECTION_TYPES.filter((c) => c.id !== "spotify");
  const meta = connectionMeta(type);
  const existing = new Set((items ?? []).map((c) => c.type));
  const normalized = normalizeHandle(type, handle);

  const onAdd = () => {
    if (!normalized) return;
    save.mutate(
      { type, handle: normalized },
      {
        onSuccess: () => {
          setHandle("");
          showToast(existing.has(type) ? "Bağlantı güncellendi." : "Bağlantı eklendi.");
        },
        onError: (error) =>
          showToast(
            error instanceof ApiError && error.status === 422 ? "Kullanıcı adı bu platform için geçersiz." : "Bağlantı kaydedilemedi.",
            "error"
          ),
      }
    );
  };

  const onRemove = (target: ConnectionType) => {
    const label = connectionMeta(target)?.label ?? target;
    showDialog("Bağlantıyı kaldır", `${label} bağlantısı profilinden kaldırılacak.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: () =>
          target === "spotify"
            ? unlinkSpotify.mutate(undefined, { onError: () => showToast("Bağlantı kaldırılamadı.", "error") })
            : remove.mutate(target, { onError: () => showToast("Bağlantı kaldırılamadı.", "error") }),
      },
    ]);
  };

  if (isLoading) return <ScreenLoader />;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Bağlantılar" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          Oyun ve sosyal hesaplarını profilinde göster. Bir platforma tek hesap bağlanır.
        </Text>

        {spotify?.configured ? (
          <>
            <SectionHeader title="SPOTIFY" />
            <View
              style={{
                marginHorizontal: spacing.lg,
                padding: spacing.md,
                gap: spacing.sm,
                borderRadius: radii.lg,
                backgroundColor: colors.panel,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Icon name="headphones" size={18} color="#1DB954" />
                <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }} numberOfLines={1}>
                  {spotify.linked ? (spotify.displayName ?? "Bağlı") : "Bağlı değil"}
                </Text>
                {spotify.linked ? (
                  <Button label="Kaldır" variant="ghost" onPress={() => onRemove("spotify")} />
                ) : null}
              </View>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {spotify.linked
                  ? spotify.premium
                    ? "Doğrulandı. Çaldığın şarkı profilinde görünür, arkadaşların seninle birlikte dinleyebilir."
                    : "Doğrulandı. Premium olmadığı için birlikte dinleme kapalı."
                  : "Spotify gerçek hesabınla doğrulanır; bağlamak için web ya da masaüstünde Ayarlar → Profil → Bağlantılar'ı kullan."}
              </Text>
            </View>
          </>
        ) : null}

        <StreamingConnectionRow platform="twitch" />
        <StreamingConnectionRow platform="kick" />

        <SectionHeader title="BAĞLANTI EKLE" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {manualTypes.map((option) => {
              const active = option.id === type;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setType(option.id)}
                  haptic="light"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    minHeight: 34,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    borderRadius: radii.full,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandSoft : "transparent",
                  }}
                >
                  <Text style={{ ...typography.caption, fontSize: 13, ...fw(active ? 700 : 600), color: active ? colors.brand : colors.text }}>
                    {option.label}
                    {existing.has(option.id) ? " ✓" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextField
            label={meta?.label.toLocaleUpperCase("tr-TR")}
            value={handle}
            onChangeText={setHandle}
            placeholder={meta?.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={80}
            onSubmitEditing={onAdd}
            error={handle.trim() && !normalized ? "Bu platform için geçerli bir ad değil." : null}
          />
          <Button
            label={existing.has(type) ? "Güncelle" : "Ekle"}
            icon="plus"
            onPress={onAdd}
            disabled={!normalized}
            loading={save.isPending}
            fullWidth
          />
        </View>

        <SectionHeader title="BAĞLANTILARIN" />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {(items ?? []).filter((c) => c.type !== "spotify").length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>Henüz bağlantı yok.</Text>
          ) : null}
          {(items ?? [])
            .filter((c) => c.type !== "spotify")
            .map((item) => (
              <View
                key={item.type}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: colors.panel,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.overline, color: colors.muted }}>
                    {(connectionMeta(item.type)?.label ?? item.type).toLocaleUpperCase("tr-TR")}
                  </Text>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                    {item.handle}
                  </Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Switch
                    value={item.visible}
                    onValueChange={(visible) => save.mutate({ type: item.type, handle: item.handle, visible })}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor={colors.onBrand}
                    accessibilityLabel={item.visible ? "Profilde gizle" : "Profilde göster"}
                  />
                  <Text style={{ fontSize: 10, color: colors.muted }}>{item.visible ? "Görünür" : "Gizli"}</Text>
                </View>
                <IconButton icon="trash" label="Kaldır" tint={colors.danger} onPress={() => onRemove(item.type)} />
              </View>
            ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Twitch / Kick (web settings/streaming-connection-row): hesap bağlıysa
 * "Yayında" etiketi ve bağlantılı roller (sunucu sahibinin kanalına
 * abone/takipçi olan üyeye rol) bu bağlantıyla çalışır. OAuth dönüşü
 * tarayıcı oturumu istediği için bağlama Spotify gibi webden/masaüstünden;
 * mobilde durum, yayıncı izni ve kaldırma.
 */
function StreamingConnectionRow({ platform }: { platform: StreamingPlatform }) {
  const t = useT();
  const { data: status } = useStreamingConnection(platform);
  const unlink = useUnlinkStreaming(platform);
  const label = PLATFORM_LABELS[platform];
  const color = PLATFORM_COLORS[platform];
  if (!status?.configured) return null;

  const disconnect = () =>
    unlink.mutate(undefined, {
      onSuccess: () => showToast(t("streaming.settings.disconnected", { platform: label })),
      onError: () => showToast(t("streaming.settings.disconnectFailed", { platform: label }), "error"),
    });

  return (
    <>
      <SectionHeader title={label.toLocaleUpperCase("tr-TR")} />
      <View
        style={{
          marginHorizontal: spacing.lg,
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: `${color}40`,
          backgroundColor: colors.panel,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="video" size={18} color={color} />
          <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }} numberOfLines={1}>
            {status.linked ? (status.handle ?? label) : "Bağlı değil"}
          </Text>
          {status.live ? (
            <Text style={{ ...typography.caption, ...fw(800), color: "#fff", backgroundColor: "#593695", paddingHorizontal: 6, borderRadius: 4 }}>
              {t("streaming.live")}
            </Text>
          ) : null}
          {status.linked ? <Button label={t("streaming.settings.disconnect")} variant="ghost" onPress={disconnect} loading={unlink.isPending} /> : null}
        </View>
        {status.linked ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Icon name="shield" size={14} color={status.broadcaster ? colors.success : colors.muted} />
            <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
              {status.broadcaster ? t("streaming.settings.broadcaster") : t("streaming.settings.broadcasterHint")}
            </Text>
          </View>
        ) : null}
        <Text style={{ ...typography.caption, color: colors.muted }}>
          {status.linked
            ? status.broadcaster
              ? `${label} hesabın doğrulandı.`
              : `"${t("streaming.settings.grantBroadcaster")}" için web ya da masaüstünde Ayarlar → Profil → Bağlantılar'ı kullan.`
            : `${t("streaming.settings.hint")}. ${label} gerçek hesabınla doğrulanır; bağlamak için web ya da masaüstünde Ayarlar → Profil → Bağlantılar'ı kullan.`}
        </Text>
      </View>
    </>
  );
}
