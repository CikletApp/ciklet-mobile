import { useCallback, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import {
  Avatar,
  Button,
  EmptyState,
  Screen,
  ScreenLoader,
} from "@/components/ui";
import {
  ACTIVITY_BASE_URL,
  buildHostDocument,
  deliverScript,
  isRPCMessage,
  rpcDispatch,
  rpcError,
  rpcResponse,
} from "@/features/activities/bridge";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Aktivite çalıştırıcı.
 *
 * Üç aşama:
 *  1. Yetki kapısı — `GET /api/activities/authorize` kullanıcı bu uygulamaya
 *     daha önce izin verdi mi diye sorar. Vermediyse onay ekranı gösterilir
 *     ve `POST … { grantOnly: true, approve: true }` ile kayıt açılır.
 *  2. WebView + host belge yüklenir, aktivite iframe'de çalışır.
 *  3. RPC köprüsü: SDK'nın AUTHORIZE komutu sunucudan gerçek bir OAuth
 *     kodu alır ve iframe'e döner.
 *
 * ⚠️ Bu akışın uçtan uca doğrulanması gerçek bir aktivite uygulaması ve
 * fiziksel cihaz ister; buradaki köprü sözleşmeye göre yazıldı ancak
 * cihazda test EDİLMEDİ.
 */
interface AuthorizeStatus {
  authorized: boolean;
  appName: string;
  appIcon: string | null;
  scopes: string[];
}

export default function ActivityScreen() {
  const { clientId, chatId } = useLocalSearchParams<{
    clientId: string;
    chatId?: string;
  }>();

  const profile = useAuth((s) => s.profile);
  const deepColor = useTheme((s) => s.palette.deep);
  const { data: activities } = useActivities();
  const activity = activities?.find((a) => a.id === clientId);

  const webviewRef = useRef<WebView>(null);
  const [frameError, setFrameError] = useState(false);

  // Aktivite oturumunun kimliği — aynı sohbetteki katılımcılar aynı
  // örneği paylaşır, bu yüzden sohbet kimliğinden türetilir.
  const instanceId = useMemo(
    () => `${chatId || "solo"}-${clientId}`,
    [chatId, clientId]
  );

  const status = useQuery({
    queryKey: ["activity-authorize", clientId],
    queryFn: () =>
      api<AuthorizeStatus>(`${endpoints.activityAuthorize}?clientId=${encodeURIComponent(clientId)}`),
    enabled: Boolean(clientId),
  });

  const grant = useMutation({
    mutationFn: () =>
      api(endpoints.activityAuthorize, {
        method: "POST",
        body: { clientId, grantOnly: true, approve: true },
      }),
    onSuccess: () => void status.refetch(),
  });

  /** SDK'nın AUTHORIZE komutuna karşılık gerçek OAuth kodu üretir. */
  const requestAuthCode = useCallback(
    async (scope: string | undefined) => {
      const result = await api<{ code: string }>(endpoints.activityAuthorize, {
        method: "POST",
        body: {
          clientId,
          instanceId,
          channelId: chatId ?? "",
          scope,
          approve: true,
        },
      });
      return result.code;
    },
    [clientId, instanceId, chatId]
  );

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let payload: { type?: string; message?: unknown };
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (payload.type === "frame-error") {
        setFrameError(true);
        return;
      }
      if (payload.type !== "rpc" || !isRPCMessage(payload.message)) return;

      const message = payload.message;
      const send = (response: unknown) =>
        webviewRef.current?.injectJavaScript(deliverScript(response));

      // El sıkışma: iframe hazır olduğunu bildirdi → READY yayınla.
      if (message.cmd === "DISPATCH" && message.evt === "READY") {
        send(
          rpcDispatch("READY", {
            v: 1,
            config: { cdn_host: null },
            user: profile
              ? {
                  id: profile.id,
                  username: profile.username,
                  global_name: profile.name,
                  avatar: profile.imageUrl,
                }
              : null,
          })
        );
        return;
      }

      if (message.cmd === "AUTHORIZE") {
        const args = (message.args ?? {}) as { scope?: string | string[] };
        const scope = Array.isArray(args.scope) ? args.scope.join(" ") : args.scope;
        try {
          const code = await requestAuthCode(scope);
          send(rpcResponse(message.cmd, message.nonce, { code }));
        } catch (err) {
          send(
            rpcError(
              message.cmd,
              message.nonce,
              err instanceof ApiError ? err.message : "Yetkilendirme başarısız"
            )
          );
        }
        return;
      }

      // Henüz karşılanmayan komutlar sessizce düşmemeli; SDK tarafındaki
      // bekleyen istek zaman aşımına uğrayıp uygulamayı kilitler.
      send(
        rpcError(message.cmd, message.nonce, `Mobilde desteklenmeyen komut: ${message.cmd}`)
      );
    },
    [profile, requestAuthCode]
  );

  const html = useMemo(
    () =>
      activity
        ? buildHostDocument({
            activityUrl: activity.url,
            clientId,
            instanceId,
            channelId: chatId ?? "",
            backgroundColor: deepColor,
          })
        : null,
    [activity, clientId, instanceId, chatId, deepColor]
  );

  if (!activity) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Aktivite" }} />
        <EmptyState
          icon="compass"
          title="Aktivite bulunamadı"
          description="Bu aktivite kaldırılmış veya artık onaylı değil."
        />
      </Screen>
    );
  }

  if (status.isLoading) return <ScreenLoader label="Aktivite hazırlanıyor…" />;

  // ── Yetki kapısı ──────────────────────────────────────────────────
  if (status.data && !status.data.authorized) {
    return (
      <Screen>
        <Stack.Screen options={{ title: activity.name }} />
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ alignItems: "center", gap: spacing.md }}>
            <Avatar
              imageUrl={status.data.appIcon ?? activity.icon}
              fallbackText={activity.name}
              size={72}
              shape="squircle"
            />
            <Text style={{ ...typography.display, color: colors.bright, textAlign: "center" }}>
              {status.data.appName}
            </Text>
          </View>

          <View
            style={{
              padding: spacing.lg,
              borderRadius: radii.lg,
              backgroundColor: colors.panel,
              gap: spacing.sm,
            }}
          >
            <Text style={{ ...typography.overline, color: colors.muted }}>
              BU UYGULAMA ŞUNLARA ERİŞECEK
            </Text>
            {status.data.scopes.map((scope) => (
              <Text key={scope} style={{ ...typography.body, color: colors.text }}>
                • {SCOPE_LABELS[scope] ?? scope}
              </Text>
            ))}
            <Text style={{ ...typography.caption, color: colors.muted, paddingTop: spacing.sm }}>
              Bu bir üçüncü taraf uygulamadır ve Ciklet tarafından
              barındırılmaz. İzni Ayarlar → Yetkili Uygulamalar’dan geri
              alabilirsin.
            </Text>
          </View>

          {grant.isError ? (
            <Text style={{ ...typography.caption, color: colors.danger }}>
              {grant.error instanceof ApiError ? grant.error.message : "İzin verilemedi."}
            </Text>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Button
              label="İzin Ver ve Başlat"
              onPress={() => grant.mutate()}
              loading={grant.isPending}
              fullWidth
              size="lg"
            />
            <Button
              label="Vazgeç"
              variant="ghost"
              onPress={() => router.back()}
              fullWidth
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (frameError || !html) {
    return (
      <Screen>
        <Stack.Screen options={{ title: activity.name }} />
        <EmptyState
          icon="compass"
          title="Aktivite yüklenemedi"
          description="Uygulamanın sunucusuna ulaşılamıyor. Daha sonra tekrar dene."
          action={<Button label="Geri dön" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: activity.name }} />
      <WebView
        ref={webviewRef}
        source={{ html, baseUrl: ACTIVITY_BASE_URL }}
        onMessage={onMessage}
        onError={() => setFrameError(true)}
        // Aktiviteler oyun olabilir; donanım ivmesi ve medya için gerekli.
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Aktivite kendi origin'inde çalışır; dosya sistemine erişemez.
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        style={{ flex: 1, backgroundColor: colors.deep }}
      />
    </>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  identify: "Kullanıcı adın ve avatarın",
  email: "E-posta adresin",
  guilds: "Üye olduğun sunucuların listesi",
  "rpc.activities.write": "Profilinde durum göstermek",
};
