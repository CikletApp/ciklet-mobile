import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { LiveKitRoom, useConnectionState, useParticipants, useRoomContext } from "@livekit/react-native";
import { ConnectionState, DisconnectReason, RoomEvent } from "livekit-client";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { useDirects } from "@/api/hooks";
import { Avatar, IconButton, Pressable, showToast } from "@/components/ui";
import { useCurrentAudioRoute } from "@/features/voice/audio-route";
import { CallControls } from "@/features/voice/call-controls";
import { useVoiceToken } from "@/features/voice/use-voice-token";
import { LIVEKIT_URL } from "@/lib/livekit";
import { displayNameOf } from "@/lib/format";
import { ClientEvent } from "@/realtime/events";
import { onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { stopCallLocally, useCallActions } from "@/realtime/use-call-events";
import { useCall } from "@/stores/call";
import { useVoice } from "@/stores/voice";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { callKit, setCallKitEndReason } from "./callkit";
import { CALL_TRANSFERRED_MESSAGE } from "./ongoing-call";
import { CallKitMuteSync } from "./callkit-mute-sync";
import { CallSurface } from "./call-surface";
import { MiniCall } from "./mini-call";
import { useOngoingCallService } from "./use-ongoing-call-service";
import { useCallTimer } from "./use-call-timer";
import { useProximityScreenOff } from "./use-proximity-screen-off";
import { VideoCallStage } from "./video-call-stage";
import { useVideoUpgradeActions, useVideoUpgradeListener } from "./video-upgrade";

/**
 * Çağrı katmanı — uygulamanın her yerinden görünür.
 *
 * Üç durum tek bileşende: gelen arama (zil), giden arama (bekleme) ve bağlı
 * çağrı. Tam ekran yüzeyde açılır (CallSurface: Android'de Modal, iOS'ta
 * pencere katmanı — nedeni orada); kullanıcı hangi ekranda olursa olsun
 * çağrıyı görür. Bu yüzden kök düzene bağlanır, tek tek ekranlara değil.
 *
 * iOS'ta gelen aramanın zili sistem arama arayüzünde (CallKit); uygulama içi
 * zil ekranı yalnızca sistem çağrıyı almazsa açılır (`ringsInSystemUi`).
 */
/** Aramayı mesajla reddet (WhatsApp) — zil ekranının içinde açılır. */
const QUICK_REPLIES = [
  "Şu an konuşamıyorum, sonra arayacağım.",
  "Müsait değilim, yazabilir misin?",
  "Birazdan dönüş yapacağım.",
];

export function CallOverlay() {
  const session = useCall((s) => s.session);
  const { acceptCall, declineCall, hangUp } = useCallActions();
  const [repliesOpen, setRepliesOpen] = useState(false);

  /**
   * Gelen aramada LiveKit oda adını çözer.
   *
   * ⚠️ Sunucu `incoming_call` yükünde DM kimliğini GÖNDERMİYOR (yalnızca
   * `caller`, `type`, `callId`) — oysa oda adı olarak DM kimliği gerekiyor,
   * `/api/livekit` taraflığı ona göre doğruluyor. Bu yüzden aranan taraf
   * kimliği kendi DM listesinden bulur. Karşı tarafla hiç sohbeti yoksa
   * çağrı bağlanamaz. Kalıcı çözüm sunucunun yüke `directChannelId`
   * eklemesi (bu değeri zaten hesaplıyor) — bkz. docs/ROADMAP.md.
   */
  const { data: directs } = useDirects();
  const insets = useSafeAreaInsets();
  const resolvedDirectId =
    session?.directId ??
    directs?.find(
      (d) =>
        d.profileOne.id === session?.peer.id || d.profileTwo.id === session?.peer.id
    )?.id ??
    null;

  if (!session) {
    if (repliesOpen) setRepliesOpen(false);
    return null;
  }

  const replyWith = (text: string) => {
    const directId = resolvedDirectId;
    setRepliesOpen(false);
    declineCall();
    if (!directId) return;
    void api(endpoints.sendDirectMessage(directId), { method: "POST", body: { content: text } }).catch(() =>
      showToast("Mesaj gönderilemedi.")
    );
  };

  const isRinging = session.status === "ringing";
  const isConnected = session.status === "connected";

  // Bağlı çağrı modalın DIŞINDA: LiveKit odası küçültülünce de açık kalmalı
  // (modal kapanınca içi sökülür, oda düşerdi).
  if (isConnected && resolvedDirectId) {
    return <ConnectedCall directId={resolvedDirectId} onHangUp={hangUp} kind={session.kind} />;
  }

  // iOS: gelen arama sistem arama arayüzünde çalıyor (use-call-events `ring`);
  // uygulama içi zil ekranı onunla üst üste binmesin.
  if (isRinging && session.ringsInSystemUi) {
    if (repliesOpen) setRepliesOpen(false);
    return null;
  }

  return (
    <CallSurface onRequestClose={hangUp}>
      <View style={{ flex: 1, backgroundColor: colors.deep }}>
        {(
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: spacing.xl,
              gap: spacing.lg,
            }}
          >
            <Avatar
              imageUrl={session.peer.imageUrl}
              fallbackText={session.peer.username}
              size={112}
              backgroundColor={colors.deep}
            />
            <Text style={{ ...typography.displayLg, color: colors.bright }}>
              {displayNameOf(session.peer)}
            </Text>
            <Text style={{ ...typography.body, color: colors.muted }}>
              {isRinging
                ? session.kind === "video"
                  ? "Görüntülü arıyor…"
                  : "Sesli arıyor…"
                : session.status === "busy"
                  ? "Meşgul"
                  : session.status === "noAnswer"
                  ? "Cevap yok"
                  : "Aranıyor…"}
            </Text>
          </View>
        )}

        {/* Bağlı çağrıda kontroller LiveKit odasının içinde (CallStage) —
            orada mikrofon ve hoparlör durumunu okuyabiliyorlar. Burada
            yalnızca zil ve bekleme durumlarının düğmeleri var. */}
        {isRinging && repliesOpen ? (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md }}>
            {QUICK_REPLIES.map((text) => (
              <Pressable
                key={text}
                haptic="light"
                onPress={() => replyWith(text)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radii.xl,
                  borderCurve: "continuous",
                  backgroundColor: pressed ? colors.raised : colors.panel,
                })}
              >
                <Text style={{ ...typography.body, color: colors.bright }}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {(
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing["3xl"],
              paddingBottom: insets.bottom + spacing["4xl"],
              paddingTop: spacing.lg,
            }}
          >
            {isRinging ? (
              <>
                <CallAction
                  icon="close"
                  label="Reddet"
                  background={colors.danger}
                  onPress={declineCall}
                />
                {resolvedDirectId ? (
                  <CallAction
                    icon="message"
                    label="Mesaj"
                    background={repliesOpen ? colors.brand : colors.raised}
                    onPress={() => setRepliesOpen((open) => !open)}
                  />
                ) : null}
                <CallAction
                  icon="phone"
                  label="Kabul et"
                  background={colors.success}
                  onPress={() => resolvedDirectId && acceptCall(resolvedDirectId)}
                />
              </>
            ) : (
              <CallAction
                icon="close"
                label="İptal"
                background={colors.danger}
                onPress={hangUp}
              />
            )}
          </View>
        )}
      </View>
    </CallSurface>
  );
}

