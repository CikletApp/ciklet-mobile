import { useEffect, useState } from "react";
import { Animated, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  isTrackReference,
  LiveKitRoom,
  useParticipants,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Track } from "livekit-client";

import { useDirects } from "@/api/hooks";
import { Avatar, IconButton } from "@/components/ui";
import { CallBackdrop } from "@/features/call/call-backdrop";
import { CallControls } from "@/features/voice/call-controls";
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
 *
 * Yerleşim bilerek sistem telefon uygulamalarının düzenini izler: bulanık
 * kişi fotoğrafı zeminde, büyük avatar ve ad üstte, eylemler ekranın EN
 * ALTINDA ve birbirinden uzak. Reddet ile Kabul'ü yan yana ve küçük çizmek,
 * telefonu cebinden çıkarırken yanlış düğmeye basmayı kolaylaştırır.
 */
export function CallOverlay() {
  const session = useCall((s) => s.session);
  const { acceptCall, declineCall, hangUp } = useCallActions();

  /**
   * Gelen aramada LiveKit oda adını çözer.
   *
   * Sunucu artık `incoming_call` ve `pending_call_invites` yüklerinde
   * `directChannelId` gönderiyor; DM listesinden tahmin yolu yalnızca eski
   * sunucular için yedek olarak duruyor (o yolda, karşı tarafla hiç sohbeti
   * olmayan kullanıcı aramayı bağlayamaz).
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
        {isConnected && !resolvedDirectId ? (
          /*
            Kabul edildi ama LiveKit oda adı çözülemedi.
            Sunucu artık `directChannelId` gönderiyor; buraya ancak eski bir
            sunucuya karşı ve taraflar arasında hiç sohbet yokken düşülür.
            Sessizce "Aranıyor…" ekranında asılı kalmak yerine ne olduğunu
            söylemek gerekiyor — kullanıcı aksi halde karşı tarafın
            duymadığını sanır.
          */
          <>
            <CallBackdrop imageUrl={session.peer.imageUrl} />
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: spacing.xl,
                  gap: spacing.xl,
                }}
              >
                <Text
                  style={{ ...typography.body, color: colors.danger, textAlign: "center" }}
                >
                  Görüşme odası bulunamadı. {displayNameOf(session.peer)} ile bir sohbet
                  açtıktan sonra tekrar dene.
                </Text>
                <CallAction
                  icon="close"
                  label="Kapat"
                  background={colors.danger}
                  onPress={hangUp}
                />
              </View>
            </SafeAreaView>
          </>
        ) : isConnected && resolvedDirectId ? (
          <ConnectedCall
            directId={resolvedDirectId}
            onHangUp={hangUp}
            kind={session.kind}
            peerImageUrl={session.peer.imageUrl}
          />
        ) : (
          <>
            <CallBackdrop imageUrl={session.peer.imageUrl} />
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: spacing.xl,
                  gap: spacing.lg,
                }}
              >
                <Text style={{ ...typography.overline, color: colors.mediaMuted }}>
                  {session.kind === "video" ? "CİKLET GÖRÜNTÜLÜ ARAMA" : "CİKLET SESLİ ARAMA"}
                </Text>

                <PulsingRing active={isRinging}>
                  <Avatar
                    imageUrl={session.peer.imageUrl}
                    fallbackText={session.peer.username}
                    size={132}
                    backgroundColor={colors.deep}
                  />
                </PulsingRing>

                <Text
                  style={{ ...typography.displayLg, color: colors.mediaText, textAlign: "center" }}
                >
                  {displayNameOf(session.peer)}
                </Text>
                <Text style={{ ...typography.body, color: colors.mediaMuted }}>
                  {isRinging
                    ? session.kind === "video"
                      ? "Görüntülü arıyor…"
                      : "Sesli arıyor…"
                    : "Aranıyor…"}
                </Text>
              </View>

              {/* Bağlı çağrıda kontroller LiveKit odasının içinde (CallStage) —
                  orada mikrofon ve hoparlör durumunu okuyabiliyorlar. Burada
                  yalnızca zil ve bekleme durumlarının düğmeleri var. */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: isRinging ? "space-evenly" : "center",
                  paddingHorizontal: spacing["3xl"],
                  paddingBottom: spacing["3xl"],
                  paddingTop: spacing.lg,
                }}
              >
                {isRinging ? (
                  <>
                    <CallAction
                      icon="close"
                      label="Reddet"
                      background={colors.danger}
                      onPress={() => void declineCall()}
                    />
                    <CallAction
                      icon="phone"
                      label="Kabul et"
                      background={colors.success}
                      onPress={() => void acceptCall(resolvedDirectId)}
                      // Kabul düğmesi nabız gibi atar: ekrana bakan kullanıcı
                      // hangi düğmenin "aç" olduğunu okumadan görür.
                      pulse
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
            </SafeAreaView>
          </>
        )}
      </View>
    </Modal>
  );
}

