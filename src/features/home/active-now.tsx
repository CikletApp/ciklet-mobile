import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { PresenceStatus } from "@ciklet/embedded-activities-sdk/types";

import { useFriends, useOpenDirect, type FriendEntry } from "@/api/hooks";
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
const STATUS_LABEL: Partial<Record<PresenceStatus, string>> = {
  [PresenceStatus.ONLINE]: "Çevrimiçi",
  [PresenceStatus.IDLE]: "Boşta",
  [PresenceStatus.DND]: "Rahatsız Etmeyin",
};

/**
 * Şeritteki BÜTÜN kartlar aynı yükseklikte. Eskiden aktivitesi olmayan her
 * arkadaş 96 dp'lik ayrı bir kareydi, aktivite kartlarının yanında yarım boy
 * kalıyordu; oyun ile müzik kartları da kendi aralarında farklı boydaydı.
 * Şimdi aktivite kutusu sabit yükseklikte (müzik ilerlemesi de kutunun
 * içinde) ve aktivitesiz arkadaşlar tek bir "çevrimiçi" kartında toplanıyor.
 */
const CARD_HEIGHT = 126;
const ACTIVITY_CARD_WIDTH = 216;
const ACTIVITY_BOX_HEIGHT = 64;
const ONLINE_CARD_WIDTH = 150;
const STACK_AVATAR = 40;
const STACK_OVERLAP = 14;
const STACK_VISIBLE = 3;

interface PlayingFriend {
  friend: FriendEntry;
  activity: RichPresence;
}

interface OnlineFriend {
  friend: FriendEntry;
  status: PresenceStatus;
}