/**
 * Bağlı çağrı — LiveKit odası. Oda her zaman takılı; tam ekran sahne bir
 * modalda, küçültülünce (WhatsApp gibi) modal kapanır ve uygulamanın
 * üstünde sürüklenebilir mini pencere kalır. Android geri tuşu küçültür.
 */
function ConnectedCall({
  directId,
  onHangUp,
  kind,
}: {
  directId: string;
  onHangUp: () => void;
  kind: "audio" | "video";
}) {
  // Token ve ses oturumu görüşmenin İLK türüyle kurulur: sesliden
  // görüntülüye geçişte (video-upgrade) bunlar değişseydi useVoiceToken
  // yeniden çalışır, oda yeniden kurulur ve görüşme kopardı. Kamera izni ve
  // hoparlöre geçiş o yolda ayrıca yapılıyor.
  const [initialKind] = useState(kind);
  // Sesli arama telefon gibi ahizeden, görüntülü arama hoparlörden başlar;
  // kulaklık bağlıysa ikisinde de o kazanır.
  const { token, error } = useVoiceToken(directId, {
    needsCamera: initialKind === "video",
    defaultRoute: initialKind === "video" ? "speaker" : "earpiece",
    // iOS: ses oturumunu CallKit etkinleştirir/kapatır (features/call/callkit).
    callKitManaged: callKit !== null,
  });
  const minimized = useCall((s) => s.minimized);
  const setMinimized = useCall((s) => s.setMinimized);
  const session = useCall((s) => s.session);

  useKeepAwake();
  // Sesli görüşmede ses ahizedeyken telefon kulağa yaklaşınca ekran kararır
  // (yanlış dokunuş olmasın); hoparlörde, kulaklıkta ve görüntülüde kapalı.
  const route = useCurrentAudioRoute();
  useProximityScreenOff(kind === "audio" && route === "earpiece" && Boolean(token));
  // Arka plana geçince (başka uygulama) görüşme düşmesin: Android ön plan
  // hizmeti mikrofonu/kamerayı ve süreci canlı tutar.
  useOngoingCallService({
    title: session ? displayNameOf(session.peer) : "Görüşme",
    video: kind === "video",
    callId: session?.callId ?? directId,
    onHangUp,
  });

  const minimize = () => setMinimized(true);
  const openChat = () => {
    setMinimized(true);
    router.navigate({ pathname: "/chat/direct/[directId]", params: { directId } });
  };
  const background = kind === "video" ? "#000000" : colors.deep;

  if (error || !token) {
    return (
      <CallSurface onRequestClose={onHangUp}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xl, backgroundColor: background }}>
          {error ? (
            <>
              <Text style={{ ...typography.body, color: colors.danger, textAlign: "center" }}>{error}</Text>
              {/* iOS'ta geri tuşu yok — hata ekranında takılı kalınmasın. */}
              <CallAction icon="close" label="Kapat" background={colors.danger} onPress={onHangUp} />
            </>
          ) : (
            <Text
              style={{
                ...typography.body,
                // Görüntülü aramada zemin siyah; tema rengi açık temada okunmaz.
                color: kind === "video" ? "rgba(255,255,255,0.7)" : colors.muted,
              }}
            >
              Bağlanılıyor…
            </Text>
          )}
        </View>
      </CallSurface>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      audio
      video={kind === "video"}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      <VideoUpgradeBridge />
      <CallPresenceBridge directId={directId} kind={initialKind} />
      <CallKitMuteSync />
      <CallSurface visible={!minimized} onRequestClose={minimize}>
        <View style={{ flex: 1, backgroundColor: background }}>
          {kind === "video" ? (
            <VideoCallStage onHangUp={onHangUp} onMinimize={minimize} onOpenChat={openChat} />
          ) : (
            <CallStage onHangUp={onHangUp} onMinimize={minimize} onOpenChat={openChat} />
          )}
        </View>
      </CallSurface>
      {minimized ? <MiniCall kind={kind} onRestore={() => setMinimized(false)} onHangUp={onHangUp} /> : null}
    </LiveKitRoom>
  );
}

