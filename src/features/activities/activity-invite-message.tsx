import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useActivities } from "@/api/hooks";
import { Avatar, Icon, StyledName, showToast } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { useChatScope } from "@/features/chat/chat-scope";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { useActivitySession } from "@/stores/activity";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { watchActivityRoom } from "./activity-room";
import { INVITE_CARD_ENDED_TEXT, cardSession, cardTapAction, resolveCardActivity } from "./card-state";
import { joinFromInvite, readActivityInviteOrigin } from "./invite";
import { joinActivity, launchActivity, loadActivityCatalog, toDescriptor } from "./launch";

/**
 * ACTIVITY_INVITE mesajı — "Etkinlik Daveti" kartı. Web
 * `chat/v2/message-activity-invite` + `activity-invite-card` ile AYNI
 * durumlar, metinler, düğmeler ve görünüm.
 *
 * Durum sohbetin aktivite ODASINDAN gelir (card-state; web
 * lib/activity/invite-card-state ile aynı kural): kartın uygulamasının
 * canlı oturumu varsa katılımcılar + süre ve "Etkinliğe Katıl"; yoksa
 * "sona erdi" metni ve "Başlat". Kartın kendi metni (`ad|TS:…`) canlılık
 * için okunmaz — eskiden okunuyordu ve başka bir uygulamanın oturumu
 * (Slow Roads) eski Birlikte İzle kartını süre saydırıyordu.
 *
 * Dokununca: süren oturum varsa ona katılır; yoksa taze başlatır (çok
 * oyunculuysa sunucu yeni kart yazar, tek kişilikse yazmaz). Aktivite DAİMA
 * katalogdaki güncel kimlik/adresle açılır — kartın eskimiş kimliği
 * AUTHORIZE'ı "Yetkilendirme kodu alınamadı"ya düşürüyordu.
 */

/** Web kartı katılmadan önce noktalı yükleme gösteriyor (1,8 sn). */
const JOIN_DELAY_MS = 1_800;

/** Web kartındaki metin opaklıkları (`text-theme-bright/70`, `/80`, `/60`). */
const BRIGHT_70 = "rgba(255,255,255,0.7)";
const BRIGHT_80 = "rgba(255,255,255,0.8)";
const BRIGHT_60 = "rgba(255,255,255,0.6)";