export function ActiveNow() {
  const { accepted } = useFriends();
  const entries = usePresenceStore((s) => s.entries);
  const openDirect = useOpenDirect();
  const { playing, online } = useMemo(() => {
    const playing: PlayingFriend[] = [];
    const online: OnlineFriend[] = [];
    for (const friend of accepted) {
      if (isOfficialProfile(friend.profile)) continue;
      const entry = entries[friend.profile.id];
      const status = entry?.status ?? PresenceStatus.OFFLINE;
      if (!ACTIVE_STATUSES.includes(status)) continue;
      if (entry?.activity) playing.push({ friend, activity: entry.activity });
      else online.push({ friend, status });
    }
    return { playing, online };
  }, [accepted, entries]);
  const total = playing.length + online.length;
  if (total === 0) return null;

  const openChat = (profileId: string) =>
    openDirect.mutate(profileId, { onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`) });
  const openOnline = () => {
    const only = online.length === 1 ? online[0] : null;
    if (only) openChat(only.friend.profile.id);
    else router.push("/friends");
  };

  return (
    <View style={{ paddingBottom: spacing.md }}>
      <Text style={{ ...typography.overline, color: colors.muted, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        ŞİMDİ AKTİF — {total}
      </Text>
      {playing.length === 0 ? (
        // Kimse bir şey yapmıyorsa tek kart yalnız kalmasın: tam genişlik şerit.
        <View style={{ paddingHorizontal: spacing.md }}>
          <OnlineCard friends={online} wide onPress={openOnline} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {playing.map(({ friend, activity }) => (
            <ActivityCard key={friend.id} friend={friend} activity={activity} onPress={() => openChat(friend.profile.id)} />
          ))}
          {online.length > 0 ? <OnlineCard friends={online} onPress={openOnline} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

// ── Aktivite kartı ───────────────────────────────────────────────────

function ActivityCard({ friend, activity, onPress }: PlayingFriend & { onPress: () => void }) {
  const scheme = useTheme((s) => s.scheme);
  // Kapaklar göreli yol olarak gelebilir (/api/presence/covers/…).
  const largeImage = resolveMediaUrl(activity.largeImageUrl);
  const smallImage = resolveMediaUrl(activity.smallImageUrl);
  const activityLogo = resolveMediaUrl(activity.appIconUrl) || largeImage;
  const backdrop = largeImage || activityLogo;
  const label = formatActivity(activity);
  const media = isMedia(activity);

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${displayNameOf(friend.profile)}, ${label}`}
      style={({ pressed }) => ({
        width: ACTIVITY_CARD_WIDTH,
        height: CARD_HEIGHT,
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
          <Text style={{ fontSize: 11, lineHeight: 14, color: colors.accent }} numberOfLines={1}>{label}</Text>
        </View>
      </View>
      {/* Aktivite kutusu: web'deki gibi yarı saydam koyu zemin; arkadaki
          bulanık görsel içinden görünür. Yüksekliği sabit: üç satırlık oyun
          da, ilerleme çubuklu şarkı da aynı kutuya sığar. */}
      <View style={{ marginTop: spacing.sm, height: ACTIVITY_BOX_HEIGHT, borderRadius: radii.md, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.2)" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm }}>
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
              <Icon name={media ? "headphones" : "compass"} size={20} color={colors.accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {/* Satırlar web'le aynı: dinleme/izlemede şarkı–sanatçı,
                diğerlerinde uygulama adı–ayrıntı ve geçen süre. */}
            <Text style={{ fontSize: 12, lineHeight: 16, ...fw(700), color: colors.bright }} numberOfLines={1}>
              {media ? activity.details || activity.name : activity.name}
            </Text>
            {media ? (
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.state || activity.name}</Text>
            ) : activity.details ? (
              <Text style={{ fontSize: 11, lineHeight: 15, color: colors.muted }} numberOfLines={1}>{activity.details}</Text>
            ) : null}
            {media ? <MediaTiming activity={activity} /> : <ElapsedLine startedAt={activity.startedAt} />}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ── Çevrimiçi (aktivitesiz) arkadaşlar ───────────────────────────────

/**
 * Aktivitesi olmayan çevrimiçi arkadaşlar tek kartta: üst üste avatarlar ve
 * kimlerin çevrimiçi olduğu. Tek kişiyse dokununca sohbeti açılır, birden
 * fazlaysa arkadaş listesine gidilir. `wide`: aktivite kartı yokken şeridin
 * tamamını kaplayan yatay sürüm.
 */
function OnlineCard({ friends, wide = false, onPress }: { friends: OnlineFriend[]; wide?: boolean; onPress: () => void }) {
  const names = friends.map(({ friend }) => displayNameOf(friend.profile));
  const only = friends.length === 1 ? friends[0] : null;
  const title = only ? names[0] : `${friends.length} arkadaş`;
  const subtitle = only
    ? STATUS_LABEL[only.status] ?? "Çevrimiçi"
    : friends.length === 2
      ? `${names[0]} ve ${names[1]} çevrimiçi`
      : `${names[0]}, ${names[1]} ve ${friends.length - 2} kişi daha çevrimiçi`;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        width: wide ? undefined : ONLINE_CARD_WIDTH,
        height: wide ? undefined : CARD_HEIGHT,
        flexDirection: wide ? "row" : "column",
        alignItems: wide ? "center" : "stretch",
        justifyContent: "space-between",
        gap: wide ? spacing.md : 0,
        padding: spacing.md,
        paddingLeft: wide ? spacing.sm : spacing.md,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: pressed ? colors.raised : colors.panel,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AvatarStack friends={friends} />
        {wide ? null : <Icon name="chevron-right" size={16} color={colors.muted} />}
      </View>
      <View style={wide ? { flex: 1 } : undefined}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 11, lineHeight: 15, color: only && only.status !== PresenceStatus.ONLINE ? colors.muted : colors.success }} numberOfLines={wide ? 1 : 2}>
          {subtitle}
        </Text>
      </View>
      {wide ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

function AvatarStack({ friends }: { friends: OnlineFriend[] }) {
  const shown = friends.slice(0, STACK_VISIBLE);
  const extra = friends.length - shown.length;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {shown.map(({ friend }, index) => (
        // Soldaki üstte: durum noktası (sağ alt) komşusunun üstünde kalır.
        <View
          key={friend.id}
          style={{ marginLeft: index === 0 ? 0 : -STACK_OVERLAP, zIndex: shown.length - index, borderRadius: radii.full, borderWidth: 2, borderColor: colors.panel }}
        >
          <Avatar
            profileId={friend.profile.id}
            imageUrl={friend.profile.imageUrl}
            fallbackText={friend.profile.username}
            size={STACK_AVATAR}
            showPresence
            presenceSize={12}
            backgroundColor={colors.panel}
          />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={{
            marginLeft: -STACK_OVERLAP,
            width: STACK_AVATAR + 4,
            height: STACK_AVATAR + 4,
            borderRadius: radii.full,
            borderWidth: 2,
            borderColor: colors.panel,
            backgroundColor: colors.raised,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 16, ...fw(700), color: colors.bright }}>+{extra}</Text>
        </View>
      ) : null}
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
 * Dinleme/izleme: şarkının süresi biliniyorsa tek satırda geçen süre,
 * ilerleme çubuğu ve toplam; bilinmiyorsa dinlemede "… süredir dinliyor".
 * Oyunun süre satırıyla aynı yükseklikte, kutu boyu değişmesin diye.
 */
function MediaTiming({ activity }: { activity: RichPresence }) {
  const timestamps = activity.timestamps;
  const listeningOnly = !timestamps && activity.type === "LISTENING" && Boolean(activity.startedAt);
  const now = useNow(Boolean(timestamps) || listeningOnly);
  const clock = { fontSize: 9, lineHeight: 14, ...fw(500), color: colors.muted, fontVariant: ["tabular-nums" as const] };

  if (timestamps) {
    const duration = Math.max(0, timestamps.end - timestamps.start);
    const progress = Math.min(duration, Math.max(0, now - timestamps.start));
    const percent = duration > 0 ? (progress / duration) * 100 : 0;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
        <Text style={clock}>{formatClock(progress)}</Text>
        <View style={{ flex: 1, height: 3, borderRadius: radii.full, overflow: "hidden", backgroundColor: colors.border }}>
          <View style={{ width: `${percent}%`, height: "100%", borderRadius: radii.full, backgroundColor: colors.bright }} />
        </View>
        <Text style={clock}>{formatClock(duration)}</Text>
      </View>
    );
  }
  if (listeningOnly && activity.startedAt) {
    return (
      <Text style={{ ...clock, fontSize: 10, marginTop: 3 }} numberOfLines={1}>
        {formatClock(now - activity.startedAt)} süredir dinliyor
      </Text>
    );
  }
  return null;
}
