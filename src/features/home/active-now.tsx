import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, Icon, Pressable } from "@/components/ui";
import { resolveMediaUrl } from "@/lib/config";
import { displayNameOf } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { usePresenceStore } from "@/stores/presence";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const ACTIVE_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.IDLE,
  PresenceStatus.DND,
];
const ACTIVITY_CARD_WIDTH = 210;
const PRESENCE_CARD_SIZE = 96;

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();
  const themeId = useTheme((s) => s.themeId);
  const active = useMemo(
    () => accepted
      .map((friend) => ({ friend, entry: entries[friend.profile.id] }))
      .filter(({ friend, entry }) =>
        !isOfficialProfile(friend.profile) &&
        ACTIVE_STATUSES.includes(entry?.status ?? PresenceStatus.OFFLINE)
      ),
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
          // Kapaklar göreli yol olarak gelebilir (/api/presence/covers/…).
          const largeImage = resolveMediaUrl(activity?.largeImageUrl);
          const smallImage = resolveMediaUrl(activity?.smallImageUrl);
          const activityLogo = resolveMediaUrl(activity?.appIconUrl) || largeImage;
          const backdrop = largeImage || activityLogo;
          const label = activity
            ? `${activity.name} ${activity.type === "LISTENING" ? "dinliyor" : activity.type === "WATCHING" ? "izliyor" : activity.type === "PLAYING" ? "oynuyor" : "kullanıyor"}`
            : "Çevrimiçi";

          if (!activity) {
            return (
              <Pressable
                key={friend.id}
                onPress={() => openDirect.mutate(friend.profile.id, { onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`) })}
                haptic="light"
                noHitSlop
                accessibilityRole="button"
                accessibilityLabel={`${displayNameOf(friend.profile)}, ${label}`}
                style={({ pressed }) => ({
                  width: PRESENCE_CARD_SIZE,
                  height: PRESENCE_CARD_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.bentoBorder,
                  backgroundColor: pressed ? colors.raised : colors.panel,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Avatar
                  profileId={friend.profile.id}
                  imageUrl={friend.profile.imageUrl}
                  fallbackText={friend.profile.username}
                  size={58}
                  showPresence
                  presenceSize={15}
                  backgroundColor={colors.panel}
                />
              </Pressable>
            );
          }

          return (
            <Pressable
              key={friend.id}
              onPress={() => openDirect.mutate(friend.profile.id, { onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`) })}
              haptic="light"
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={`${displayNameOf(friend.profile)} ile sohbet`}
              style={({ pressed }) => ({
                width: ACTIVITY_CARD_WIDTH,
                minHeight: 124,
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
              {backdrop ? <Image source={{ uri: backdrop }} contentFit="cover" style={{ position: "absolute", inset: -24, opacity: 0.18 }} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Avatar profileId={friend.profile.id} imageUrl={friend.profile.imageUrl} fallbackText={friend.profile.username} size={38} showPresence backgroundColor={colors.panel} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{displayNameOf(friend.profile)}</Text>
                  <Text style={{ fontSize: 11, lineHeight: 14, color: activity ? colors.accent : colors.success }} numberOfLines={1}>{label}</Text>
                </View>
              </View>
              <View style={{ marginTop: spacing.sm, height: 58, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.deep }}>
                {backdrop ? (
                  <Image source={{ uri: backdrop }} contentFit="cover" style={{ position: "absolute", inset: -18, opacity: 0.42 }} />
                ) : null}
                <BlurView
                  intensity={48}
                  tint={themeId === "light" ? "light" : "dark"}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  style={{ position: "absolute", inset: 0 }}
                />
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm }}>
                  {activityLogo ? (
                    <View>
                      <Image source={{ uri: activityLogo }} contentFit="cover" style={{ width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.raised }} />
                      {smallImage ? (
                        <Image
                          source={{ uri: smallImage }}
                          contentFit="cover"
                          style={{ position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: radii.full, borderWidth: 2, borderColor: colors.panel, backgroundColor: colors.raised }}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="compass" size={20} color={colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.bright }} numberOfLines={1}>{activity.details || activity.name}</Text>
                    <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.state || activity.name}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
