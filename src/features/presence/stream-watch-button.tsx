import { Linking, Text } from "react-native";

import { Icon, Pressable } from "@/components/ui";
import { streamWatchUrl } from "@/lib/activity-broadcast";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { radii, spacing } from "@/theme/tokens";

/** Discord'un yayın moru (ciklet-web STREAMING_PURPLE ile aynı). */
const STREAMING_PURPLE = "#593695";

/**
 * "Yayını İzle" — Twitch/Kick kanalını telefonun tarayıcısında (ya da
 * yüklüyse platformun uygulamasında) açar. Adres izin listesinden geçmezse
 * ya da bağlı yayın yoksa (yalnızca OBS + oyun) hiçbir şey çizilmez.
 *
 * Kartın kendisi dokununca yanıt sayfasını açıyor; bu düğme iç içe
 * Pressable — dokunuşu kendisi alır, karta geçmez.
 */
export function StreamWatchButton({
  activity,
  compact = false,
}: {
  activity: { type?: string | number | null; url?: string | null } | null | undefined;
  compact?: boolean;
}) {
  const t = useT();
  const url = streamWatchUrl(activity);
  if (!url) return null;
  const label = t("activity.broadcast.watch");
  return (
    <Pressable
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      haptic="light"
      noHitSlop
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        marginTop: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: compact ? 5 : 8,
        borderRadius: radii.md,
        borderCurve: "continuous",
        backgroundColor: STREAMING_PURPLE,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name="arrow-up-right" size={compact ? 13 : 15} color="#ffffff" />
      <Text style={{ fontSize: compact ? 12 : 13, lineHeight: compact ? 16 : 18, ...fw(700), color: "#ffffff" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
