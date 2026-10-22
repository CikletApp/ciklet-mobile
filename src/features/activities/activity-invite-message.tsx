import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";

import { Avatar, Icon, StyledName } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { useChatScope } from "@/features/chat/chat-scope";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { isInActivity, useActivitySession, type ActivityDescriptor } from "@/stores/activity";
import { useTheme } from "@/stores/theme";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { watchActivityRoom } from "./activity-room";
import { joinActivity, launchActivity } from "./launch";

/**
 * ACTIVITY_INVITE mesajı — "Etkinlik Daveti" kartı (web
 * chat/v2/message-activity-invite + activity-invite-card).
 *
 * İçerik `ad|durum` biçiminde: başlatılınca `ad|Katılmak için tıkla`,
 * ağ geçidi "başladı" deyince sunucu `ad|TS:<başlangıç>` yapar (kart süre
 * sayar), aktivite bitince `ad|Aktivite sona erdi…` (kart "Başlat" olur).
 * Katılımcılar sohbetin aktivite odasından (activity-room) gelir.
 *
 * Düğme: içindeysen pasif "Katıldın"; aktifse "Etkinliğe Katıl" (kart
 * basmadan oturuma katılır); bittiyse "Başlat" (yeni davet kartı yazar).
 */

const ENDED_MARKER = "Aktivite sona erdi";
/** Web kartı katılmadan önce noktalı yükleme gösteriyor (1,8 sn). */
const JOIN_DELAY_MS = 1_800;

