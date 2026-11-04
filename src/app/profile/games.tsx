import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Stack } from "expo-router";

import { useCurrentProfile, useMyGames, useSetFavoriteGame, useSetGameHidden, useUpdateProfile } from "@/api/hooks";
import type { GamesVisibility, OwnProfileGame } from "@/api/types";
import { IconButton, Pressable, showToast } from "@/components/ui";
import { resolveMediaUrl } from "@/lib/config";
import { FAVORITE_GAME_TAGS, canBeFavoriteGame, type FavoriteGameTag } from "@/lib/favorite-game";
import { useT, type MessageKey, type Translator } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Profil › Oyun Koleksiyonu — web `settings/profile-games-editor.tsx`.
 * Liste masaüstü tespitinden kendiliğinden dolar; burada kimin göreceği,
 * oyunları/programları tek tek gizleme ve TEK favori oyun (yıldız +
 * isteğe bağlı etiket). Her değişiklik anında kaydedilir.
 */

const GAME_TYPES = new Set(["PLAYING", "COMPETING"]);
const PROGRAM_TYPES = new Set(["WORKING", "CREATING"]);

const VISIBILITY: { value: GamesVisibility; label: MessageKey; desc: MessageKey }[] = [
  { value: "EVERYONE", label: "parityScreens.games.visibility.everyone", desc: "parityScreens.games.visibility.everyoneDesc" },
  { value: "FRIENDS", label: "parityScreens.games.visibility.friends", desc: "parityScreens.games.visibility.friendsDesc" },
  { value: "NOBODY", label: "parityScreens.games.visibility.nobody", desc: "parityScreens.games.visibility.nobodyDesc" },
];

const TAG_KEYS: Record<FavoriteGameTag, MessageKey> = {
  better_than_you: "parityScreens.games.favoriteTags.better_than_you",
  like_it_a_bit: "parityScreens.games.favoriteTags.like_it_a_bit",
  just_started: "parityScreens.games.favoriteTags.just_started",
  master: "parityScreens.games.favoriteTags.master",
  cant_stop: "parityScreens.games.favoriteTags.cant_stop",
};