/** Bağlı çağrı — LiveKit odası. */
function ConnectedCall({
  directId,
  onHangUp,
  kind,
  peerImageUrl,
}: {
  directId: string;
  onHangUp: () => void;
  kind: "audio" | "video";
  peerImageUrl: string | null;
}) {
  const { token, error } = useVoiceToken(directId, kind === "video");

  useKeepAwake();

  if (error) {
    return (
      <>
        <CallBackdrop imageUrl={peerImageUrl} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.xl }}
          >
            <Text style={{ ...typography.body, color: colors.danger, textAlign: "center" }}>
              {error}
            </Text>
            <CallAction
              icon="close"
              label="Kapat"
              background={colors.danger}
              onPress={onHangUp}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <CallBackdrop imageUrl={peerImageUrl} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...typography.body, color: colors.mediaMuted }}>Bağlanılıyor…</Text>
          </View>
        </SafeAreaView>
      </>
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
      <CallStage onHangUp={onHangUp} peerImageUrl={peerImageUrl} />
    </LiveKitRoom>
  );
}

function CallStage({
  onHangUp,
  peerImageUrl,
}: {
  onHangUp: () => void;
  peerImageUrl: string | null;
}) {
  const session = useCall((s) => s.session);
  const participants = useParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]).filter(isTrackReference);
  const elapsed = useCallTimer(session?.startedAt);

  const speaking = participants.some((p) => p.isSpeaking && !p.isLocal);
  const isVideo = session?.kind === "video" && cameraTracks.length > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Görüntülü çağrıda kamera zaten tüm ekranı dolduruyor; bulanık
          fotoğrafı altına çizmek boşuna GPU işi. */}
      {isVideo ? null : <CallBackdrop imageUrl={peerImageUrl} />}

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.lg,
            padding: spacing.lg,
          }}
        >
          {isVideo ? (
            <View
              style={{
                flex: 1,
                alignSelf: "stretch",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
                justifyContent: "center",
                alignContent: "center",
              }}
            >
              {cameraTracks.map((trackRef) => (
                <View
                  key={`${trackRef.participant.identity}-${trackRef.source}`}
                  style={{
                    width: cameraTracks.length === 1 ? "100%" : "48%",
                    aspectRatio: cameraTracks.length === 1 ? 3 / 4 : 1,
                    maxHeight: "100%",
                    borderRadius: radii.xl,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    backgroundColor: colors.panel,
                    borderWidth: trackRef.participant.isSpeaking ? 2 : 0,
                    borderColor: colors.success,
                  }}
                >
                  <VideoTrack
                    trackRef={trackRef}
                    style={{ flex: 1 }}
                    objectFit="cover"
                    mirror={trackRef.participant.isLocal}
                  />
                </View>
              ))}
            </View>
          ) : (
            <>
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
                  size={132}
                  backgroundColor={colors.deep}
                />
              </View>

              <Text style={{ ...typography.displayLg, color: colors.mediaText }}>
                {session ? displayNameOf(session.peer) : ""}
              </Text>
              <Text style={{ ...typography.body, color: colors.mediaMuted }}>{elapsed}</Text>
            </>
          )}
        </View>

        {/* Sessize alma ve hoparlör LiveKit odasının İÇİNDE olmak zorunda —
            kontroller odanın kendi durumunu okuyor. */}
        <View style={{ paddingBottom: spacing["2xl"] }}>
          <CallControls onHangUp={onHangUp} showCamera={session?.kind === "video"} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function CallAction({
  icon,
  label,
  background,
  onPress,
  pulse,
}: {
  icon: Parameters<typeof IconButton>[0]["icon"];
  label: string;
  background: string;
  onPress: () => void;
  pulse?: boolean;
}) {
  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <PulsingRing active={Boolean(pulse)} scaleTo={1.12}>
        <IconButton
          icon={icon}
          label={label}
          onPress={onPress}
          size={72}
          background={background}
          tint={colors.mediaText}
          haptic="medium"
        />
      </PulsingRing>
      <Text style={{ ...typography.caption, color: colors.mediaMuted }}>{label}</Text>
    </View>
  );
}

/**
 * Nabız halkası — zil çalarken avatarın ve kabul düğmesinin etrafında.
 *
 * `useNativeDriver` şart: JS iş parçacığı çağrı kurulumu sırasında (token
 * isteği, LiveKit el sıkışması) meşgul ve animasyon orada takılırsa
 * ekran donmuş gibi görünür.
 */
function PulsingRing({
  active,
  children,
  scaleTo = 1.06,
}: {
  active: boolean;
  children: React.ReactNode;
  scaleTo?: number;
}) {
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: scaleTo, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale, scaleTo]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

/**
 * Görüşme süresi — saniyede bir tazelenir.
 *
 * Etiket state'te TUTULMUYOR, render sırasında hesaplanıyor: state olsaydı
 * ilk değeri effect içinde yazmak gerekirdi ve süre bir saniye boyunca
 * "00:00" görünürdü. Zamanlayıcı yalnızca yeniden render tetikler.
 */
function useCallTimer(startedAt: number | undefined): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return startedAt ? formatElapsed(startedAt) : "00:00";
}
