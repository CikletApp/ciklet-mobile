import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";

import { useSpotifyLink, useSpotifyNowPlaying } from "@/api/hooks";
import type { SpotifyNowPlaying } from "@/api/types";
import { Icon, Pressable } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { startListenAlong, stopListenAlong, useListenAlong } from "./listen-along";

/** Spotify yeşili — marka rengi, temadan bağımsız. */
const SPOTIFY_GREEN = "#1DB954";

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Sunucunun okuduğu andan bu yana ileri sarılmış konum (web `positionAt`). */
function positionAt(track: SpotifyNowPlaying, now: number): number {
  if (!track.isPlaying) return track.progressMs;
  return Math.min(track.durationMs, track.progressMs + Math.max(0, now - track.fetchedAt));
}

/**
 * Üye kartında "Spotify'da dinliyor" bölümü — web `SpotifyNowPlaying`.
 * Birlikte dinle düğmesi yalnızca izleyenin kendi Spotify'ı bağlı ve
 * Premium ise çıkar (sunucu da denetler).
 */
export function SpotifyCard({ profileId, name, isSelf }: { profileId: string; name: string; isSelf: boolean }) {
  const { data: playing } = useSpotifyNowPlaying(profileId);
  const { data: viewer } = useSpotifyLink(!isSelf && Boolean(playing));
  const host = useListenAlong((s) => s.host);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [playing]);

  if (!playing) return null;
  const pos = positionAt(playing, now);
  const pct = playing.durationMs > 0 ? Math.min(100, (pos / playing.durationMs) * 100) : 0;
  const listening = host?.id === profileId;

  return (
    <View style={{ backgroundColor: `${SPOTIFY_GREEN}1A`, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="headphones" size={14} color={SPOTIFY_GREEN} />
        <Text style={{ ...typography.overline, color: SPOTIFY_GREEN }}>SPOTIFY&apos;DA DİNLİYOR</Text>
      </View>
      <Pressable
        onPress={playing.url ? () => void Linking.openURL(playing.url!).catch(() => undefined) : undefined}
        disabled={!playing.url}
        noHitSlop
        accessibilityRole="link"
        accessibilityLabel={`${playing.title}, ${playing.artists}. Spotify'da aç`}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        {playing.imageUrl ? (
          <Image source={{ uri: playing.imageUrl }} style={{ width: 52, height: 52, borderRadius: radii.md }} contentFit="cover" transition={120} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {playing.title}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {playing.artists}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 10, color: colors.muted, fontVariant: ["tabular-nums"] }}>{mmss(pos)}</Text>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: "hidden" }}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: SPOTIFY_GREEN }} />
            </View>
            <Text style={{ fontSize: 10, color: colors.muted, fontVariant: ["tabular-nums"] }}>{mmss(playing.durationMs)}</Text>
          </View>
        </View>
      </Pressable>
      {!isSelf && viewer?.linked && viewer.premium ? (
        <Pressable
          onPress={() => (listening ? stopListenAlong() : startListenAlong({ id: profileId, name }))}
          haptic="light"
          accessibilityRole="button"
          style={({ pressed }) => ({
            minHeight: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.md,
            backgroundColor: SPOTIFY_GREEN,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ ...typography.caption, ...fw(700), color: "#ffffff" }}>
            {listening ? "Birlikte dinlemeyi bırak" : "Birlikte dinle"}
          </Text>
        </Pressable>
      ) : null}
      {!isSelf && viewer && !viewer.linked ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Birlikte dinlemek için Spotify hesabını web üzerinden bağla (Ayarlar → Profil → Bağlantılar).
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Birlikte dinlerken görünen şerit. Sohbetler listesinin ve profilin
 * altında; kapatma düğmesi döngüyü durdurur.
 */
export function ListenAlongBar() {
  const host = useListenAlong((s) => s.host);
  const track = useListenAlong((s) => s.track);
  const paused = useListenAlong((s) => s.paused);
  if (!host) return null;

  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: colors.panel,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {track?.imageUrl ? (
        <Image source={{ uri: track.imageUrl }} style={{ width: 40, height: 40, borderRadius: radii.md }} contentFit="cover" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: `${SPOTIFY_GREEN}26` }}>
          <Icon name="headphones" size={20} color={SPOTIFY_GREEN} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...typography.caption, ...fw(700), color: SPOTIFY_GREEN }} numberOfLines={1}>
          {host.name} ile dinliyorsun{paused ? " · duraklatıldı" : ""}
        </Text>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {track ? `${track.title} — ${track.artists}` : "Eşitleniyor…"}
        </Text>
      </View>
      <Pressable
        onPress={stopListenAlong}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Birlikte dinlemeyi bırak"
        style={{ padding: spacing.xs }}
      >
        <Icon name="close" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}
