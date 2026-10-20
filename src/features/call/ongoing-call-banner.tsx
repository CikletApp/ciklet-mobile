import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Icon, Pressable } from "@/components/ui";
import { ClientEvent, ServerEvent } from "@/realtime/events";
import { onGatewayEvent, onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { joinOngoingCall } from "@/realtime/use-call-events";
import { useAuth } from "@/stores/auth";
import { useCall, type CallPeer } from "@/stores/call";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { describeOngoingCall, type OngoingCallParticipant } from "./ongoing-call";

/**
 * Birebir DM'nin üstünde süren görüşme bandı.
 *
 * Kullanıcı görüşmede başka bir cihazındaysa (ör. masaüstünde) "Masaüstü
 * uygulamasında görüşüyorsun · Buraya aktar"; yalnızca karşı taraf
 * görüşmedeyse "Görüşme şu an devam ediyor · Katıl". Bu cihazda bir çağrı
 * (çalan, aranan ya da bağlı) varsa bant çizilmez — çağrı katmanı zaten
 * ekranda.
 *
 * Liste ağ geçidinden: açılışta, her yeniden bağlanmada ve buradaki çağrı
 * bitince `voice.members` sorulur; sonrası `voice.update` yayınları. Kendi
 * diğer cihazının katılımı yalnızca bu bandı değiştirir, zil ya da çağrı
 * ekranı açmaz.
 */
export function OngoingCallBanner({ directId, peer }: { directId: string; peer: CallPeer }) {
  const myId = useAuth((s) => s.profile?.id);
  const hasCall = useCall((s) => s.session !== null);
  const [state, setState] = useState<{ directId: string; participants: OngoingCallParticipant[] }>({
    directId,
    participants: [],
  });

  useEffect(() => {
    const ask = () => sendGatewayEvent({ event_type: ClientEvent.VOICE_MEMBERS, channel_id: directId });
    const releaseUpdate = onGatewayEvent(ServerEvent.VOICE_UPDATE, (frame) => {
      if (frame.channelId !== directId) return;
      setState({ directId, participants: (frame.participants as OngoingCallParticipant[] | undefined) ?? [] });
    });
    const releaseOpen = onGatewayOpen(ask);
    // Buradaki çağrı bitince (`hasCall` düştü) liste yeniden sorulur:
    // görüşme başka cihaza aktarıldıysa kendi kaydımız hâlâ orada.
    if (!hasCall) ask();
    return () => {
      releaseUpdate();
      releaseOpen();
    };
  }, [directId, hasCall]);

  // Başka bir sohbetin listesi bu ekrana taşınmasın (aynı ekran yeniden kullanılırsa).
  const participants = state.directId === directId ? state.participants : [];
  const banner = hasCall ? null : describeOngoingCall(participants, myId);
  if (!banner) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        backgroundColor: colors.panel,
        borderWidth: 1,
        borderColor: colors.success,
      }}
    >
      <Icon name="phone" size={18} color={colors.success} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {banner.title}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={2}>
          {banner.subtitle}
        </Text>
      </View>
      <Pressable
        haptic="medium"
        accessibilityRole="button"
        accessibilityLabel={banner.actionLabel}
        onPress={() => joinOngoingCall(peer, directId, banner.callType)}
        style={({ pressed }) => ({
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.full,
          backgroundColor: colors.success,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ ...typography.bodyStrong, color: "#ffffff" }}>{banner.actionLabel}</Text>
      </Pressable>
    </View>
  );
}
