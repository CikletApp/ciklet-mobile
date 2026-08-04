import { useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import { LiveKitRoom, useLocalParticipant, useParticipants } from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";

import { useDirects } from "@/api/hooks";
import { Avatar, IconButton } from "@/components/ui";
import { useVoiceToken } from "@/features/voice/use-voice-token";
import { LIVEKIT_URL } from "@/lib/livekit";
import { displayNameOf, formatElapsed } from "@/lib/format";
import { useCallActions } from "@/realtime/use-call-events";
import { useCall } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={hangUp}>
      <View style={{ flex: 1, backgroundColor: colors.deep }}>
        {isConnected && resolvedDirectId ? (
          <ConnectedCall directId={resolvedDirectId} />
        ) : (
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

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing["3xl"],
            paddingBottom: spacing["4xl"],
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
              label={isConnected ? "Görüşmeyi bitir" : "İptal"}
              background={colors.danger}
              onPress={hangUp}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Bağlı çağrı — LiveKit odası. */
function ConnectedCall({ directId }: { directId: string }) {
  const { token, error } = useVoiceToken(directId);

  useKeepAwake();

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Text style={{ ...typography.body, color: colors.danger, textAlign: "center" }}>
          {error}
        </Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ ...typography.body, color: colors.muted }}>Bağlanılıyor…</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect
      audio
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      <CallStage />
    </LiveKitRoom>
  );
}

function CallStage() {
  const session = useCall((s) => s.session);
  const muted = useCall((s) => s.muted);
  const setMuted = useCall((s) => s.setMuted);
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const elapsed = useCallTimer(session?.startedAt);

  const speaking = participants.some((p) => p.isSpeaking && !p.isLocal);

  const toggleMute = async () => {
    if (!localParticipant) return;
    const next = !muted;
    await localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
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

      <IconButton
        icon={muted ? "bell-off" : "volume"}
        label={muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
        onPress={toggleMute}
        size={56}
        background={muted ? colors.danger : colors.panel}
        tint={muted ? colors.bright : colors.text}
      />
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

/** Görüşme süresi — saniyede bir tazelenir. */
function useCallTimer(startedAt: number | undefined): string {
  const [label, setLabel] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    setLabel(formatElapsed(startedAt));
    const timer = setInterval(() => setLabel(formatElapsed(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return label;
}
