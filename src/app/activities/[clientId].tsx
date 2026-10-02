import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import type { ActivitySummary } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  KeyboardAvoider,
  Screen,
  ScreenLoader,
} from "@/components/ui";
import {
  ACTIVITY_BASE_URL,
  FETCH_EXTERNAL_MAX_BODY,
  FETCH_EXTERNAL_RATE_LIMIT,
  FETCH_EXTERNAL_TIMEOUT_MS,
  buildHostDocument,
  deliverScript,
  fetchAllowlistFor,
  isRPCMessage,
  rpcDispatch,
  rpcError,
  rpcResponse,
  validateExternalFetchUrl,
  type RPCMessage,
} from "@/features/activities/bridge";
import { API_BASE_URL, resolveMediaUrl } from "@/lib/config";
import { ServerEvent } from "@/realtime/events";
import { onGatewayEvent, sendGatewayEvent } from "@/realtime/gateway";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Aktivite çalıştırıcı — web host'un (ciklet-web components/activities-room)
 * mobil karşılığı.
 *
 * Üç aşama:
 *  1. Yetki kapısı — `GET /api/activities/authorize` kullanıcı bu uygulamaya
 *     daha önce izin verdi mi diye sorar. Vermediyse onay ekranı gösterilir
 *     ve `POST … { grantOnly: true, approve: true }` ile kayıt açılır.
 *  2. WebView + host belge yüklenir, aktivite iframe'de çalışır.
 *  3. RPC köprüsü: SDK komutları (bkz. ciklet-sdk RPCCommands) burada
 *     karşılanır. Bilinmeyen komut AÇIK bir hata çerçevesi alır — sessiz
 *     kalınsa SDK 15 sn zaman aşımına kadar donuyor.
 *
 * Aktivite odası: ağ geçidine `activity.create` ile katılınır (sohbetteki
 * davet kartı "katıl" olabilsin), katılımcı değişimleri
 * ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE olarak iframe'e iletilir,
 * iframe'den gelen `activity_sync` state yaması odaya yayınlanır.
 */
interface AuthorizeStatus {
  authorized: boolean;
  appName: string;
  appIcon: string | null;
  scopes: string[];
}

interface RoomParticipant {
  id: string;
  username: string;
  name?: string | null;
  imageUrl?: string | null;
}

/**
 * Aktiviteye verilen avatar adresi — web host (ciklet-web cd8955d3) ile aynı
 * kural: MUTLAK http(s) ya da `data:image`; başka her şey `null`.
 *
 * Sunucu üretilmiş avatarları göreli yolla (`/api/avatar/<ad>`) veriyor;
 * aktivite başka bir kökende çalıştığı için göreli yol kendi kökeninde
 * aranır ve kırık görsel çıkardı.
 */
function activityAvatar(imageUrl: string | null | undefined): string | null {
  const resolved = resolveMediaUrl(imageUrl);
  if (!resolved) return null;
  return /^(https?:\/\/|data:image\/)/i.test(resolved) ? resolved : null;
}

/** SDK'nın beklediği katılımcı şekli (web host ile aynı eşleme). */
function toSdkParticipant(participant: RoomParticipant) {
  return {
    id: participant.id,
    username: participant.username,
    global_name: participant.name ?? null,
    avatar: activityAvatar(participant.imageUrl),
  };
}

