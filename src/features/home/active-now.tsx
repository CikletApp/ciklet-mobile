import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect } from "@/api/hooks";
import type { RichPresence } from "@/api/types";
import { Avatar, Icon, Pressable } from "@/components/ui";
import { resolveMediaUrl } from "@/lib/config";
import { displayNameOf, formatActivity } from "@/lib/format";
import { isOfficialProfile } from "@/lib/official";
import { usePresenceStore } from "@/stores/presence";
import { useTheme } from "@/stores/theme";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

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
  const scheme = useTheme((s) => s.scheme);
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
            ? formatActivity(activity)
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
              {/* Bulanık arka plan (web ActiveFriendCard): görsel dört yandan
                  24 dp taşar, yoksa bulanıklık kenarlarda soluk çerçeve bırakır. */}
              {backdrop ? (
                <Image
                  source={{ uri: backdrop }}
                  contentFit="cover"
                  blurRadius={20}
                  style={{ position: "absolute", inset: -24, opacity: scheme === "dark" ? 0.2 : 0.25 }}
                />
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Avatar profileId={friend.profile.id} imageUrl={friend.profile.imageUrl} fallbackText={friend.profile.username} size={38} showPresence backgroundColor={colors.panel} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{displayNameOf(friend.profile)}</Text>
                  <Text style={{ fontSize: 11, lineHeight: 14, color: activity ? colors.accent : colors.success }} numberOfLines={1}>{label}</Text>
                </View>
              </View>
              {/* Aktivite kutusu: web'deki gibi yarı saydam koyu zemin; arkadaki
                  bulanık görsel içinden görünür. */}
              <View style={{ marginTop: spacing.sm, minHeight: 58, borderRadius: radii.md, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.2)" }}>
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
                    {/* Satırlar web'le aynı: dinleme/izlemede şarkı–sanatçı,
                        diğerlerinde uygulama adı–ayrıntı ve geçen süre. */}
                    <Text style={{ fontSize: 12, lineHeight: 16, ...fw(700), color: colors.bright }} numberOfLines={1}>
                      {isMedia(activity) ? activity.details || activity.name : activity.name}
                    </Text>
                    {isMedia(activity) ? (
                      <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.state || activity.name}</Text>
                    ) : activity.details ? (
                      <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.details}</Text>
                    ) : null}
                    {isMedia(activity) ? null : <ElapsedLine startedAt={activity.startedAt} />}
                  </View>
                </View>
              </View>
              {isMedia(activity) ? <MediaTiming activity={activity} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Süre ─────────────────────────────────────────────────────────────

/** Modül düzeyinde: render içinde doğrudan `Date.now` React Compiler'a takılıyor. */
function nowMs(): number {
  return Date.now();
}

/** Saniyede bir tikleyen saat; `active` false iken durur. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Web'le aynı biçim: saat varsa "H:MM:SS", yoksa "MM:SS". */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function isMedia(activity: RichPresence): boolean {
  return activity.type === "LISTENING" || activity.type === "WATCHING";
}

/** Oyun, çalışma, yayın…: yeşil "… süre geçti" satırı. `startedAt` yoksa hiçbir şey. */
function ElapsedLine({ startedAt }: { startedAt?: number }) {
  const now = useNow(Boolean(startedAt));
  if (!startedAt) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
      <Icon name="gamepad" size={13} color={colors.success} />
      <Text style={{ flex: 1, fontSize: 11, lineHeight: 14, ...fw(700), color: colors.success, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {formatClock(now - startedAt)} süre geçti
      </Text>
    </View>
  );
}

/**
 * Dinleme/izleme: şarkının süresi biliniyorsa ilerleme çubuğu (solda geçen,
 * sağda toplam); bilinmiyorsa dinlemede "… süredir dinliyor".
 */
function MediaTiming({ activity }: { activity: RichPresence }) {
  const timestamps = activity.timestamps;
  const listeningOnly = !timestamps && activity.type === "LISTENING" && Boolean(activity.startedAt);
  const now = useNow(Boolean(timestamps) || listeningOnly);

  if (timestamps) {
    const duration = Math.max(0, timestamps.end - timestamps.start);
    const progress = Math.min(duration, Math.max(0, now - timestamps.start));
    const percent = duration > 0 ? (progress / duration) * 100 : 0;
    return (
      <View style={{ marginTop: spacing.sm }}>
        <View style={{ height: 4, borderRadius: radii.full, overflow: "hidden", backgroundColor: colors.border }}>
          <View style={{ width: `${percent}%`, height: "100%", borderRadius: radii.full, backgroundColor: colors.bright }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
          <Text style={{ fontSize: 9, lineHeight: 12, ...fw(500), color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatClock(progress)}</Text>
          <Text style={{ fontSize: 9, lineHeight: 12, ...fw(500), color: colors.muted, fontVariant: ["tabular-nums"] }}>{formatClock(duration)}</Text>
        </View>
      </View>
    );
  }
  if (listeningOnly && activity.startedAt) {
    return (
      <Text style={{ marginTop: 6, fontSize: 10, lineHeight: 13, ...fw(500), color: colors.muted, fontVariant: ["tabular-nums"] }}>
        {formatClock(now - activity.startedAt)} süredir dinliyor
      </Text>
    );
  }
  return null;
}