export function ActivityInviteMessage({ message }: { message: ChatMessagePayload }) {
  const metadata = message.metadata ?? {};
  const [contentName, contentStatus] = message.content.split("|");
  const activityName = String(metadata.activityName || contentName?.trim() || "Aktivite");
  const activityIcon = typeof metadata.activityIcon === "string" ? metadata.activityIcon : undefined;
  const activityColor = typeof metadata.activityColor === "string" ? metadata.activityColor : undefined;
  const activityUrl = message.fileUrl || (typeof metadata.activityUrl === "string" ? metadata.activityUrl : undefined);
  const activityId = typeof metadata.activityId === "string" ? metadata.activityId : null;
  const channel = isChannelMessage(message);
  const chatId = channel ? message.channelId : message.directId;
  const scope = useChatScope();
  const serverId = channel ? scope?.serverId || message.member.serverId || null : null;
  const profile = channel ? message.member.profile : message.profile;
  const name = profile.name?.trim() || profile.username;
  const hasRemoteIcon = Boolean(activityIcon?.startsWith("http") || activityIcon?.startsWith("data:image/"));
  const accent = safeActivityColor(activityColor) ?? colors.brand;

  // "Arkadaşları Davet Et" kartı: oturum BAŞKA bir sohbette (köken). Sunucu
  // yazar; kullanıcı metadata'sı taklit edemez (web lib/activity/invite-origin).
  const origin = readActivityInviteOrigin(metadata);
  const crossChat = origin !== null;

  const cardRef = { activityId, activityUrl: activityUrl ?? null, activityName };
  const { data: catalog } = useActivities();
  const app = catalog ? resolveCardActivity(cardRef, catalog) : null;
  const room = useActivitySession((s) => s.rooms[chatId]);
  const session = cardSession(
    app ?? (activityId ? { id: activityId, url: activityUrl } : null),
    crossChat ? null : room
  );
  const isActive = session.live;
  const participants = session.participants;
  const current = useActivitySession((s) => s.session);
  const isJoined = origin
    ? Boolean(current && current.chatId === origin.chatId && current.activity.id === activityId)
    : Boolean(current && current.chatId === chatId && current.activity.id === (app?.id ?? activityId));
  const [joining, setJoining] = useState(false);

  // Kart görünürken sohbetin aktivite odası izlenir (canlılık, katılımcılar,
  // süre). Köken kartında bu sohbetin odası kartla ilgisiz.
  useEffect(() => (crossChat ? undefined : watchActivityRoom(chatId)), [chatId, crossChat]);

  const elapsed = useElapsed(isActive ? session.startTs : null);

  // Web: köken kartında tanıtım metni, bitmiş kartta "sona erdi".
  const inviteContext = origin
    ? String(metadata.activityDescription || contentStatus?.trim() || "Arkadaşlarınla birlikte katıl!")
    : null;
  const subtitle = inviteContext ?? INVITE_CARD_ENDED_TEXT;

  const onPress = () => {
    if (isJoined || joining) return;
    if (origin) {
      setJoining(true);
      void joinFromInvite(origin.chatId, profile.id).finally(() => setJoining(false));
      return;
    }
    setJoining(true);
    setTimeout(() => {
      void (async () => {
        try {
          const action = cardTapAction(
            cardRef,
            await loadActivityCatalog(),
            useActivitySession.getState().rooms[chatId]
          );
          if (action.kind === "unavailable") {
            showToast("Bu etkinlik artık kullanılamıyor.", "error");
            return;
          }
          // Kartın yazarı daveti paylaşan kişi (SDK `referrer_id`; web ile aynı).
          if (action.kind === "join") joinActivity(toDescriptor(action.activity), { chatId, serverId, referrerId: profile.id });
          else await launchActivity(action.activity, { chatId, serverId, referrerId: profile.id });
        } finally {
          setJoining(false);
        }
      })();
    }, JOIN_DELAY_MS);
  };

  const buttonLabel = isJoined ? "Katıldın" : isActive || origin ? "Etkinliğe Katıl" : "Başlat";

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <Avatar profileId={profile.id} imageUrl={profile.imageUrl} fallbackText={profile.username} size={40} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <StyledName profileId={profile.id} name={name} textStyle={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1} />
          <Text style={{ fontSize: 10, color: colors.muted }}>{formatTime(message.createdAt)}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/activities", params: { chatId, ...(serverId ? { serverId } : {}) } })}
            accessibilityRole="button"
            accessibilityLabel="Aktiviteler"
            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: colors.bubbleOwn }}
          >
            <Icon name="compass" size={14} color={colors.brand} />
            <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>Aktivite</Text>
          </Pressable>
          <Text style={{ ...typography.caption, color: colors.muted }}>kullanıldı,</Text>
          <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.brand }}>
            <Text style={{ fontSize: 9, lineHeight: 13, ...fw(700), color: colors.onBrand }}>UYG</Text>
          </View>
          <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>• {activityName}</Text>
        </View>
        {/* Kart — web activity-invite-card: sabit 320 genişlik, 16 yarıçap,
            12 iç boşluk; zemin logodan türeyen canlı bulanıklık (ikon yoksa
            accent geçişi). Bulanıklık görselin kendisinde (expo-image
            blurRadius, iOS ve Android): üstüne konan BlurView iOS'ta kartı
            koyu bir camla örtüyor, logonun renklerini söndürüyordu. */}
        <View
          style={{
            width: 320,
            maxWidth: "100%",
            marginTop: 2,
            borderRadius: radii.bento,
            borderCurve: "continuous",
            backgroundColor: hasRemoteIcon ? colors.deep : accent,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          {hasRemoteIcon ? (
            <>
              <Image
                source={{ uri: activityIcon }}
                contentFit="cover"
                blurRadius={40}
                style={{ position: "absolute", inset: 0, opacity: 0.9, transform: [{ scale: 1.6 }] }}
              />
              <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.25)" }} />
            </>
          ) : (
            <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
              <Defs>
                {/* CSS linear-gradient(160deg, accent, accent bb 60%, siyah %33). */}
                <LinearGradient id={`activityInviteAccent-${message.id}`} x1="0.33" y1="0" x2="0.67" y2="1">
                  <Stop offset="0" stopColor={accent} stopOpacity={1} />
                  <Stop offset="0.6" stopColor={accent} stopOpacity={0.73} />
                  <Stop offset="1" stopColor="#000000" stopOpacity={0.33} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#activityInviteAccent-${message.id})`} />
            </Svg>
          )}
          <View style={{ padding: 12, gap: 12 }}>
            <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: BRIGHT_70 }}>Etkinlik Daveti</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {hasRemoteIcon ? (
                <Image source={{ uri: activityIcon }} contentFit="contain" style={{ width: 56, height: 56, borderRadius: radii.bento }} />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: radii.bento, alignItems: "center", justifyContent: "center", backgroundColor: colors.mediaText }}>
                  <Icon name="gamepad" size={28} color={accent} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, lineHeight: 20, ...fw(800), color: colors.mediaText }} numberOfLines={1}>
                  {activityName}
                </Text>
                {isActive && !origin ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, marginTop: 4 }}>
                    {elapsed ? (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Icon name="gamepad" size={14} color={colors.mediaText} />
                          <Text style={{ fontSize: 13, lineHeight: 16, ...fw(600), color: BRIGHT_80, fontVariant: ["tabular-nums"], minWidth: 40 }}>{elapsed}</Text>
                        </View>
                        <Text style={{ fontSize: 13, lineHeight: 16, color: "rgba(255,255,255,0.4)" }}>|</Text>
                      </>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {participants.length > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {participants.slice(0, 5).map((participant, index) => (
                            <View
                              key={participant.id}
                              style={{ marginLeft: index === 0 ? 0 : -6, borderRadius: radii.full, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.4)" }}
                            >
                              <Avatar profileId={participant.id} imageUrl={participant.imageUrl} fallbackText={participant.username} size={14} />
                            </View>
                          ))}
                          {participants.length > 5 ? (
                            <View style={{ marginLeft: -6, width: 17, height: 17, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.4)" }}>
                              <Text style={{ fontSize: 8, ...fw(700), color: colors.mediaText }}>+{participants.length - 5}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      <Text style={{ fontSize: 13, lineHeight: 16, ...fw(600), color: BRIGHT_80 }}>{participants.length} Katıldı</Text>
                    </View>
                  </View>
                ) : (
                  <Text
                    style={{ fontSize: 11, lineHeight: 15, marginTop: 4, ...fw(500), color: inviteContext ? BRIGHT_70 : BRIGHT_60 }}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={onPress}
              disabled={isJoined || joining || (!activityUrl && !activityId && !origin)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isJoined || joining }}
              accessibilityLabel={buttonLabel}
              style={({ pressed }) => ({
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: isJoined ? "rgba(255,255,255,0.2)" : colors.brand,
                opacity: pressed ? 0.88 : 1,
                transform: [{ scale: pressed && !isJoined ? 0.98 : 1 }],
              })}
            >
              {joining ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Text style={{ fontSize: 14, lineHeight: 18, ...fw(700), color: isJoined ? BRIGHT_70 : colors.onBrand }}>{buttonLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/** `mm:ss` biçiminde geçen süre; başlangıç yoksa null. Saniyede bir güncellenir. */
function useElapsed(startTs: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startTs === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [startTs]);
  if (startTs === null) return null;
  const total = Math.floor(Math.max(0, now - startTs) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function safeActivityColor(value: string | undefined): string | undefined {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
}
