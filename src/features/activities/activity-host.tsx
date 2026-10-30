import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Keyboard, Platform, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useActivities } from "@/api/hooks";
import type { ActivitySummary } from "@/api/types";
import { ActionSheet, Avatar, Button, Icon, Pressable, showToast } from "@/components/ui";
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
import { ActivityInviteSheet } from "@/features/activities/invite-sheet";
import { openActivityHelp } from "@/features/activities/invite";
import { resolveCardActivity } from "@/features/activities/card-state";
import { API_BASE_URL, resolveMediaUrl } from "@/lib/config";
import { fw } from "@/theme/fonts";
import { ServerEvent } from "@/realtime/events";
import { onGatewayEvent, onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { useActivitySession, type ActivitySession } from "@/stores/activity";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Aktivite katmanı — web host'un (components/activities-room +
 * activity-pip-host) mobil karşılığı. Kök düzende, yığının ÜSTÜNDE yaşar.
 *
 * Discord mobil gibi iki görünüm:
 *  - Tam ekran: üstte aşağı ok + aktivite adı, sağda kırmızı "Ayrıl".
 *  - Mini (PiP): aşağı ok / geri tuşu aktiviteyi sohbetin üstünde yüzen
 *    küçük, köşeleri yuvarlak bir pencereye indirir; sürüklenir, en yakın
 *    köşeye yapışır, dokununca yeniden büyür.
 * Uygulama dikey kilitli; "yatay" görünüm WebView'in kabını 90° döndürür
 * (aktivite yatay bir viewport görür — Watch Together video görünümüne
 * geçer). Yatayda sağ alttaki yuvarlak düğme mini pencereye iner.
 *
 * WebView TEK ve hiç sökülmez: görünümler yalnızca kabın konumunu/boyutunu
 * değiştirir, ağaçtaki yeri aynı kalır — aktivite yeniden yüklenmez.
 *
 * Akış (önceki `activities/[clientId]` ekranından taşındı):
 *  1. Yetki kapısı — `GET /api/activities/authorize`; izin yoksa onay ekranı.
 *  2. WebView + host belge; aktivite iframe'de çalışır.
 *  3. RPC köprüsü: SDK komutları burada karşılanır. Bilinmeyen komut AÇIK
 *     bir hata alır — sessiz kalınsa SDK 15 sn zaman aşımına kadar donuyor.
 *  4. Oda: ağ geçidine `activity.create` ile katılınır (davet kartı sayaca
 *     döner), katılımcılar ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE olarak
 *     iframe'e iletilir, iframe'den gelen `activity_sync` odaya yayınlanır.
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

const EDGE = spacing.md;
/** Mini pencerenin üst/alt payı: sohbet başlığını ve yazma çubuğunu örtmesin. */
const MINI_TOP_GAP = 56;
const MINI_BOTTOM_GAP = 96;
const TOP_BAR_HEIGHT = 52;
const SPRING = { damping: 20, stiffness: 220 };

/**
 * Aktiviteye verilen avatar adresi — web host ile aynı kural: MUTLAK
 * http(s) ya da `data:image`; başka her şey `null` (aktivite başka bir
 * kökende çalıştığı için göreli yol orada kırık görsel olurdu).
 */
function activityAvatar(imageUrl: string | null | undefined): string | null {
  const resolved = resolveMediaUrl(imageUrl);
  if (!resolved) return null;
  return /^(https?:\/\/|data:image\/)/i.test(resolved) ? resolved : null;
}

function toSdkParticipant(participant: RoomParticipant) {
  return {
    id: participant.id,
    username: participant.username,
    global_name: participant.name ?? null,
    avatar: activityAvatar(participant.imageUrl),
  };
}

export function ActivityHost() {
  const session = useActivitySession((s) => s.session);
  const signedIn = useAuth((s) => s.status === "signedIn");
  // Oturum kapanınca aktivite de kapanır (bir sonraki girişte geri gelmesin).
  useEffect(() => {
    if (!signedIn && useActivitySession.getState().session) useActivitySession.getState().leave();
  }, [signedIn]);
  if (!session || !signedIn) return null;
  // Her oturum kendi WebView'iyle başlar; görünüm değişimi anahtarı değiştirmez.
  return <ActivitySessionView key={session.key} session={session} />;
}

