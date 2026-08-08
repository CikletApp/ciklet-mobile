import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import { Avatar, Pressable } from "@/components/ui";
import { displayNameOf } from "@/lib/format";
import { usePresenceStore } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "Şimdi Aktif" — çevrimiçi arkadaşların yatay şeridi.
 *
 * Mobil öncelikli tasarım: web'deki dikey kart listesi telefonda mesaj
 * listesini aşağı itiyordu. Burada her arkadaş sabit genişlikte kompakt bir
 * kart; yatay kaydırılır ve ekranın en fazla ~%20'sini kaplar.
 *
 * Web'deki `ActiveNow` bir arkadaşı listeye almak için zengin durum da
 * şart koşuyor; zengin durum masaüstünden geldiği için mobilde bu ölçüt
 * çoğu zaman boş liste üretirdi. Burada çevrimiçi olmak yeterli, zengin
 * durum VARSA ek satır olarak gösterilir.
 */
const ACTIVE_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.IDLE,
  PresenceStatus.DND,
];

const CARD_WIDTH = 84;

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();

  const active = useMemo(
    () =>
      accepted
        .map((friend) => ({ friend, entry: entries[friend.profile.id] }))
        .filter(({ entry }) =>
          ACTIVE_STATUSES.includes(entry?.status ?? PresenceStatus.OFFLINE)
        ),
    [accepted, entries]
  );

  if (active.length === 0) return null;

  return (
    <View style={{ paddingBottom: spacing.md }}>
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
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {active.map(({ friend }) => (
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
              width: CARD_WIDTH,
              height: 94,
              padding: spacing.sm,
              borderRadius: radii.lg,
              borderCurve: "continuous",
              backgroundColor: colors.panel,
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Avatar
              profileId={friend.profile.id}
              imageUrl={friend.profile.imageUrl}
              fallbackText={friend.profile.username}
              size={50}
              showPresence
              backgroundColor={colors.panel}
            />
            <Text
              style={{ fontSize: 11, lineHeight: 14, fontWeight: "600", color: colors.text }}
              numberOfLines={1}
            >
              {displayNameOf(friend.profile)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
