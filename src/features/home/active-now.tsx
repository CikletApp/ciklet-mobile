import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, Icon, Pressable } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { usePresenceStore } from "@/stores/presence";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const ACTIVE_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.IDLE,
  PresenceStatus.DND,
];
const CARD_WIDTH = 210;

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();
  const themeId = useTheme((s) => s.themeId);
  const active = useMemo(
    () => accepted
      .map((friend) => ({ friend, entry: entries[friend.profile.id] }))
      .filter(({ entry }) => ACTIVE_STATUSES.includes(entry?.status ?? PresenceStatus.OFFLINE)),
    [accepted, entries]
  );
  if (active.length === 0) return null;

  return (
    <View style={{ paddingBottom: spacing.md }}>
      <Text style={{ ...typography.overline, color: colors.muted, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        ŞİMDİ AKTİF — {active.length}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
        {active.map(({ friend, entry }) => {
          const activity = entry?.activity;
          const artwork = activity?.appIconUrl || activity?.largeImageUrl;
          const label = activity ? `${activity.name} ${activity.type === "LISTENING" ? "dinliyor" : activity.type === "WATCHING" ? "izliyor" : "kullanıyor"}` : "Çevrimiçi";
          return (
            <Pressable
              key={friend.id}
              onPress={() => openDirect.mutate(friend.profile.id, { onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`) })}
              haptic="light"
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={`${displayNameOf(friend.profile)} ile sohbet`}
              style={({ pressed }) => ({
                width: CARD_WIDTH,
                minHeight: activity ? 124 : 76,
                padding: spacing.sm,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.bentoBorder,
                backgroundColor: colors.panel,
                overflow: "hidden",
                opacity: pressed ? 0.82 : 1,
              })}
            >
              {artwork ? <Image source={{ uri: artwork }} contentFit="cover" style={{ position: "absolute", inset: -16, opacity: 0.14 }} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Avatar profileId={friend.profile.id} imageUrl={friend.profile.imageUrl} fallbackText={friend.profile.username} size={38} showPresence backgroundColor={colors.panel} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{displayNameOf(friend.profile)}</Text>
                  <Text style={{ fontSize: 11, lineHeight: 14, color: activity ? colors.accent : colors.success }} numberOfLines={1}>{label}</Text>
                </View>
              </View>
              {activity ? (
                <View style={{ marginTop: spacing.sm, height: 56, borderRadius: radii.md, overflow: "hidden" }}>
                  <BlurView intensity={48} tint={themeId === "light" ? "light" : "dark"} style={{ position: "absolute", inset: 0 }} />
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }}>
                    {artwork ? (
                      <Image source={{ uri: artwork }} contentFit="cover" style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.raised }} />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="compass" size={20} color={colors.accent} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.bright }} numberOfLines={1}>{activity.details || activity.name}</Text>
                      <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.state || activity.name}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