/** web lib/profile-games `playtimeLabel` kuralları, sözlükten. */
function playtimeText(t: Translator, ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return t("parityScreens.games.playtime.lessThanMinute");
  if (mins < 60) return t("parityScreens.games.playtime.minutes", { minutes: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 100 || !m) return t("parityScreens.games.playtime.hours", { hours: h });
  return t("parityScreens.games.playtime.hoursMinutes", { hours: h, minutes: m });
}

export default function ProfileGamesScreen() {
  const t = useT();
  const { data: profile } = useCurrentProfile();
  const games = useMyGames();
  const updateProfile = useUpdateProfile();
  const setHidden = useSetGameHidden();
  const setFavorite = useSetFavoriteGame();
  const visibility = (profile?.gamesVisibility ?? "EVERYONE") as GamesVisibility;
  const current = VISIBILITY.find((v) => v.value === visibility) ?? VISIBILITY[0];

  const rows = games.data ?? [];
  const gameRows = rows.filter((g) => GAME_TYPES.has(g.type));
  const programRows = rows.filter((g) => PROGRAM_TYPES.has(g.type));

  const favoriteFailed = () => showToast(t("parityScreens.games.favoriteSaveFailed"), "error");

  const list = (title: string, items: OwnProfileGame[], favoritable: boolean) =>
    items.length > 0 ? (
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
        {items.map((g) => (
          <GameRow
            key={`${g.type}:${g.name}`}
            game={g}
            t={t}
            favoritable={favoritable && canBeFavoriteGame(g.type)}
            onToggleHidden={() =>
              setHidden.mutate(
                { name: g.name, type: g.type, hidden: !g.hidden },
                { onError: () => showToast(t("parityScreens.games.saveFailed"), "error") }
              )
            }
            onToggleFavorite={() =>
              setFavorite.mutate(g.favorite ? null : { name: g.name, type: g.type, tag: null }, { onError: favoriteFailed })
            }
            onTag={(tag) => setFavorite.mutate({ name: g.name, type: g.type, tag }, { onError: favoriteFailed })}
          />
        ))}
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t("parityScreens.games.title") }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.games.description")}</Text>

        <View
          style={{
            padding: spacing.md,
            gap: spacing.sm,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{t("parityScreens.games.whoCanSee")}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t(current.desc)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }} accessibilityRole="radiogroup">
            {VISIBILITY.map((option) => {
              const active = option.value === visibility;
              return (
                <Chip
                  key={option.value}
                  label={t(option.label)}
                  active={active}
                  onPress={() =>
                    !active &&
                    updateProfile.mutate(
                      { gamesVisibility: option.value },
                      { onError: () => showToast(t("parityScreens.games.visibilitySaveFailed"), "error") }
                    )
                  }
                />
              );
            })}
          </View>
        </View>

        {games.isLoading ? (
          <ActivityIndicator color={colors.muted} />
        ) : rows.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("parityScreens.games.empty")}</Text>
        ) : (
          <>
            {list(t("parityScreens.games.games"), gameRows, true)}
            {list(t("parityScreens.games.programs"), programRows, false)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function GameRow({
  game,
  t,
  favoritable,
  onToggleHidden,
  onToggleFavorite,
  onTag,
}: {
  game: OwnProfileGame;
  t: Translator;
  favoritable: boolean;
  onToggleHidden: () => void;
  onToggleFavorite: () => void;
  onTag: (tag: FavoriteGameTag | null) => void;
}) {
  const cover = resolveMediaUrl(game.coverUrl || game.iconUrl || null);
  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.raised }}>
          {cover ? <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{
              ...typography.bodyStrong,
              color: game.hidden ? colors.muted : colors.bright,
              textDecorationLine: game.hidden ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {game.name}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {`${playtimeText(t, game.playtimeMs)} · ${t("parityScreens.games.sessions", { count: game.sessionCount })}`}
          </Text>
          {/* Süre birikir; Ciklet kataloğa ekleyince profilde görünür (web lib/recognized-games). */}
          {game.recognized === false ? (
            <Text style={{ ...typography.caption, fontStyle: "italic", color: colors.muted }} numberOfLines={1}>
              {t("parityScreens.games.notRecognized")}
            </Text>
          ) : null}
        </View>
        {favoritable ? (
          <IconButton
            icon="sparkles"
            size={36}
            background={game.favorite ? colors.brandSoft : "transparent"}
            tint={game.favorite ? colors.brand : colors.muted}
            label={game.favorite ? t("parityScreens.games.removeFavorite") : t("parityScreens.games.makeFavorite")}
            onPress={onToggleFavorite}
          />
        ) : null}
        <IconButton
          icon={game.hidden ? "eye-off" : "eye"}
          size={36}
          background="transparent"
          tint={colors.muted}
          label={game.hidden ? t("parityScreens.games.showOnProfile") : t("parityScreens.games.hideOnProfile")}
          onPress={onToggleHidden}
        />
      </View>
      {/* Favori satırı: etiket seçimi; gizli / tanınmayan oyun kartta görünmez. */}
      {game.favorite ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
          <View>
            <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>{t("parityScreens.games.favorite")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {game.hidden || game.recognized === false ? t("parityScreens.games.favoriteHidden") : t("parityScreens.games.favoriteHint")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }} accessibilityRole="radiogroup">
            <Chip label={t("parityScreens.games.favoriteTagNone")} active={!game.favoriteTag} onPress={() => game.favoriteTag && onTag(null)} />
            {FAVORITE_GAME_TAGS.map((tag) => (
              <Chip
                key={tag.id}
                label={t(TAG_KEYS[tag.id])}
                active={game.favoriteTag === tag.id}
                onPress={() => game.favoriteTag !== tag.id && onTag(tag.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={{
        minHeight: 32,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandSoft : colors.bg,
      }}
    >
      <Text style={{ ...typography.caption, color: active ? colors.brand : colors.text }}>{label}</Text>
    </Pressable>
  );
}