export default function ActivityScreen() {
  const { clientId, chatId, serverId } = useLocalSearchParams<{
    clientId: string;
    chatId?: string;
    serverId?: string;
  }>();

  const profile = useAuth((s) => s.profile);
  const deepColor = useTheme((s) => s.palette.deep);
  const { data: activities } = useActivities();
  const activity = activities?.find((a) => a.id === clientId);

  const webviewRef = useRef<WebView>(null);
  const [frameError, setFrameError] = useState(false);
  /** Odanın son katılımcı listesi (ağ geçidi `activity.update`). */
  const participantsRef = useRef<RoomParticipant[]>([]);
  /** iframe READY dedi; dispatch'ler ancak bundan sonra anlamlı. */
  const frameReadyRef = useRef(false);
  /** FETCH_EXTERNAL hız sınırı — son bir dakikadaki istek zamanları. */
  const fetchTimesRef = useRef<number[]>([]);

  // Aktivite oturumunun kimliği — aynı sohbetteki katılımcılar aynı
  // örneği paylaşır, bu yüzden sohbet kimliğinden türetilir (web: i-<id>-<chat>).
  const instanceId = useMemo(
    () => `i-${clientId}-${chatId || "solo"}`,
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

  const consented = status.data?.authorized === true;

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

  const send = useCallback((response: unknown) => {
    webviewRef.current?.injectJavaScript(deliverScript(response));
  }, []);

  // ── Aktivite odası (ağ geçidi) ─────────────────────────────────────
  useEffect(() => {
    if (!consented || !chatId || !activity) return;
    sendGatewayEvent({
      event_type: "activity.create",
      chat_id: chatId,
      activity: { id: activity.id, name: activity.name, url: activity.url, icon: activity.icon },
    });
    const release = onGatewayEvent(ServerEvent.ACTIVITY_UPDATE, (frame) => {
      if (frame.chatId !== chatId || !Array.isArray(frame.participants)) return;
      const participants = (frame.participants as RoomParticipant[]).filter(
        (p) => typeof p?.id === "string" && typeof p?.username === "string"
      );
      participantsRef.current = participants;
      if (!frameReadyRef.current) return;
      send(
        rpcDispatch("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", {
          participants: participants.map(toSdkParticipant),
        })
      );
    });
    return () => {
      release();
      sendGatewayEvent({ event_type: "activity.leave", chat_id: chatId });
    };
  }, [consented, chatId, activity, send]);

  /** Dakikalık kayan pencere; doluysa false. */
  const takeFetchSlot = () => {
    const now = Date.now();
    const recent = fetchTimesRef.current.filter((at) => now - at < 60_000);
    if (recent.length >= FETCH_EXTERNAL_RATE_LIMIT) {
      fetchTimesRef.current = recent;
      return false;
    }
    recent.push(now);
    fetchTimesRef.current = recent;
    return true;
  };

  const handleCommand = useCallback(
    async (message: RPCMessage, current: ActivitySummary) => {
      const { cmd, nonce } = message;
      const args = (message.args ?? {}) as Record<string, unknown>;

      switch (cmd) {
        case "AUTHORIZE": {
          const scope = Array.isArray(args.scope)
            ? (args.scope as string[]).join(" ")
            : typeof args.scope === "string"
              ? args.scope
              : undefined;
          try {
            const code = await requestAuthCode(scope);
            send(rpcResponse(cmd, nonce, { code }));
          } catch (err) {
            send(rpcError(cmd, nonce, 4001, err instanceof ApiError ? err.message : "Authorization failed"));
          }
          return;
        }

        case "AUTHENTICATE": {
          const accessToken = typeof args.access_token === "string" ? args.access_token : "";
          // Yalnızca OAuth sunucumuzun ürettiği opak jeton; sunucuda doğrulanır.
          if (!accessToken.startsWith("cik_at_")) {
            send(rpcError(cmd, nonce, 4001, "A Ciklet OAuth access token is required"));
            return;
          }
          try {
            const verified = await api<{
              valid: boolean;
              user?: { id: string; username: string; name: string | null; imageUrl: string | null };
              scopes?: string[];
              client_id?: string;
              expires_at?: string;
            }>("/api/oauth/verify", {
              method: "POST",
              skipAuth: true,
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!verified?.valid || !verified.user) {
              send(rpcError(cmd, nonce, 4001, "Invalid access token"));
              return;
            }
            send(
              rpcResponse(cmd, nonce, {
                access_token: accessToken,
                user: {
                  id: verified.user.id,
                  username: verified.user.username,
                  global_name: verified.user.name ?? null,
                  avatar: activityAvatar(verified.user.imageUrl),
                },
                scopes: verified.scopes ?? ["identify"],
                expires: verified.expires_at,
                application: { id: verified.client_id ?? current.id, name: current.name, description: current.description ?? null, icon: current.icon },
              })
            );
          } catch {
            send(rpcError(cmd, nonce, 4001, "Token verification failed"));
          }
          return;
        }

        case "GET_CHANNEL":
          send(rpcResponse(cmd, nonce, { id: chatId ?? "", type: serverId ? 0 : 1, name: chatId ?? "" }));
          return;

        case "GET_INSTANCE_CONNECTED_PARTICIPANTS": {
          const participants =
            participantsRef.current.length > 0
              ? participantsRef.current.map(toSdkParticipant)
              : profile
                ? [{ id: profile.id, username: profile.username, global_name: profile.name ?? null, avatar: activityAvatar(profile.imageUrl) }]
                : [];
          send(rpcResponse(cmd, nonce, { participants }));
          return;
        }

        case "OPEN_EXTERNAL_LINK": {
          try {
            const parsed = new URL(String(args.url));
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
              send(rpcError(cmd, nonce, 4002, "Only http(s) URLs are allowed"));
              return;
            }
            // WebView'de yeni pencere açılmaz; sistem tarayıcısı (uygulama içi sekme).
            void WebBrowser.openBrowserAsync(parsed.toString(), { toolbarColor: deepColor });
            send(rpcResponse(cmd, nonce, {}));
          } catch {
            send(rpcError(cmd, nonce, 4002, "Invalid URL"));
          }
          return;
        }

        case "FETCH_EXTERNAL": {
          const allowlist = fetchAllowlistFor(current);
          const target = validateExternalFetchUrl(args.url, allowlist);
          // Kodlar web host ile aynı (ciklet-web c13ff2fc): 4003 izin listesi
          // dışı, 4004 ağ/zaman aşımı; 4029 (hız sınırı) mobile özgü.
          if (!target) {
            send(
              rpcError(
                cmd,
                nonce,
                4003,
                allowlist.length === 0
                  ? "This activity has no fetch allowlist configured"
                  : "URL is not on this activity's allowlist"
              )
            );
            return;
          }
          if (!takeFetchSlot()) {
            send(rpcError(cmd, nonce, 4029, "Rate limited"));
            return;
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), FETCH_EXTERNAL_TIMEOUT_MS);
          try {
            const response = await fetch(target.toString(), {
              method: "GET",
              // Çerez kavanozu ve kimlik bilgisi YOK: kullanıcının hesabı bu
              // isteğe karışmaz; salt okuma.
              credentials: "omit",
              redirect: "follow",
              headers: {
                Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
              },
              signal: controller.signal,
            });
            const finalUrl = response.url || target.toString();
            // Yönlendirme izin listesinin dışına çıkmış olabilir.
            if (!validateExternalFetchUrl(finalUrl, allowlist)) {
              send(rpcError(cmd, nonce, 4003, "Redirected outside the allowlist"));
              return;
            }
            const text = await response.text();
            send(
              rpcResponse(cmd, nonce, {
                status: response.status,
                body: text.length > FETCH_EXTERNAL_MAX_BODY ? text.slice(0, FETCH_EXTERNAL_MAX_BODY) : text,
                url: finalUrl,
              })
            );
          } catch {
            send(rpcError(cmd, nonce, 4004, "Fetch failed or timed out"));
          } finally {
            clearTimeout(timer);
          }
          return;
        }

        case "SET_ACTIVITY":
        case "CAPTURE_LOG":
        case "SUBSCRIBE":
        case "UNSUBSCRIBE":
          if (cmd === "CAPTURE_LOG" && __DEV__) {
            console.warn(`[Aktivite:${current.name}] [${String(args.level ?? "log")}]`, String(args.message ?? ""));
          }
          send(rpcResponse(cmd, nonce, {}));
          return;

        case "GET_PLATFORM_BEHAVIORS":
          // Klavye açılınca WebView küçülüyor (KeyboardAvoider) — görünüm yeniden boyutlanır.
          send(rpcResponse(cmd, nonce, { iosKeyboardResizesView: true }));
          return;

        case "SET_CONFIG":
          send(rpcResponse(cmd, nonce, { use_interactive_pip: false }));
          return;

        case "USER_SETTINGS_GET_LOCALE":
          send(rpcResponse(cmd, nonce, { locale: deviceLocale() }));
          return;

        case "CLOSE":
          router.back();
          return;

        default:
          // Bilinmeyen komut SESSİZ KALMAZ: SDK tarafındaki istek 15 sn
          // zaman aşımına uğrayıp uygulamayı donduruyordu.
          send(rpcError(cmd, nonce, 1001, `Unknown command: ${cmd}`));
      }
    },
    [chatId, serverId, profile, deepColor, requestAuthCode, send]
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!activity) return;
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
      if (payload.type !== "rpc") return;
      const data = payload.message as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return;

      // Özel (RPC dışı) iletiler — birinci parti sözleşme.
      if (data.type === "activity_sync") {
        // chatId iframe'den ALINMAZ: aktivite yalnızca içine gömüldüğü
        // sohbete state basabilir.
        const state = data.state;
        if (chatId && consented && state && typeof state === "object") {
          sendGatewayEvent({ event_type: "activity.sync", chat_id: chatId, state });
        }
        return;
      }
      if (data.type === "activity_get_location") {
        // Mobil host konum vermiyor (Globe mobilde listelenmiyor); işaretçi
        // (0,0)'a düşmesin diye açık hata.
        send({ type: "activity_set_location", error: true });
        return;
      }

      if (!isRPCMessage(data)) return;

      // El sıkışma: iframe hazır olduğunu bildirdi → READY yayınla.
      if (data.cmd === "DISPATCH" && data.evt === "READY") {
        frameReadyRef.current = true;
        send(
          rpcDispatch("READY", {
            v: 1,
            config: { api_endpoint: API_BASE_URL, environment: "production" },
            user: profile
              ? { id: profile.id, username: profile.username, global_name: profile.name, avatar: activityAvatar(profile.imageUrl) }
              : undefined,
            channel_id: chatId ?? undefined,
            instance_id: instanceId,
            frame_id: instanceId,
            platform: "mobile",
          })
        );
        if (participantsRef.current.length > 0) {
          send(
            rpcDispatch("ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE", {
              participants: participantsRef.current.map(toSdkParticipant),
            })
          );
        }
        return;
      }

      if (data.cmd === "CLOSE") {
        router.back();
        return;
      }
      if (!data.nonce) return;
      void handleCommand(data, activity);
    },
    [activity, chatId, consented, instanceId, profile, handleCommand, send]
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
      {/* Klavye açılınca WebView klavye kadar küçülür (edge-to-edge'de pencere
          kendiliğinden küçülmüyor); iframe içindeki düzen resize ile toparlar. */}
      <KeyboardAvoider applySafeArea={false} style={{ backgroundColor: deepColor }}>
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
          // Yeni pencere isteği (target=_blank) aynı WebView'de açılmaz;
          // aktiviteler dış bağlantı için openExternalLink kullanmalı.
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: deepColor }}
        />
      </KeyboardAvoider>
    </>
  );
}

function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "tr-TR";
  } catch {
    return "tr-TR";
  }
}

const SCOPE_LABELS: Record<string, string> = {
  identify: "Kullanıcı adın ve avatarın",
  email: "E-posta adresin",
  guilds: "Üye olduğun sunucuların listesi",
  "rpc.activities.write": "Profilinde durum göstermek",
};
