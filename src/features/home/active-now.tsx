import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import type { RichPresence, RichPresenceType } from "@/api/types";
import { Avatar, Icon, Pressable } from "@/components/ui";
import { displayNameOf, formatElapsed } from "@/lib/format";
import { usePresenceStore } from "@/stores/presence";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * "Şimdi Aktif" — mesaj listesinin üstünde çevrimiçi arkadaşlar.
 *
 * Web'deki `ActiveNow` bir arkadaşı listeye almak için hem çevrimiçi
 * OLMASINI hem de zengin durum taşımasını şart koşuyor. Mobilde bu ölçüt
 * çoğu zaman boş liste üretirdi (zengin durum masaüstü istemcisinden
 * geliyor), bu yüzden burada çevrimiçi olmak yeterli — ama zengin durum
 * VARSA web'deki kartın aynısı çizilir: "<oyun> Oynuyor" ve geçen süre.
 *
 * Kimse çevrimiçi değilse bölüm hiç çizilmez; boş bir başlık yer kaplamamalı.
 */
const ACTIVE_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.IDLE,
  PresenceStatus.DND,
];

/** Zengin durum türünün Türkçe fiili. */
const ACTIVITY_VERB: Record<RichPresenceType, string> = {
  PLAYING: "Oynuyor",
  LISTENING: "Dinliyor",
  STREAMING: "Yayında",
  WATCHING: "İzliyor",
  WORKING: "Çalışıyor",
  CREATING: "Üretiyor",
  COMPETING: "Yarışıyor",
};

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();

  const active = useMemo(
    () =>
      accepted
        .map((friend) => ({
          friend,
          entry: entries[friend.profile.id],
        }))
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
          paddingVertical: spacing.md,
        }}
      >
        ŞİMDİ AKTİF — {active.length}
      </Text>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {active.map(({ friend, entry }) => (
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
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.panel,
              gap: spacing.md,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar
                profileId={friend.profile.id}
                imageUrl={friend.profile.imageUrl}
                fallbackText={friend.profile.username}
                size={44}
                showPresence
                backgroundColor={colors.panel}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{ ...typography.bodyStrong, color: colors.bright }}
                  numberOfLines={1}
                >
                  {displayNameOf(friend.profile)}
                </Text>
                {entry?.activity?.name ? (
                  <Text
                    style={{ ...typography.caption, color: colors.accent }}
                    numberOfLines={1}
                  >
                    {entry.activity.name}{" "}
                    {ACTIVITY_VERB[entry.activity.type ?? "PLAYING"]}
                  </Text>
                ) : null}
              </View>
            </View>

            {entry?.activity ? <ActivityCard activity={entry.activity} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Aktivite alt kartı — kapak görseli, ad ve geçen süre. */
function ActivityCard({ activity }: { activity: RichPresence }) {
  const [, forceTick] = useState(0);

  // Geçen süre saniyede bir tazelenir; sabit bir sayı "canlı" hissini
  // yok eder. Yalnızca kart görünürken çalışır.
  useEffect(() => {
    if (!activity.startedAt) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [activity.startedAt]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Avatar
        imageUrl={activity.largeImageUrl ?? activity.appIconUrl}
        fallbackText={activity.name}
        size={40}
        shape="squircle"
        backgroundColor={colors.panel}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ ...typography.caption, fontWeight: "600", color: colors.bright }}
          numberOfLines={1}
        >
          {activity.name}
        </Text>

        {activity.details ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {activity.details}
          </Text>
        ) : null}

        {activity.startedAt ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Icon name="compass" size={12} color={colors.success} />
            <Text style={{ ...typography.caption, color: colors.success }}>
              {formatElapsed(activity.startedAt)} süre geçti
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
