import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import {
  requestConnectionHandoff,
  useConnectionProviders,
  useProfileConnections,
  useRemoveConnection,
  useStreamingConnection,
  useUnlinkSpotify,
  useUnlinkStreaming,
  useUpdateConnection,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  type StreamingPlatform,
} from "@/api/hooks";
import { qk } from "@/api/query-keys";
import type { ConnectionType } from "@/api/types";
import {
  Button,
  Icon,
  IconButton,
  Pressable,
  Screen,
  ScreenLoader,
  SectionHeader,
  showDialog,
  showToast,
} from "@/components/ui";
import { CONNECTION_PROVIDERS, providerLabel, readConnectionResults, type ConnectionProvider } from "@/lib/connection-providers";
import { useT, type MessageKey } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Profil → Bağlantılar (web: Ayarlar → Profil → Bağlantılar).
 *
 * Bağlantılar yalnızca sağlayıcıda oturum açılarak eklenir ve doğrulanmış
 * görünür (elle kullanıcı adı yazılmaz; uç `handle`'lı isteği reddeder).
 * Mobilde akış sistem tarayıcısında: oturumlu uçtan tek kullanımlık adres
 * alınır (web lib/connections/mobile-handoff), sağlayıcının giriş ekranı
 * açılır, dönüş `ciklet://me?<sağlayıcı>=<sonuç>` derin bağlantısıyla gelir.
 * Satırda profilde göster/gizle, Spotify'da "etkinlik olarak göster".
 */
const NOTICE_KEYS: Record<string, MessageKey> = {
  linked: "parityScreens.connections.notice.linked",
  denied: "parityScreens.connections.notice.denied",
  invalid: "parityScreens.connections.notice.invalid",
  failed: "parityScreens.connections.notice.failed",
  unconfigured: "parityScreens.connections.notice.unconfigured",
  taken: "parityScreens.connections.notice.taken",
};

export default function ConnectionsScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useProfileConnections();
  const { data: providers } = useConnectionProviders();
  const update = useUpdateConnection();
  const remove = useRemoveConnection();
  const unlinkSpotify = useUnlinkSpotify();
  const [busy, setBusy] = useState<string | null>(null);

  const configured = new Set(providers?.configured ?? []);
  const connected = new Set((items ?? []).filter((c) => c.verified).map((c) => c.type));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk.profileConnections });
    void queryClient.invalidateQueries({ queryKey: qk.spotifyLink });
    void queryClient.invalidateQueries({ queryKey: ["streaming-connection"] });
    void queryClient.invalidateQueries({ queryKey: ["profile-card"] });
  };

  const link = async (provider: ConnectionProvider) => {
    if (provider.flow === "soon") return;
    if (!configured.has(provider.id)) {
      showToast(t("parityScreens.connections.unconfigured"), "error");
      return;
    }
    if (!provider.mobile) {
      showToast(t("parityScreens.connections.webOnly"));
      return;
    }
    setBusy(provider.id);
    try {
      const { url } = await requestConnectionHandoff(provider.id);
      const session = await WebBrowser.openAuthSessionAsync(url, "ciklet://");
      if (session.type === "success") {
        for (const r of readConnectionResults(session.url)) {
          showToast(t(NOTICE_KEYS[r.result], { platform: r.label }), r.result === "linked" ? "default" : "error");
        }
      }
    } catch (error) {
      // 404: sunucuda mobilden bağlama kapalı (MOBILE_CONNECTION_LINKING) ya da eski sürüm.
      showToast(
        error instanceof ApiError
          ? error.status === 404
            ? t("parityScreens.connections.linkUnavailable")
            : error.message || t("parityScreens.connections.saveFailed")
          : t("parityScreens.connections.openFailed"),
        "error"
      );
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const onRemove = (target: ConnectionType) => {
    const label = providerLabel(target);
    showDialog(t("parityScreens.connections.remove"), label, [
      { text: t("parityScreens.connections.back"), style: "cancel" },
      {
        text: t("parityScreens.connections.remove"),
        style: "destructive",
        onPress: () => {
          const onError = () => showToast(t("parityScreens.connections.removeFailed"), "error");
          if (target === "spotify") unlinkSpotify.mutate(undefined, { onError });
          else remove.mutate(target, { onError });
        },
      },
    ]);
  };

  if (isLoading) return <ScreenLoader />;
  const saveFailed = () => showToast(t("parityScreens.connections.saveFailed"), "error");

  return (
    <Screen>
      <Stack.Screen options={{ title: t("parityScreens.connections.title") }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {t("parityScreens.connections.description")}
        </Text>

        <SectionHeader title={t("parityScreens.connections.dialogTitle").toLocaleUpperCase()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.connections.dialogDescription")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {CONNECTION_PROVIDERS.map((provider) => {
              const soon = provider.flow === "soon";
              const off = !soon && providers !== undefined && !configured.has(provider.id);
              const isConnected = connected.has(provider.id);
              const state = soon
                ? t("parityScreens.connections.soon")
                : off
                  ? t("parityScreens.connections.unconfigured")
                  : isConnected
                    ? t("parityScreens.connections.tileConnected")
                    : busy === provider.id
                      ? t("parityScreens.connections.redirecting")
                      : null;
              return (
                <Pressable
                  key={provider.id}
                  disabled={soon || off || busy !== null}
                  onPress={() => void link(provider)}
                  accessibilityRole="button"
                  accessibilityLabel={state ? `${provider.label}, ${state}` : provider.label}
                  style={({ pressed }) => ({
                    width: "31%",
                    flexGrow: 1,
                    minHeight: 64,
                    padding: spacing.sm,
                    gap: 4,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: isConnected ? `${provider.color}80` : colors.border,
                    backgroundColor: pressed ? colors.raised : colors.panel,
                    opacity: soon || off ? 0.5 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: provider.color }} />
                    <Text style={{ ...typography.caption, ...fw(700), color: colors.bright, flex: 1 }} numberOfLines={1}>
                      {provider.label}
                    </Text>
                    {isConnected ? <Icon name="badge-check" size={14} color={colors.success} /> : null}
                  </View>
                  {state ? (
                    <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }} numberOfLines={2}>
                      {state}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.connections.privacyNote")}</Text>
        </View>

        <SectionHeader title={t("parityScreens.connections.title").toLocaleUpperCase()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {(items ?? []).length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.connections.empty")}</Text>
          ) : null}
          {(items ?? []).map((item) => (
            <View key={item.type} style={{ padding: spacing.md, gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.panel }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ ...typography.overline, color: colors.muted }}>{providerLabel(item.type).toLocaleUpperCase()}</Text>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                    {item.handle}
                  </Text>
                  <Text style={{ fontSize: 11, color: item.verified ? colors.success : colors.warning }}>
                    {item.verified ? t("parityScreens.connections.verified") : t("parityScreens.connections.unverified")}
                  </Text>
                </View>
                <Switch
                  value={item.visible}
                  onValueChange={(visible) => update.mutate({ type: item.type, visible }, { onError: saveFailed })}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor={colors.onBrand}
                  accessibilityLabel={item.visible ? t("parityScreens.connections.hideOnProfile") : t("parityScreens.connections.showOnProfile")}
                />
                <IconButton icon="trash" label={t("parityScreens.connections.remove")} tint={colors.danger} onPress={() => onRemove(item.type)} />
              </View>
              {!item.verified ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.connections.unverifiedHint")}</Text>
              ) : null}
              {/* Spotify: çalan şarkı etkinlik olarak görünsün mü (web connections-list). */}
              {typeof item.showActivity === "boolean" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Icon name="headphones" size={16} color={item.showActivity ? "#1DB954" : colors.muted} />
                  <Text style={{ ...typography.caption, color: colors.text, flex: 1 }}>
                    {item.showActivity ? t("parityScreens.connections.showActivityOn") : t("parityScreens.connections.showActivityOff")}
                  </Text>
                  <Switch
                    value={item.showActivity}
                    onValueChange={(showActivity) => update.mutate({ type: "spotify", showActivity }, { onError: saveFailed })}
                    trackColor={{ false: colors.border, true: colors.brand }}
                    thumbColor={colors.onBrand}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <StreamingConnectionRow platform="twitch" />
        <StreamingConnectionRow platform="kick" />
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