/**
 * DM görüşmesinin ağ geçidi üyeliği ve başka cihaza aktarım.
 *
 * Üyelik: web gibi `voice.join` gönderilir. Gönderilmeseydi görüşme ağ
 * geçidinde yalnızca LiveKit webhook'u üzerinden (cihaz bilgisi olmadan)
 * görünür, kullanıcının masaüstü "Telefonunda görüşüyorsun" diyemez ve
 * görüşmeyi buraya aktarmış masaüstünün kapanan soketi kullanıcıyı
 * görüşmeden silebilirdi (ağ geçidi üyeliği katılan bağlantıya yazıyor).
 * Sesli kanaldayken (iç içe oturum) gönderilmez: ağ geçidi bağlantı başına
 * TEK kanal tutuyor ve DM katılımı sunucu kanalındaki üyeliği düşürürdü.
 *
 * Aktarım: LiveKit kimliği her cihazda aynı ve aynı hesapla başka yerden
 * katılınınca bu bağlantıyı `DUPLICATE_IDENTITY` ile düşürür. Görüşme o
 * zaman YALNIZCA burada kapanır: ayrılış ağ geçidine gitmez (kullanıcı hâlâ
 * görüşmede), zil/CallKit/ön plan hizmeti sessizce durur, iOS sistem
 * arayüzü "başka yerde yanıtlandı" der.
 */
function CallPresenceBridge({ directId, kind }: { directId: string; kind: "audio" | "video" }) {
  const room = useRoomContext();

  useEffect(() => {
    let joined = false;
    let transferred = false;

    const join = () => {
      if (room.state !== ConnectionState.Connected) return;
      if (useVoice.getState().active) return;
      joined = true;
      sendGatewayEvent({ event_type: ClientEvent.VOICE_JOIN, channel_id: directId, call_type: kind });
    };
    const onDisconnected = (reason?: DisconnectReason) => {
      if (reason !== DisconnectReason.DUPLICATE_IDENTITY) return;
      transferred = true;
      setCallKitEndReason("elsewhere");
      stopCallLocally();
      showToast(CALL_TRANSFERRED_MESSAGE);
    };

    room.on(RoomEvent.Connected, join);
    room.on(RoomEvent.Disconnected, onDisconnected);
    // Ağ geçidi yeniden bağlanınca üyelik bu bağlantıya yeniden yazılmalı.
    const releaseOpen = onGatewayOpen(join);
    join();

    return () => {
      room.off(RoomEvent.Connected, join);
      room.off(RoomEvent.Disconnected, onDisconnected);
      releaseOpen();
      if (joined && !transferred) {
        sendGatewayEvent({ event_type: ClientEvent.VOICE_LEAVE, channel_id: directId });
      }
    };
  }, [room, directId, kind]);

  return null;
}

/** Sesliden görüntülüye geçiş isteklerini dinler — küçültülmüşken de takılı. */
function VideoUpgradeBridge() {
  useVideoUpgradeListener();
  return null;
}

