import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import type { RichPresence, RichPresenceType } from "@/api/types";
import { Avatar, Pressable } from "@/components/ui";
import { displayNameOf, formatElapsed } from "@/lib/format";
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

const ACTIVITY_VERB: Record<RichPresenceType, string> = {
  PLAYING: "Oynuyor",
  LISTENING: "Dinliyor",
  STREAMING: "Yayında",
  WATCHING: "İzliyor",
  WORKING: "Çalışıyor",
  CREATING: "Üretiyor",
  COMPETING: "Yarışıyor",
};

const CARD_WIDTH = 168;

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
              width: CARD_WIDTH,
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.panel,
              gap: spacing.sm,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Avatar
                profileId={friend.profile.id}
                imageUrl={friend.profile.imageUrl}
                fallbackText={friend.profile.username}
                size={32}
                showPresence
                backgroundColor={colors.panel}
              />
              <Text
                style={{ ...typography.caption, fontWeight: "700", color: colors.bright, flex: 1 }}
                numberOfLines={1}
              >
                {displayNameOf(friend.profile)}
              </Text>
            </View>

            {entry?.activity ? (
              <ActivityLine activity={entry.activity} />
            ) : (
              <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                Çevrimiçi
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Aktivite satırı — ad, fiil ve saniyede bir ilerleyen süre. */
function ActivityLine({ activity }: { activity: RichPresence }) {
  const elapsed = useElapsed(activity.startedAt);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {activity.largeImageUrl || activity.appIconUrl ? (
        <Avatar
          imageUrl={activity.largeImageUrl ?? activity.appIconUrl}
          fallbackText={activity.name}
          size={26}
          shape="squircle"
          backgroundColor={colors.panel}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, lineHeight: 15, color: colors.accent }} numberOfLines={1}>
          {activity.name} {ACTIVITY_VERB[activity.type ?? "PLAYING"]}
        </Text>
        {elapsed ? (
          <Text style={{ fontSize: 11, lineHeight: 15, color: colors.success }}>
            {elapsed}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Geçen süreyi saniyede bir tazeler.
 *
 * Önceki sürüm kullanılmayan bir sayaç state'ini artırıp yeniden render
 * beklemekteydi; değer okunmadığı için render atlanabiliyor ve sayaç
 * donuyordu. Artık BİÇİMLENMİŞ METNİN KENDİSİ state'te tutuluyor —
 * her tik gerçekten yeni bir değer üretir.
 */
function useElapsed(startedAt: number | undefined): string | null {
  const [label, setLabel] = useState(() =>
    startedAt ? `${formatElapsed(startedAt)} süre geçti` : null
  );

  useEffect(() => {
    if (!startedAt) {
      setLabel(null);
      return;
    }
    setLabel(`${formatElapsed(startedAt)} süre geçti`);
    const timer = setInterval(
      () => setLabel(`${formatElapsed(startedAt)} süre geçti`),
      1000
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  return label;
}
