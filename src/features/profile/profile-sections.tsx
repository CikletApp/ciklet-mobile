import { Linking, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";

import type {
  FavoriteGameView,
  ProfileActivitySession,
  ProfileBadge,
  ProfileConnectionView,
  ProfileGameView,
} from "@/api/types";
import { Avatar, Icon, Pressable, showToast } from "@/components/ui";
import { isStreamingSoftwareActivity } from "@/lib/activity-broadcast";
import { resolveMediaUrl } from "@/lib/config";
import { formatActivityTitle } from "@/lib/format";
import {
  ACTIVITY_VERB,
  connectionMeta,
  playtimeLabel,
  sessionDurationLabel,
} from "@/lib/profile-extras";
import { BOOST_PINK } from "@/lib/server-boost";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Üye kartı bölümleri — web `member-card.tsx` Pano/Etkinlik/Ortak
 * sekmelerinin mobil parçaları. Ekran düzeni `app/profile/[profileId].tsx`.
 */

export function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.panel,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      {action ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ ...typography.overline, color: colors.muted, flex: 1 }}>{title}</Text>
          {action}
        </View>
      ) : (
        <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
      )}
      {children}
    </View>
  );
}

// ── Rozetler ────────────────────────────────────────────────────────

const BADGE_GLYPH: Record<string, string> = {
  official: "✔",
  bot: "⚙",
  mentol_plus: "✦",
  mentol_pro: "✦",
  developer: "</>",
  early_member: "★",
};

/**
 * Türetilmiş rozetler (sunucu üretir). Web'de üstüne gelince açıklama
 * çıkıyor; dokunmatikte dokununca kısa bildirimle gösterilir.
 */
