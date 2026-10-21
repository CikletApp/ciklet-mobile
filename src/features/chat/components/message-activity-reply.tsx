import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";

import { Icon, type IconName } from "@/components/ui";
import {
  activityRefHeadline,
  activityRefType,
  activityReplyLabel,
  activityVerbLabel,
  type ActivityRef,
} from "@/lib/activity-reply";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";

/**
 * ACTIVITY_REPLY mesajındaki etkinlik kartı (web chat/v2/message-activity-reply):
 * kişinin hangi etkinliğine tepki/yanıt verildiği — görsel, "Ad · Oynuyor",
 * başlık ve alt satır. Tepki emojisi ya da yanıt metni mesajın kendi içeriği
 * olarak kartın üstünde normal balon metniyle çizilir. Özet depodan geldiği
 * için yeniden doğrulanmış hâliyle alınır (lib/activity-reply →
 * readActivityReply); görsel yalnızca https.
 */
export function MessageActivityReply({
  activity,
  content,
  isMine,
}: {
  activity: ActivityRef;
  content: string | null | undefined;
  isMine: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const { title, subtitle } = activityRefHeadline(activity);
  const verb = activityVerbLabel(activity);
  const icon = activityTypeIcon(activityRefType(activity));
  const image = activity.largeImageUrl && !failed ? activity.largeImageUrl : null;

  return (
    // Tepki tek emoji: balon dar kalmasın, kart okunur genişlikte dursun.
    <View style={{ marginTop: 2, gap: 4, minWidth: 220 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="reply" size={11} color={colors.muted} />
        <Text style={{ fontSize: 11, lineHeight: 15, ...fw(600), color: colors.muted }} numberOfLines={1}>
          {activityReplyLabel(content)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minWidth: 0,
          padding: spacing.sm,
          borderRadius: radii.md,
          borderCurve: "continuous",
          borderLeftWidth: 3,
          borderLeftColor: colors.brand,
          backgroundColor: isMine ? colors.bubbleOther : colors.deep,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.sm,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.raised,
          }}
        >
          {image ? (
            <Image
              source={{ uri: image }}
              contentFit="cover"
              onError={() => setFailed(true)}
              style={{ width: "100%", height: "100%", opacity: activity.isLive ? 1 : 0.85 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon name={icon} size={22} color={colors.muted} />
          )}
        </View>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name={icon} size={11} color={colors.brand} />
            <Text
              style={{ flexShrink: 1, fontSize: 10, lineHeight: 14, letterSpacing: 0.8, ...fw(800), color: colors.muted, textTransform: "uppercase" }}
              numberOfLines={1}
            >
              {activity.name} · {verb}
            </Text>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 18, ...fw(700), color: colors.bright }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 12, lineHeight: 16, color: colors.muted }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Web activity-type-icon haritasının mobil karşılığı (kendi ikon setimizden). */
export function activityTypeIcon(type: string): IconName {
  switch (type) {
    case "LISTENING":
      return "headphones";
    case "WATCHING":
      return "play";
    case "STREAMING":
      return "video";
    case "WORKING":
    case "CREATING":
      return "monitor";
    case "COMPETING":
      return "trending-up";
    default:
      return "gamepad";
  }
}
