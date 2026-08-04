import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, Pressable } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { usePresenceStore } from "@/stores/presence";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * "Şimdi Aktif" — mesaj listesinin üstünde yatay çevrimiçi arkadaş şeridi.
 *
 * Web'deki `ActiveNow` bileşeni arkadaşı listeye almak için hem çevrimiçi
 * OLMASINI hem de bir zengin durum (oyun/müzik) taşımasını şart koşuyor.
 * Mobilde bu ölçüt neredeyse her zaman boş bir liste üretirdi: zengin durum
 * masaüstü istemcisinden geliyor. Bu yüzden burada ölçüt yalnızca
 * ÇEVRİMİÇİ olmak (ONLINE / IDLE / DND) — kullanışlı olan da bu.
 *
 * Kimse çevrimiçi değilse şerit hiç çizilmez; boş bir başlık yer kaplamamalı.
 */
const ACTIVE_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.IDLE,
  PresenceStatus.DND,
];

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();

  const active = useMemo(
    () =>
      accepted.filter((friend) =>
        ACTIVE_STATUSES.includes(
          entries[friend.profile.id]?.status ?? PresenceStatus.OFFLINE
        )
      ),
    [accepted, entries]
  );

  if (active.length === 0) return null;

  return (
    <View style={{ paddingBottom: spacing.sm }}>
      <Text
        style={{
          ...typography.overline,
          color: colors.muted,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        ŞİMDİ AKTİF — {active.length}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
      >
        {active.map((friend) => {
          const activity = entries[friend.profile.id]?.activity;
          return (
            <Pressable
              key={friend.id}
              onPress={() =>
                openDirect.mutate(friend.profile.id, {
                  onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
                })
              }
              haptic="light"
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={`${displayNameOf(friend.profile)} ile sohbet`}
              style={({ pressed }) => ({
                alignItems: "center",
                width: 64,
                gap: spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar
                profileId={friend.profile.id}
                imageUrl={friend.profile.imageUrl}
                fallbackText={friend.profile.username}
                size={52}
                showPresence
              />
              <Text
                style={{ ...typography.caption, color: colors.text }}
                numberOfLines={1}
              >
                {displayNameOf(friend.profile)}
              </Text>
              {activity?.name ? (
                <Text
                  style={{ fontSize: 10, lineHeight: 13, color: colors.muted }}
                  numberOfLines={1}
                >
                  {activity.name}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