export function BadgeRow({ badges }: { badges: ProfileBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {badges.map((badge) => {
        const strong = badge.id === "official" || badge.id === "bot";
        const mentol = badge.id === "mentol_plus" || badge.id === "mentol_pro";
        // Takviyeci rozeti: pembe taş (web profile-badge-row `Gem`, #ff73fa).
        const booster = badge.id === "server_booster";
        return (
          <Pressable
            key={badge.id}
            onPress={() => showToast(badge.description)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`${badge.label} rozeti: ${badge.description}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radii.full,
              backgroundColor: strong ? colors.brand : mentol ? colors.brandSoft : colors.raised,
            }}
          >
            {booster ? (
              <Icon name="gem" size={12} color={BOOST_PINK} />
            ) : (
              <Text style={{ fontSize: 11, ...fw(800), color: strong ? colors.onBrand : mentol ? colors.brand : colors.muted }}>
                {BADGE_GLYPH[badge.id] ?? "•"}
              </Text>
            )}
            <Text style={{ fontSize: 11, ...fw(700), color: strong ? colors.onBrand : mentol ? colors.brand : colors.text }}>
              {badge.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Oyun koleksiyonu ────────────────────────────────────────────────

/**
 * Dikey kapak ızgarası (2:3). Web dört sütun; dar ekranda kapaklar
 * okunmaz hale gelmesin diye sütun sayısı genişlikten türetilir (en az 3).
 */
export function CollectionGrid({ items }: { items: ProfileGameView[] }) {
  const { width } = useWindowDimensions();
  // Ekran kenar boşluğu + kart iç boşluğu (2 × lg her biri).
  const inner = width - spacing.lg * 4;
  const columns = inner >= 360 ? 4 : 3;
  const gap = spacing.sm;
  const tile = Math.floor((inner - gap * (columns - 1)) / columns);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {items.map((game) => {
        const cover = resolveMediaUrl(game.coverUrl);
        const icon = resolveMediaUrl(game.iconUrl);
        return (
          <Pressable
            key={`${game.type}:${game.name}`}
            onPress={() => showToast(`${game.name} · ${playtimeLabel(game.playtimeMs)}`)}
            noHitSlop
            accessibilityRole="text"
            accessibilityLabel={`${game.name}, ${playtimeLabel(game.playtimeMs)}`}
            style={{ width: tile, gap: 4 }}
          >
            <View
              style={{
                width: tile,
                height: Math.round(tile * 1.5),
                borderRadius: radii.md,
                overflow: "hidden",
                backgroundColor: colors.raised,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} />
              ) : icon ? (
                <Image source={{ uri: icon }} style={{ width: "70%", height: "70%", borderRadius: radii.sm }} contentFit="contain" />
              ) : (
                <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>
                  {game.name.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 11, ...fw(600), color: colors.bright }} numberOfLines={1}>
              {game.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Favori oyun ─────────────────────────────────────────────────────

/**
 * "Favori Oyun" satırı (web profile/favorite-game-card): 2:3 kapak, ad,
 * süre ve varsa oyuncu etiketi çipi. Etiket metni sunucudan gelir.
 */
export function FavoriteGameCard({ game }: { game: Pick<FavoriteGameView, "name" | "playtimeMs" | "coverUrl" | "iconUrl" | "tagLabel"> }) {
  const cover = resolveMediaUrl(game.coverUrl);
  const icon = resolveMediaUrl(game.iconUrl);
  return (
    <View
      accessible
      accessibilityLabel={`${game.name}, ${playtimeLabel(game.playtimeMs)}${game.tagLabel ? `, ${game.tagLabel}` : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
    >
      <View
        style={{
          width: 56,
          height: 84,
          borderRadius: radii.md,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.raised,
        }}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} />
        ) : icon ? (
          <Image source={{ uri: icon }} style={{ width: "70%", height: "70%", borderRadius: radii.sm }} contentFit="contain" />
        ) : (
          <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>{game.name.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {game.name}
        </Text>
        <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
          {playtimeLabel(game.playtimeMs)}
        </Text>
        {game.tagLabel ? (
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radii.full,
              backgroundColor: colors.brandSoft,
            }}
          >
            <Text style={{ fontSize: 11, lineHeight: 15, color: colors.brand }}>★</Text>
            <Text style={{ fontSize: 11, lineHeight: 15, ...fw(600), color: colors.brand }} numberOfLines={1}>
              {game.tagLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Bağlantılar ─────────────────────────────────────────────────────

export function ConnectionList({ connections }: { connections: ProfileConnectionView[] }) {
  return (
    <View style={{ gap: 2 }}>
      {connections.map((connection) => {
        const meta = connectionMeta(connection.type);
        const url = connection.url;
        return (
          <Pressable
            key={connection.type}
            onPress={url ? () => void Linking.openURL(url).catch(() => undefined) : undefined}
            disabled={!url}
            noHitSlop
            accessibilityRole={url ? "link" : "text"}
            accessibilityLabel={`${meta?.label ?? connection.type}: ${connection.handle}${connection.verified ? ", doğrulanmış" : ""}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.xs,
              borderRadius: radii.sm,
              backgroundColor: pressed && url ? colors.raised : "transparent",
            })}
          >
            <Text style={{ width: 92, fontSize: 11, ...fw(700), color: colors.muted }} numberOfLines={1}>
              {(meta?.label ?? connection.type).toLocaleUpperCase("tr-TR")}
            </Text>
            <Text style={{ flex: 1, ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {connection.handle}
            </Text>
            {connection.verified ? <Icon name="check" size={14} color={colors.brand} /> : null}
            {url ? <Icon name="link" size={13} color={colors.muted} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Etkinlik ────────────────────────────────────────────────────────

export function ActivityList({ items }: { items: ProfileActivitySession[] }) {
  if (items.length === 0) return <EmptyNote text="Son 7 günde etkinlik yok." />;
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((activity) => {
        const live = !activity.endedAt;
        // Yayın programı (OBS…): adı ve ikonu yok — "Canlı yayın", yayın fiili.
        const software = isStreamingSoftwareActivity(activity);
        const icon = software ? null : resolveMediaUrl(activity.largeImageUrl || activity.appIconUrl);
        const verbType = software ? "STREAMING" : activity.type;
        return (
          <View
            key={activity.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.sm,
              borderRadius: radii.lg,
              backgroundColor: colors.panel,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.raised }}>
              {icon ? (
                <Image source={{ uri: icon }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : software ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="video" size={18} color={colors.muted} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                {formatActivityTitle(activity)}
              </Text>
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                {activity.details && !software ? `${activity.details} · ` : ""}
                {live
                  ? "şu an"
                  : `${ACTIVITY_VERB[verbType] ?? "kullandı"} · ${sessionDurationLabel(activity.startedAt, activity.lastSeenAt)}`}
              </Text>
            </View>
            {live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Ortak arkadaşlar / sunucular ────────────────────────────────────

export function PeopleList({
  items,
  emptyText,
}: {
  items: { id: string; title: string; subtitle: string | null; imageUrl: string | null; seed: string; square?: boolean; href: string }[];
  emptyText: string;
}) {
  if (items.length === 0) return <EmptyNote text={emptyText} />;
  return (
    <View style={{ gap: 2 }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => router.push(item.href as never)}
          haptic="light"
          noHitSlop
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            backgroundColor: pressed ? colors.raised : "transparent",
          })}
        >
          {item.square ? (
            <View style={{ borderRadius: radii.md, overflow: "hidden" }}>
              <Avatar imageUrl={item.imageUrl} fallbackText={item.seed} size={36} radius={0} backgroundColor={colors.bg} />
            </View>
          ) : (
            <Avatar profileId={item.id} imageUrl={item.imageUrl} fallbackText={item.seed} size={36} showPresence />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron-right" size={16} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View style={{ padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.panel }}>
      <Text style={{ ...typography.body, color: colors.muted }}>{text}</Text>
    </View>
  );
}