function ActivitySessionView({ session }: { session: ActivitySession }) {
  const mode = useActivitySession((s) => s.mode);
  const landscape = useActivitySession((s) => s.landscape);
  const minimize = useActivitySession((s) => s.minimize);
  const expand = useActivitySession((s) => s.expand);
  const leave = useActivitySession((s) => s.leave);
  const setLandscape = useActivitySession((s) => s.setLandscape);

  const profile = useAuth((s) => s.profile);
  const deepColor = useTheme((s) => s.palette.deep);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { data: catalog } = useActivities();
  const chatId = session.chatId ?? undefined;
  const serverId = session.serverId ?? undefined;
  /**
   * Güvenilir katalog kaydı (web activities-room, RUST_GATEWAY-06): kimlik →
   * adres → ad. Oturumun kimliği ve WebView adresi BURADAN gelir, davetin
   * tanımından değil: eski bir davet kartının eskimiş client_id'si
   * (uygulama yeniden kaydedildi) AUTHORIZE'ı reddettiriyor, aktivite
   * "Yetkilendirme kodu alınamadı"da kalıyordu. Katalogda yoksa açılmaz.
   */
  const trusted = useMemo(
    () =>
      catalog
        ? resolveCardActivity(
            { activityId: session.activity.id, activityUrl: session.activity.url, activityName: session.activity.name },
            catalog
          )
        : null,
    [catalog, session.activity]
  );
  const descriptor = useMemo(
    () =>
      trusted
        ? { ...session.activity, id: trusted.id, url: trusted.url, name: trusted.name, icon: trusted.icon }
        : session.activity,
    [trusted, session.activity]
  );
  const clientId = descriptor.id;
  /** Köprünün beklediği katalog kaydı (izin listesi vb.). */
  const activity: ActivitySummary = useMemo(
    () =>
      trusted ?? {
        id: descriptor.id,
        name: descriptor.name,
        url: descriptor.url,
        icon: descriptor.icon,
        description: descriptor.description,
      },
    [trusted, descriptor]
  );
  const catalogVerified = Boolean(trusted);
  useEffect(() => {
    if (!catalog || trusted) return;
    showToast("Bu aktivite doğrulanamadı, açılmadı.", "error");
    leave();
  }, [catalog, trusted, leave]);

  const webviewRef = useRef<WebView>(null);
  const [frameError, setFrameError] = useState(false);
  const participantsRef = useRef<RoomParticipant[]>([]);
  const frameReadyRef = useRef(false);
  const fetchTimesRef = useRef<number[]>([]);
  /** OPEN_INVITE_DIALOG açılışları (host tarafı hız sınırı). */
  const inviteOpensRef = useRef<number[]>([]);
  /** "Arkadaşları Davet Et" sayfası ve "⋯" menüsü. */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Aynı sohbetteki katılımcılar aynı örneği paylaşır (web: i-<id>-<chat>).
  const instanceId = `i-${clientId}-${chatId || "solo"}`;

  const status = useQuery({
    queryKey: ["activity-authorize", clientId],
    queryFn: () =>
      api<AuthorizeStatus>(`${endpoints.activityAuthorize}?clientId=${encodeURIComponent(clientId)}`),
    // Katalog doğrulanmadan sorulmaz: eskimiş kimlikle sorulsa 404 döner.
    enabled: Boolean(clientId) && catalogVerified,
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
  const running = consented && !frameError;

  const requestAuthCode = useCallback(
    async (scope: string | undefined) => {
      const result = await api<{ code: string }>(endpoints.activityAuthorize, {
        method: "POST",
        body: { clientId, instanceId, channelId: chatId ?? "", scope, approve: true },
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
    if (!consented || !chatId) return;
    const join = () =>
      sendGatewayEvent({
        event_type: "activity.create",
        chat_id: chatId,
        activity: {
          id: descriptor.id,
          name: descriptor.name,
          url: descriptor.url,
          icon: descriptor.icon,
          ...(descriptor.color ? { color: descriptor.color } : {}),
        },
      });
    join();
    // Oda üyeliği bağlantıyla düşer: yeniden bağlanınca yeniden katıl.
    const releaseOpen = onGatewayOpen(join);
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
      releaseOpen();
      release();
      sendGatewayEvent({ event_type: "activity.leave", chat_id: chatId });
    };
  }, [consented, chatId, descriptor, send]);

  // Görünüm değişimi aktiviteye bildirilir (SDK ACTIVITY_LAYOUT_MODE_UPDATE /
  // ORIENTATION_UPDATE) — PiP'te sade görünüme geçebilsin.
  useEffect(() => {
    if (!frameReadyRef.current) return;
    send(rpcDispatch("ACTIVITY_LAYOUT_MODE_UPDATE", { layout_mode: mode === "mini" ? "pip" : "focused" }));
  }, [mode, send]);
  useEffect(() => {
    if (!frameReadyRef.current) return;
    const orientation = landscape ? "landscape" : "portrait";
    send(rpcDispatch("ORIENTATION_UPDATE", { screen_orientation: orientation, orientation }));
  }, [landscape, send]);

  // Android geri tuşu: yataydan çık → mini pencereye in (Discord). Onay
  // ekranında geri, aktiviteyi kapatır.
  useEffect(() => {
    if (mode !== "full") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (landscape) setLandscape(false);
      else if (running) minimize();
      else leave();
      return true;
    });
    return () => subscription.remove();
  }, [mode, landscape, running, minimize, leave, setLandscape]);

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

  /** 10 saniyede en fazla 5 davet penceresi; doluysa false. */
  const takeInviteSlot = () => {
    const now = Date.now();
    const recent = inviteOpensRef.current.filter((at) => now - at < 10_000);
    if (recent.length >= 5) {
      inviteOpensRef.current = recent;
      return false;
    }
    recent.push(now);
    inviteOpensRef.current = recent;
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
          // Kodlar web host ile aynı: 4003 izin listesi dışı, 4004 ağ/zaman
          // aşımı; 4029 (hız sınırı) mobile özgü.
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
              // Çerez kavanozu ve kimlik bilgisi YOK: salt okuma.
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

        case "OPEN_INVITE_DIALOG": {
          // Discord `openInviteDialog()`: "Arkadaşları Davet Et" sayfası açılır,
          // komut HEMEN `{}` ile yanıtlanır; kimin davet edildiği aktiviteye
          // söylenmez. Kodlar web host ile aynı (1002 / 4005 / 4029); asıl
          // yetki kontrolü sunucuda (web lib/activity/invite).
          if (!chatId) {
            send(rpcError(cmd, nonce, 1002, "Invites need a chat-bound activity session"));
            return;
          }
          // Mini pencere etkileşimsiz: komut bir kullanıcı hareketinden gelemez.
          if (!consented || useActivitySession.getState().mode === "mini") {
            send(rpcError(cmd, nonce, 4005, "The user is not in this activity session"));
            return;
          }
          if (!takeInviteSlot()) {
            send(rpcError(cmd, nonce, 4029, "Too many invite dialog requests"));
            return;
          }
          setInviteOpen(true);
          send(rpcResponse(cmd, nonce, {}));
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
          // Klavye açılınca görünüm küçülüyor — iframe resize ile toparlar.
          send(rpcResponse(cmd, nonce, { iosKeyboardResizesView: true }));
          return;

        case "SET_CONFIG":
          // PiP penceresi etkileşimsiz: dokunmak pencereyi büyütür.
          send(rpcResponse(cmd, nonce, { use_interactive_pip: false }));
          return;

        case "USER_SETTINGS_GET_LOCALE":
          send(rpcResponse(cmd, nonce, { locale: deviceLocale() }));
          return;

        case "CLOSE":
          leave();
          return;

        default:
          send(rpcError(cmd, nonce, 1001, `Unknown command: ${cmd}`));
      }
    },
    [chatId, serverId, consented, profile, deepColor, requestAuthCode, send, leave]
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
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
        // chatId iframe'den ALINMAZ: aktivite yalnızca gömüldüğü sohbete yazar.
        const state = data.state;
        if (chatId && consented && state && typeof state === "object") {
          sendGatewayEvent({ event_type: "activity.sync", chat_id: chatId, state });
        }
        return;
      }
      if (data.type === "activity_get_location") {
        // Mobil host konum vermiyor; işaretçi (0,0)'a düşmesin diye açık hata.
        send({ type: "activity_set_location", error: true });
        return;
      }

      if (!isRPCMessage(data)) return;

      // El sıkışma: iframe hazır → READY yayınla.
      if (data.cmd === "DISPATCH" && data.evt === "READY") {
        frameReadyRef.current = true;
        const view = useActivitySession.getState();
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
        send(rpcDispatch("ACTIVITY_LAYOUT_MODE_UPDATE", { layout_mode: view.mode === "mini" ? "pip" : "focused" }));
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
        leave();
        return;
      }
      if (!data.nonce) return;
      void handleCommand(data, activity);
    },
    [activity, chatId, consented, instanceId, profile, handleCommand, send, leave]
  );

  const html = useMemo(
    () =>
      buildHostDocument({
        activityUrl: descriptor.url,
        clientId,
        instanceId,
        channelId: chatId ?? "",
        backgroundColor: deepColor,
      }),
    // Tema rengi değişince belge yeniden yüklenmesin: ilk renk yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [descriptor.url, clientId, instanceId, chatId]
  );

  // ── Yerleşim ───────────────────────────────────────────────────────
  const mini = mode === "mini";
  const showLandscape = !mini && landscape;
  const miniW = Math.round(Math.min(screenW * 0.52, 240));
  const miniH = Math.round((miniW * 9) / 16);
  const leftX = EDGE;
  const rightX = screenW - miniW - EDGE;
  const topY = insets.top + MINI_TOP_GAP;
  const bottomY = Math.max(topY, screenH - insets.bottom - miniH - MINI_BOTTOM_GAP);

  // Mini pencerenin konumu (başlangıç: sağ üst).
  const x = useSharedValue(rightX);
  const y = useSharedValue(topY);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Ekran boyutu değişince pencere köşesinde kalsın.
  useEffect(() => {
    x.set(x.get() + miniW / 2 < screenW / 2 ? leftX : rightX);
    y.set(y.get() + miniH / 2 < screenH / 2 ? topY : bottomY);
  }, [x, y, miniW, miniH, screenW, screenH, leftX, rightX, topY, bottomY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(mini)
        // Küçük kaydırmalar dokunma sayılsın (dokununca büyür).
        .minDistance(6)
        .onStart(() => {
          startX.set(x.get());
          startY.set(y.get());
        })
        .onUpdate((event) => {
          x.set(startX.get() + event.translationX);
          y.set(startY.get() + event.translationY);
        })
        .onEnd((event) => {
          // Fırlatma yönü de hesaba katılır: hızlı bir itiş karşı köşeye gider.
          const projectedX = x.get() + event.velocityX * 0.12 + miniW / 2;
          const projectedY = y.get() + event.velocityY * 0.12 + miniH / 2;
          x.set(withSpring(projectedX < screenW / 2 ? leftX : rightX, SPRING));
          y.set(withSpring(projectedY < screenH / 2 ? topY : bottomY, SPRING));
        }),
    [mini, x, y, startX, startY, miniW, miniH, screenW, screenH, leftX, rightX, topY, bottomY]
  );

  const placed = useAnimatedStyle(() => {
    if (mini) return { transform: [{ translateX: x.get() }, { translateY: y.get() }] };
    if (showLandscape) return { transform: [{ rotate: "90deg" }] };
    return { transform: [] };
  }, [mini, showLandscape]);

  // Klavye: yalnızca dikey tam ekranda gövde klavye kadar kısalır (mini
  // pencere sohbetin yazma çubuğu açıkken ezilmesin).
  const keyboard = useAnimatedKeyboard();
  const keyboardEvent = useSharedValue(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      keyboardEvent.set(withTiming(event.endCoordinates.height, { duration: 160 }));
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardEvent.set(withTiming(0, { duration: 160 }));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardEvent]);
  const avoidKeyboard = !mini && !showLandscape;
  const bodyStyle = useAnimatedStyle(() => {
    if (!avoidKeyboard) return { paddingBottom: 0 };
    return { paddingBottom: Math.max(keyboard.height.value, keyboardEvent.get()) };
  }, [avoidKeyboard]);

  const containerStyle = mini
    ? {
        left: 0,
        top: 0,
        width: miniW,
        height: miniH,
        borderRadius: radii.lg,
        borderCurve: "continuous" as const,
        overflow: "hidden" as const,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }
    : showLandscape
      ? {
          // Döndürülmüş kap: genişlik/yükseklik yer değiştirir, merkez aynı.
          left: (screenW - screenH) / 2,
          top: (screenH - screenW) / 2,
          width: screenH,
          height: screenW,
        }
      : { left: 0, top: 0, width: screenW, height: screenH };

  // Katalog doğrulanana kadar da bekleme ekranı: WebView doğrulanmamış
  // adresle hiç yüklenmez.
  const consentPending = !catalogVerified || status.isLoading || (status.data && !status.data.authorized);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          // zIndex YOK: kök düzende yığından sonra, diyalog/bildirim/çağrı
          // katmanlarından önce çizilir; onlar aktivitenin üstünde kalır.
          { position: "absolute", backgroundColor: deepColor },
          containerStyle,
          placed,
        ]}
      >
        {showLandscape ? <StatusBar hidden /> : null}

        {/* Üst çubuk — Discord: aşağı ok + ad solda, kırmızı "Ayrıl" sağda. */}
        {!mini && !showLandscape ? (
          <View
            style={{
              paddingTop: insets.top,
              height: insets.top + TOP_BAR_HEIGHT,
              paddingHorizontal: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              backgroundColor: deepColor,
            }}
          >
            <Pressable
              haptic="light"
              onPress={running ? minimize : leave}
              accessibilityRole="button"
              accessibilityLabel={running ? "Aktiviteyi küçült" : "Kapat"}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radii.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.raised : "transparent",
              })}
            >
              <Icon name="chevron-down" size={26} color={colors.bright} />
            </Pressable>
            <Text numberOfLines={1} style={{ ...typography.bodyStrong, fontSize: 17, color: colors.bright, flex: 1 }}>
              {descriptor.name}
            </Text>
            {running ? (
              <Pressable
                haptic="light"
                onPress={() => setLandscape(true)}
                accessibilityRole="button"
                accessibilityLabel="Yatay tam ekran"
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                <Icon name="maximize" size={20} color={colors.bright} />
              </Pressable>
            ) : null}
            {running ? (
              <Pressable
                haptic="light"
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Aktivite menüsü"
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                <Icon name="more" size={22} color={colors.bright} />
              </Pressable>
            ) : null}
            <Pressable
              haptic="warning"
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Aktiviteden ayrıl"
              style={({ pressed }) => ({
                height: 34,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.dangerSolid,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ ...typography.bodyStrong, ...fw(700), color: "#ffffff" }}>Ayrıl</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Yatayda kabın solu telefonun üstü (çentik), sağı altı (ev çubuğu). */}
        <Animated.View
          style={[
            { flex: 1 },
            showLandscape ? { paddingLeft: insets.top, paddingRight: insets.bottom } : null,
            bodyStyle,
          ]}
        >
          {frameError ? (
            <FrameError onClose={leave} />
          ) : consentPending ? (
            mini ? null : (
              <ConsentGate
                loading={!catalogVerified || status.isLoading}
                status={status.data}
                activity={activity}
                granting={grant.isPending}
                grantError={grant.isError ? (grant.error instanceof ApiError ? grant.error.message : "İzin verilemedi.") : null}
                onGrant={() => grant.mutate()}
                onCancel={leave}
              />
            )
          ) : (
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
              // Yeni pencere isteği aynı WebView'de açılmaz; aktiviteler dış
              // bağlantı için openExternalLink kullanmalı.
              setSupportMultipleWindows={false}
              style={{ flex: 1, backgroundColor: deepColor }}
            />
          )}
        </Animated.View>

        {/* Mini pencere etkileşimsiz: dokununca büyür, sürükleyince taşınır. */}
        {mini ? (
          <Pressable
            noHitSlop
            haptic="light"
            onPress={expand}
            accessibilityRole="button"
            accessibilityLabel={`${descriptor.name} aktivitesini büyüt`}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}

        {/* Yatay tam ekran: sağ altta yuvarlak düğme mini pencereye iner. */}
        {showLandscape ? (
          <Pressable
            haptic="light"
            onPress={minimize}
            accessibilityRole="button"
            accessibilityLabel="Küçük pencereye al"
            style={({ pressed }) => ({
              position: "absolute",
              right: spacing.lg + insets.bottom,
              bottom: spacing.lg,
              width: 48,
              height: 48,
              borderRadius: radii.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            })}
          >
            <Icon name="chevron-down" size={26} color="#ffffff" />
          </Pressable>
        ) : null}

        {/* Discord'un aktivite menüsü: Arkadaşları Davet Et + Yardım Merkezi.
            Modal'lar kök pencerede açılır; kabın konumundan etkilenmez. */}
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          header={
            <Text numberOfLines={1} style={{ ...typography.bodyStrong, color: colors.bright }}>
              {descriptor.name}
            </Text>
          }
          items={[
            ...(chatId
              ? [{ key: "invite", label: "Arkadaşları Davet Et", icon: "user-plus" as const, onPress: () => setInviteOpen(true) }]
              : []),
            {
              key: "help",
              label: "Yardım Merkezi",
              icon: "help" as const,
              onPress: () => openActivityHelp(activity, deepColor),
            },
          ]}
        />
        {inviteOpen && chatId ? <ActivityInviteSheet chatId={chatId} onClose={() => setInviteOpen(false)} /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

function ConsentGate({
  loading,
  status,
  activity,
  granting,
  grantError,
  onGrant,
  onCancel,
}: {
  loading: boolean;
  status: AuthorizeStatus | undefined;
  activity: ActivitySummary;
  granting: boolean;
  grantError: string | null;
  onGrant: () => void;
  onCancel: () => void;
}) {
  if (loading || !status) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>Aktivite hazırlanıyor…</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        <Avatar imageUrl={status.appIcon ?? activity.icon} fallbackText={activity.name} size={72} shape="squircle" />
        <Text style={{ ...typography.display, color: colors.bright, textAlign: "center" }}>{status.appName}</Text>
      </View>

      <View style={{ padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.panel, gap: spacing.sm }}>
        <Text style={{ ...typography.overline, color: colors.muted }}>BU UYGULAMA ŞUNLARA ERİŞECEK</Text>
        {status.scopes.map((scope) => (
          <Text key={scope} style={{ ...typography.body, color: colors.text }}>
            • {SCOPE_LABELS[scope] ?? scope}
          </Text>
        ))}
        <Text style={{ ...typography.caption, color: colors.muted, paddingTop: spacing.sm }}>
          Bu bir üçüncü taraf uygulamadır ve Ciklet tarafından barındırılmaz. İzni Ayarlar → Yetkili
          Uygulamalar’dan geri alabilirsin.
        </Text>
      </View>

      {grantError ? <Text style={{ ...typography.caption, color: colors.danger }}>{grantError}</Text> : null}

      <View style={{ gap: spacing.sm }}>
        <Button label="İzin Ver ve Başlat" onPress={onGrant} loading={granting} fullWidth size="lg" />
        <Button label="Vazgeç" variant="ghost" onPress={onCancel} fullWidth />
      </View>
    </View>
  );
}

function FrameError({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
      <Icon name="compass" size={32} color={colors.muted} />
      <Text style={{ ...typography.bodyStrong, color: colors.bright, textAlign: "center" }}>Aktivite yüklenemedi</Text>
      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
        Uygulamanın sunucusuna ulaşılamıyor. Daha sonra tekrar dene.
      </Text>
      <Button label="Kapat" variant="secondary" onPress={onClose} />
    </View>
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
