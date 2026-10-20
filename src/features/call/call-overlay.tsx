import { Modal, Text, View } from "react-native";
import { router } from "expo-router";
import { LiveKitRoom, useParticipants } from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDirects } from "@/api/hooks";
import { Avatar, IconButton } from "@/components/ui";
import { CallControls } from "@/features/voice/call-controls";
import { useVoiceToken } from "@/features/voice/use-voice-token";
import { LIVEKIT_URL } from "@/lib/livekit";
import { displayNameOf } from "@/lib/format";
import { useCallActions } from "@/realtime/use-call-events";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { MiniCall } from "./mini-call";
import { useCallTimer } from "./use-call-timer";
import { VideoCallStage } from "./video-call-stage";

/**
 * Çağrı katmanı — uygulamanın her yerinden görünür.
 *
 * Üç durum tek bileşende: gelen arama (zil), giden arama (bekleme) ve bağlı
 * çağrı. Tam ekran modal olarak açılır; kullanıcı hangi ekranda olursa olsun
 * gelen aramayı görür. Bu yüzden kök düzene bağlanır, tek tek ekranlara değil.
 */
export function CallOverlay() {
  const session = useCall((s) => s.session);
  const { acceptCall, declineCall, hangUp } = useCallActions();

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

  if (!session) return null;

  const isRinging = session.status === "ringing";
  const isConnected = session.status === "connected";

  // Bağlı çağrı modalın DIŞINDA: LiveKit odası küçültülünce de açık kalmalı
  // (modal kapanınca içi sökülür, oda düşerdi).
  if (isConnected && resolvedDirectId) {
    return <ConnectedCall directId={resolvedDirectId} onHangUp={hangUp} kind={session.kind} />;
  }

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={hangUp}
    >
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
                : "Aranıyor…"}
            </Text>
          </View>
        )}

        {/* Bağlı çağrıda kontroller LiveKit odasının içinde (CallStage) —
            orada mikrofon ve hoparlör durumunu okuyabiliyorlar. Burada
            yalnızca zil ve bekleme durumlarının düğmeleri var. */}
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
    </Modal>
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
  // Sesli arama telefon gibi ahizeden, görüntülü arama hoparlörden başlar;
  // kulaklık bağlıysa ikisinde de o kazanır.
  const { token, error } = useVoiceToken(directId, {
    needsCamera: kind === "video",
    defaultRoute: kind === "video" ? "speaker" : "earpiece",
  });
  const minimized = useCall((s) => s.minimized);
  const setMinimized = useCall((s) => s.setMinimized);

  useKeepAwake();

  const minimize = () => setMinimized(true);
  const openChat = () => {
    setMinimized(true);
    router.navigate({ pathname: "/chat/direct/[directId]", params: { directId } });
  };
  const background = kind === "video" ? "#000000" : colors.deep;

  if (error || !token) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onHangUp}>
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
      </Modal>
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
      <Modal
        visible={!minimized}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={minimize}
      >
        <View style={{ flex: 1, backgroundColor: background }}>
          {kind === "video" ? (
            <VideoCallStage onHangUp={onHangUp} onMinimize={minimize} onOpenChat={openChat} />
          ) : (
            <CallStage onHangUp={onHangUp} onMinimize={minimize} onOpenChat={openChat} />
          )}
        </View>
      </Modal>
      {minimized ? <MiniCall kind={kind} onRestore={() => setMinimized(false)} onHangUp={onHangUp} /> : null}
    </LiveKitRoom>
  );
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

  const speaking = participants.some((p) => p.isSpeaking && !p.isLocal);

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
        <IconButton icon="message" label="Mesajlara git" onPress={onOpenChat} size={40} background={colors.raised} tint={colors.bright} />
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
        <Text style={{ ...typography.body, color: colors.muted }}>{elapsed}</Text>
      </View>

      {/* Sessize alma ve ses çıkışı LiveKit odasının İÇİNDE olmak zorunda —
          kontroller odanın kendi durumunu okuyor. */}
      <View style={{ paddingBottom: insets.bottom + spacing["2xl"] }}>
        <CallControls onHangUp={onHangUp} />
      </View>
    </View>
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