export function ActivityInviteMessage({ message }: { message: ChatMessagePayload }) {
  const metadata = message.metadata ?? {};
  const [contentName, contentDescription] = message.content.split("|");
  const activityName = String(metadata.activityName || contentName?.trim() || "Aktivite");
  // Sunucunun yazdığı durum (TS:/sona erdi) içerikte; metadata'daki açıklama
  // başlatıldığı andaki tanıtım metni. Web ile aynı öncelik.
  const description = String(
    metadata.activityDescription || contentDescription?.trim() || "Arkadaşlarınla birlikte katıl!"
  );
  const status = contentDescription?.trim() ?? "";
  const activityIcon = typeof metadata.activityIcon === "string" ? metadata.activityIcon : undefined;
  const activityColor = typeof metadata.activityColor === "string" ? metadata.activityColor : undefined;
  const activityUrl = message.fileUrl || (typeof metadata.activityUrl === "string" ? metadata.activityUrl : undefined);
  const activityId = typeof metadata.activityId === "string" ? metadata.activityId : activityUrl;
  const channel = isChannelMessage(message);
  const chatId = channel ? message.channelId : message.directId;
  const scope = useChatScope();
  const serverId = channel ? scope?.serverId || message.member.serverId || null : null;
  const profile = channel ? message.member.profile : message.profile;
  const name = profile.name?.trim() || profile.username;
  const scheme = useTheme((s) => s.scheme);
  const hasRemoteIcon = Boolean(activityIcon?.startsWith("http") || activityIcon?.startsWith("data:image/"));
  const ended = status.includes(ENDED_MARKER) || description.includes(ENDED_MARKER);
  const isActive = Boolean(message.fileUrl) && !ended;
  const accent = safeActivityColor(activityColor) ?? colors.brand;

  const session = useActivitySession((s) => s.session);
  const participants = useActivitySession((s) => s.channelParticipants[chatId]) ?? [];
  const isJoined = isInActivity(session, chatId, { id: activityId, url: activityUrl });
  const [joining, setJoining] = useState(false);

  // Kart görünürken sohbetin aktivite odası izlenir (katılımcı sayısı/avatarlar).
  useEffect(() => watchActivityRoom(chatId), [chatId]);

  const startTs = isActive && status.startsWith("TS:") ? Number.parseInt(status.slice(3), 10) : NaN;
  const elapsed = useElapsed(Number.isFinite(startTs) ? startTs : null);

  const onPress = () => {
    if (isJoined || joining || !activityUrl) return;
    const descriptor: ActivityDescriptor = {
      id: activityId || activityUrl,
      name: activityName,
      url: activityUrl,
      icon: activityIcon || "gamepad",
      color: activityColor,
    };
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      if (isActive) joinActivity(descriptor, { chatId, serverId });
      else void launchActivity(descriptor, { chatId, serverId });
    }, JOIN_DELAY_MS);
  };

  const playerCount = participants.length > 0 ? participants.length : 1;
  const subtitle = elapsed
    ? `${elapsed} süredir oynanıyor`
    : status.startsWith("TS:")
      ? "Oynanıyor"
      : ended && status
        ? status
        : description;

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
        <View
          style={{
            width: 320,
            maxWidth: "100%",
            padding: spacing.md,
            gap: spacing.md,
            borderRadius: radii.bento,
            borderCurve: "continuous",
            backgroundColor: hasRemoteIcon ? colors.deep : accent,
            overflow: "hidden",
            shadowColor: colors.shadow,
            shadowOpacity: 1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          {hasRemoteIcon ? (
            <>
              <Image source={{ uri: activityIcon }} contentFit="cover" style={{ position: "absolute", inset: -64, opacity: 0.9, transform: [{ scale: 1.6 }] }} />
              <BlurView
                intensity={80}
                tint={scheme}
                blurMethod="dimezisBlurViewSdk31Plus"
                style={{ position: "absolute", inset: 0 }}
              />
              <View style={{ position: "absolute", inset: 0, backgroundColor: colors.mediaScrim }} />
            </>
          ) : null}
          <Text style={{ fontSize: 12, lineHeight: 16, ...fw(600), color: colors.mediaMuted }}>
            Etkinlik Daveti
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            {hasRemoteIcon ? (
              <Image source={{ uri: activityIcon }} contentFit="contain" style={{ width: 56, height: 56, borderRadius: radii.bento }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: radii.bento, alignItems: "center", justifyContent: "center", backgroundColor: colors.mediaText }}>
                <Icon name="gamepad" size={28} color={accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, lineHeight: 20, ...fw(800), color: colors.mediaText }} numberOfLines={1}>{activityName}</Text>
              {isActive ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: 2, marginTop: 2 }}>
                  {elapsed ? (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="gamepad" size={14} color={colors.mediaText} />
                        <Text style={{ fontSize: 13, lineHeight: 16, ...fw(600), color: colors.mediaMuted, fontVariant: ["tabular-nums"] }}>{elapsed}</Text>
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
                            style={{ marginLeft: index === 0 ? 0 : -5, borderRadius: radii.full, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.4)" }}
                          >
                            <Avatar profileId={participant.id} imageUrl={participant.imageUrl} fallbackText={participant.username} size={14} />
                          </View>
                        ))}
                        {participants.length > 5 ? (
                          <View style={{ marginLeft: -5, width: 17, height: 17, borderRadius: radii.full, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" }}>
                            <Text style={{ fontSize: 8, ...fw(700), color: colors.mediaText }}>+{participants.length - 5}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <Text style={{ fontSize: 13, lineHeight: 16, ...fw(600), color: colors.mediaMuted }}>{playerCount} Katıldı</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 11, lineHeight: 15, ...fw(500), color: colors.mediaMuted }} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={onPress}
            disabled={isJoined || joining || !activityUrl}
            accessibilityRole="button"
            accessibilityState={{ disabled: isJoined || joining }}
            accessibilityLabel={isJoined ? "Katıldın" : isActive ? "Etkinliğe Katıl" : "Aktiviteyi başlat"}
            style={({ pressed }) => ({
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.md,
              backgroundColor: isJoined ? "rgba(255,255,255,0.2)" : colors.brand,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            {joining ? (
              <ActivityIndicator size="small" color={colors.onBrand} />
            ) : (
              <Text style={{ fontSize: 14, lineHeight: 18, ...fw(700), color: isJoined ? "rgba(255,255,255,0.7)" : colors.onBrand }}>
                {isJoined ? "Katıldın" : isActive ? "Etkinliğe Katıl" : "Başlat"}
              </Text>
            )}
          </Pressable>
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
