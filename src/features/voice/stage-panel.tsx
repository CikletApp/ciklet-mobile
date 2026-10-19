import { useEffect, useReducer, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalParticipant, useRemoteParticipants, useRoomContext } from "@livekit/react-native";
import { RoomEvent, type Participant } from "livekit-client";

import { ApiError } from "@/api/client";
import { useStageAction, type StageAction } from "@/api/hooks";
import { Avatar, Button, Icon, Pressable, showToast } from "@/components/ui";
import { useVoice } from "@/stores/voice";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sahne paneli — web `components/stage/stage-panel` karşılığı.
 *
 * Durum LiveKit'te yaşar: konuşmacı = sunucunun verdiği yayın izni
 * (`permissions.canPublish`, taklit edilemez), el kaldırma = sunucunun
 * katılımcıya yazdığı `stageHand` özniteliği (zaman damgası). Dinleyici el kaldırır; moderatör "Sahneye
 * al" der ya da kendisi "Sahneye çık"ar; konuşmacı "Dinleyicilere geç"
 * ile iner. Konuşmacı yapılınca mikrofon kapalı başlar.
 */
export const STAGE_HAND_ATTRIBUTE = "stageHand";

const isSpeaker = (p: Participant) => p.permissions?.canPublish === true;
const handRaised = (p: Participant) => Boolean(p.attributes?.[STAGE_HAND_ATTRIBUTE]);

export function StagePanel({
  channelId,
  topic,
  moderator,
}: {
  channelId: string;
  topic: string | null | undefined;
  moderator: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const gatewayList = useVoice((s) => s.participants);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState(true);
  const stage = useStageAction(channelId);
  const wasSpeaker = useRef(false);

  // İzin ve öznitelik değişimleri listeyi yeniden çizer.
  useEffect(() => {
    const bump = () => rerender();
    room.on(RoomEvent.ParticipantPermissionsChanged, bump);
    room.on(RoomEvent.ParticipantAttributesChanged, bump);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, bump);
      room.off(RoomEvent.ParticipantAttributesChanged, bump);
    };
  }, [room]);

  const meSpeaker = localParticipant ? isSpeaker(localParticipant) : false;
  const meHand = localParticipant ? handRaised(localParticipant) : false;
  const permissionsKnown = Boolean(localParticipant?.permissions);

  // Konuşmacı yapılınca bildirilir (mikrofon kapalı başlar); dinleyici
  // mikrofonu açmaya çalışırsa geri kapatılır — yayın izni yok.
  useEffect(() => {
    if (meSpeaker && !wasSpeaker.current) showToast("Artık konuşmacısın. Konuşmak için mikrofonunu aç.");
    wasSpeaker.current = meSpeaker;
  }, [meSpeaker]);
  useEffect(() => {
    if (!meSpeaker && isMicrophoneEnabled && permissionsKnown) {
      void localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
      showToast("Sahnede konuşmak için el kaldır.");
    }
  }, [meSpeaker, isMicrophoneEnabled, permissionsKnown, localParticipant]);

  const act = (action: StageAction, identity?: string) =>
    stage.mutate(
      { action, identity },
      {
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : "Sahne işlemi yapılamadı.", "error"),
      }
    );

  // El kaldırma sunucudan: token katılımcıya öznitelik yazma izni vermiyor
  // (kimlik taklidi), sunucu `stageHand`'i zaman damgasıyla yazar.
  const toggleHand = () =>
    stage.mutate(
      { action: meHand ? "lower" : "raise" },
      {
        onError: (error) =>
          showToast(
            error instanceof ApiError ? error.message : meHand ? "El indirilemedi." : "El kaldırılamadı.",
            "error"
          ),
      }
    );

  const everyone: Participant[] = [...(localParticipant ? [localParticipant] : []), ...remotes];
  const speakers = everyone.filter(isSpeaker);
  const hands = everyone
    .filter((p) => !isSpeaker(p) && handRaised(p))
    .sort((a, b) => Number(a.attributes?.[STAGE_HAND_ATTRIBUTE]) - Number(b.attributes?.[STAGE_HAND_ATTRIBUTE]));
  const listeners = everyone.length - speakers.length;
  const profileOf = (p: Participant) => gatewayList.find((entry) => entry.username === p.identity);

  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setOpen((value) => !value)}
        noHitSlop
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}
      >
        <Icon name="mic" size={18} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {topic?.trim() || "Sahne"}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {speakers.length} konuşmacı · {listeners} dinleyici{hands.length ? ` · ${hands.length} el kalktı` : ""}
          </Text>
        </View>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={16} color={colors.muted} />
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm, gap: spacing.xs }}>
          <Text style={{ ...typography.overline, color: colors.muted, paddingHorizontal: spacing.sm }}>KONUŞMACILAR</Text>
          <ScrollView style={{ maxHeight: 160 }}>
            {speakers.length === 0 ? (
              <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.sm }}>Sahnede henüz kimse yok.</Text>
            ) : (
              speakers.map((p) => (
                <PersonRow key={p.identity} participant={p} profile={profileOf(p)} speaking={p.isSpeaking}>
                  <Icon name={p.isMicrophoneEnabled ? "mic" : "mic-off"} size={15} color={p.isMicrophoneEnabled ? colors.success : colors.muted} />
                  {moderator && p.identity !== localParticipant?.identity ? (
                    <Button label="İndir" variant="ghost" onPress={() => act("demote", p.identity)} />
                  ) : null}
                </PersonRow>
              ))
            )}
          </ScrollView>

          {moderator && hands.length > 0 ? (
            <>
              <Text style={{ ...typography.overline, color: colors.muted, paddingHorizontal: spacing.sm }}>SÖZ İSTEYENLER</Text>
              <ScrollView style={{ maxHeight: 140 }}>
                {hands.map((p) => (
                  <PersonRow key={p.identity} participant={p} profile={profileOf(p)}>
                    <Button label="Sahneye al" variant="secondary" onPress={() => act("promote", p.identity)} />
                  </PersonRow>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={{ padding: spacing.xs }}>
            {meSpeaker ? (
              <Button label="Dinleyicilere geç" variant="secondary" fullWidth loading={stage.isPending} onPress={() => act("listen")} />
            ) : moderator ? (
              <Button label="Sahneye çık" fullWidth loading={stage.isPending} onPress={() => act("speak")} />
            ) : (
              <Button
                label={meHand ? "Eli indir" : "El kaldır"}
                icon={meHand ? "close" : "user-plus"}
                variant={meHand ? "secondary" : "primary"}
                fullWidth
                loading={stage.isPending}
                onPress={toggleHand}
              />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PersonRow({
  participant,
  profile,
  speaking,
  children,
}: {
  participant: Participant;
  profile?: { id: string; imageUrl: string | null; name: string | null; username: string };
  speaking?: boolean;
  children?: React.ReactNode;
}) {
  const label = profile?.name?.trim() || participant.name || participant.identity;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 }}>
      <View style={{ borderRadius: radii.full, borderWidth: 2, borderColor: speaking ? colors.success : "transparent" }}>
        <Avatar profileId={profile?.id} imageUrl={profile?.imageUrl} fallbackText={participant.identity} size={28} />
      </View>
      <Text style={{ ...typography.body, ...fw(600), color: colors.bright, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}