/** Sesli arama sahnesi. Görüntülü arama `VideoCallStage`'de. */
function CallStage({
  onHangUp,
  onMinimize,
  onOpenChat,
}: {
  onHangUp: () => void;
  onMinimize: () => void;
  onOpenChat: () => void;
}) {
  const session = useCall((s) => s.session);
  const participants = useParticipants();
  const elapsed = useCallTimer(session?.startedAt);
  const insets = useSafeAreaInsets();
  const reconnecting = useConnectionState() === ConnectionState.Reconnecting;

  const speaking = participants.some((p) => p.isSpeaking && !p.isLocal);
  const upgrade = useCall((s) => s.videoUpgrade);
  const upgradeActions = useVideoUpgradeActions();

  return (
    <View style={{ flex: 1 }}>
      {/* Küçült ve sohbete git — görüşme sürerken uygulamada gezilir. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <IconButton icon="chevron-down" label="Görüşmeyi küçült" onPress={onMinimize} size={40} background={colors.raised} tint={colors.bright} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {/* Sesliden görüntülüye geç (WhatsApp): karşı tarafa istek gider. */}
          <IconButton
            icon="video"
            label={upgrade === "outgoing" ? "Görüntülü görüşme isteği gönderildi" : "Görüntülü görüşmeye geç"}
            onPress={() => void upgradeActions.request()}
            size={40}
            background={upgrade === "outgoing" ? colors.brand : colors.raised}
            tint={upgrade === "outgoing" ? colors.onBrand : colors.bright}
          />
          <IconButton icon="message" label="Mesajlara git" onPress={onOpenChat} size={40} background={colors.raised} tint={colors.bright} />
        </View>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.lg }}>
        <View
          style={{
            padding: 4,
            borderRadius: radii.full,
            borderWidth: 3,
            borderColor: speaking ? colors.success : "transparent",
          }}
        >
          <Avatar
            imageUrl={session?.peer.imageUrl}
            fallbackText={session?.peer.username}
            size={112}
            backgroundColor={colors.deep}
          />
        </View>

        <Text style={{ ...typography.displayLg, color: colors.bright }}>
          {session ? displayNameOf(session.peer) : ""}
        </Text>
        <Text style={{ ...typography.body, color: reconnecting ? "#e0a100" : colors.muted }}>
          {reconnecting ? "Yeniden bağlanılıyor…" : elapsed}
        </Text>
      </View>

      {upgrade ? (
        <VideoUpgradePrompt
          incoming={upgrade === "incoming"}
          peerName={session ? displayNameOf(session.peer) : ""}
          onAccept={() => void upgradeActions.accept()}
          onDecline={upgradeActions.decline}
          onCancel={upgradeActions.cancel}
        />
      ) : null}

      {/* Sessize alma ve ses çıkışı LiveKit odasının İÇİNDE olmak zorunda —
          kontroller odanın kendi durumunu okuyor. */}
      <View style={{ paddingBottom: insets.bottom + spacing["2xl"] }}>
        <CallControls onHangUp={onHangUp} />
      </View>
    </View>
  );
}

/** Görüntülüye geçiş isteği: gelen için Reddet/Kabul et, giden için Vazgeç. */
function VideoUpgradePrompt({
  incoming,
  peerName,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: boolean;
  peerName: string;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        padding: spacing.md,
        gap: spacing.md,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        backgroundColor: colors.panel,
      }}
    >
      <Text style={{ ...typography.body, color: colors.bright, textAlign: "center" }}>
        {incoming
          ? `${peerName} görüntülü görüşmeye geçmek istiyor`
          : "Görüntülü görüşme isteği gönderildi…"}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.md }}>
        {incoming ? (
          <>
            <PromptButton label="Reddet" background={colors.raised} tint={colors.bright} onPress={onDecline} />
            <PromptButton label="Kabul et" background={colors.success} tint="#ffffff" onPress={onAccept} />
          </>
        ) : (
          <PromptButton label="Vazgeç" background={colors.raised} tint={colors.bright} onPress={onCancel} />
        )}
      </View>
    </View>
  );
}

function PromptButton({
  label,
  background,
  tint,
  onPress,
}: {
  label: string;
  background: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        borderRadius: radii.full,
        backgroundColor: background,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ ...typography.bodyStrong, color: tint }}>{label}</Text>
    </Pressable>
  );
}

function CallAction({
  icon,
  label,
  background,
  onPress,
}: {
  icon: Parameters<typeof IconButton>[0]["icon"];
  label: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <IconButton
        icon={icon}
        label={label}
        onPress={onPress}
        size={64}
        background={background}
        tint={colors.bright}
        haptic="medium"
      />
      <Text style={{ ...typography.caption, color: colors.muted }}>{label}</Text>
    </View>
  );
}
