import { useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";

import { ApiError } from "@/api/client";
import { useGameDetails, useSetGameHidden, type GameDetailsResponse } from "@/api/hooks/use-game-details";
import { Avatar, Button, Icon, Pressable, Screen, Skeleton, showToast } from "@/components/ui";
import { openImageViewer } from "@/components/ui/image-viewer";
import { resolveMediaUrl } from "@/lib/config";
import { openGuardedLink } from "@/lib/external-link";
import { INTL_LOCALES, useLocale, useT } from "@/lib/i18n";
import { playtimeLabel } from "@/lib/profile-extras";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Oyun / program detayı — web `components/games/game-detail-dialog.tsx`.
 * Profil koleksiyonundaki kapağa dokununca açılır. Web'in iki sütunlu
 * düzeni burada tek sütun: başlık (kapak + sıra + türler), mağaza düğmesi,
 * açanın süresi (kendi profilinde gizle/göster), ekran görüntüleri,
 * Hakkında, oynayan arkadaşlar, topluluk, incelemeler, detaylar, benzer
 * oyunlar, haberler, kaynak ve atıflar. Steam fragmanları (HLS) mobilde yok.
 */

const SOURCE_LABEL: Record<string, string> = {
  steam: "Steam",
  igdb: "IGDB",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  builtin: "Ciklet",
};

const PLATFORM_LABEL: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  playstation: "PlayStation",
  xbox: "Xbox",
  switch: "Nintendo Switch",
  android: "Android",
  ios: "iOS",
};

const WIKIPEDIA_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

/** "Ahmet'in", "Ayşe'nin" (web lib/game-details possessiveTr). */
function possessiveTr(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  const lower = trimmed.toLocaleLowerCase("tr-TR");
  const vowels = lower.match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  const vowel = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  const buffer = /[aeıioöuü]$/.test(lower) ? "n" : "";
  return `${trimmed}'${buffer}${vowel}n`;
}

function relativeTime(iso: string, locale: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

export default function GameDetailScreen() {
  const params = useLocalSearchParams<{ name: string; type: string; profileId?: string; igdbId?: string }>();
  const t = useT();
  const isProgram = !["PLAYING", "STREAMING", "COMPETING"].includes(String(params.type ?? "PLAYING"));
  const query = useGameDetails({
    name: String(params.name ?? ""),
    type: String(params.type ?? "PLAYING"),
    profileId: params.profileId ? String(params.profileId) : undefined,
    igdbId: params.igdbId ? Number(params.igdbId) : undefined,
  });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const title = query.data?.name ?? params.name ?? t("gameDetail.fallbackTitle");

  return (
    <Screen>
      <Stack.Screen options={{ title: String(title) }} />
      {query.data ? (
        <GameDetailBody data={query.data} />
      ) : query.isError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl }}>
          <Icon name={isProgram ? "monitor" : "gamepad"} size={28} color={colors.muted} />
          <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>
            {notFound
              ? t(isProgram ? "gameDetail.error.programNotFound" : "gameDetail.error.gameNotFound")
              : t(isProgram ? "gameDetail.error.programFailed" : "gameDetail.error.gameFailed")}
          </Text>
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton width="100%" height={200} radius={radii.xl} />
          <Skeleton width="60%" height={22} />
          <Skeleton width="100%" height={120} radius={radii.xl} />
        </View>
      )}
    </Screen>
  );
}

function coverCandidates(...urls: (string | null | undefined)[]): string | undefined {
  for (const url of urls) {
    const resolved = resolveMediaUrl(url ?? null);
    if (resolved) return resolved;
  }
  return undefined;
}

function GameDetailBody({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const ext = data.external;
  const isGame = data.bucket === "game";
  const cover = coverCandidates(data.coverUrl, ext.coverUrl, ext.headerUrl, data.iconUrl, ext.logoUrl);
  const heroImage = resolveMediaUrl(ext.heroUrl ?? ext.headerUrl ?? (isGame ? null : (ext.screenshots[0]?.url ?? ext.logoUrl)));
  const hasMedia = Boolean(ext.screenshots.length || ext.headerUrl);
  const hasDetails = Boolean(
    ext.genres.length || ext.developers.length || ext.publishers.length || ext.releaseDate || ext.platforms.length || ext.license ||
      ext.website || ext.storeUrl || ext.igdbUrl || ext.wikipediaUrl || ext.wikidataUrl
  );
  const hasReviews = Boolean(ext.reviews || (isGame && ext.metacritic));
  const number = (n: number) => n.toLocaleString(locale);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
      {/* Başlık: ana görsel bulanık zemin, kapak + sıra + ad + türler. */}
      <View style={{ minHeight: 200, backgroundColor: "#0d0f14", overflow: "hidden", justifyContent: "flex-end" }}>
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: ext.heroUrl ? 0.75 : 0.5 }}
            contentFit="cover"
            blurRadius={ext.heroUrl ? 0 : 18}
          />
        ) : null}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(13,15,20,0.55)" }} />
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.lg, padding: spacing.lg, paddingTop: spacing["2xl"] }}>
          <View style={{ width: 92, height: 124, borderRadius: radii.lg, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            {cover ? (
              <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={{ ...typography.title, color: "#fff" }}>{data.name.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {data.rank ? (
              <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full, backgroundColor: colors.brand }}>
                <Text style={{ fontSize: 11, ...fw(800), color: colors.onBrand }}>
                  {isGame ? t("moreScreens.gameDetail.rankGame", { rank: data.rank.rank }) : t("moreScreens.gameDetail.rankApp", { rank: data.rank.rank })}
                </Text>
              </View>
            ) : null}
            <Text style={{ fontSize: 24, lineHeight: 28, ...fw(900), color: "#fff" }} numberOfLines={2}>
              {data.name}
            </Text>
            {ext.genres.length > 0 || ext.developers.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                {ext.genres.slice(0, 4).map((g) => (
                  <View key={g} style={{ paddingHorizontal: 10, paddingVertical: 2, borderRadius: radii.full, backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <Text style={{ fontSize: 12, ...fw(600), color: "rgba(255,255,255,0.9)" }}>{g}</Text>
                  </View>
                ))}
                {ext.developers[0] ? <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{ext.developers[0]}</Text> : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        {ext.storeUrl ? (
          <Button label={t("gameDetail.viewOnSteam")} icon="arrow-up-right" variant="secondary" onPress={() => openGuardedLink(ext.storeUrl)} fullWidth />
        ) : ext.website || ext.igdbUrl ? (
          <Button
            label={ext.website ? t("gameDetail.openWebsite") : t("gameDetail.viewOnIgdb")}
            icon="arrow-up-right"
            variant="secondary"
            onPress={() => openGuardedLink(ext.website ?? ext.igdbUrl)}
            fullWidth
          />
        ) : null}

        {!hasMedia ? <CikletInfoCard data={data} /> : null}
        {data.owner ? <OwnerCard data={data} /> : null}

        {ext.screenshots.length > 0 || ext.headerUrl ? <Screenshots data={data} /> : null}

        {ext.shortDescription || ext.description ? <Description data={data} /> : null}

        {data.friends.length > 0 ? <FriendsCard data={data} /> : null}

        {data.servers.length > 0 ? (
          <Card title={t("moreScreens.gameDetail.community")}>
            {data.servers.map((s) => {
              const icon = resolveMediaUrl(s.imageUrl);
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.raised }}>
                  {icon ? (
                    <Image source={{ uri: icon }} style={{ width: 40, height: 40, borderRadius: radii.lg }} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
                      <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>{s.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
                      {s.onlineCount !== null ? `● ${number(s.onlineCount)}  ` : ""}
                      {t("moreScreens.gameDetail.members", { count: number(s.memberCount) })}
                    </Text>
                  </View>
                  <Button
                    label={s.isMember ? t("moreScreens.gameDetail.view") : t("moreScreens.gameDetail.join")}
                    
                    variant={s.isMember ? "secondary" : "primary"}
                    onPress={() => router.push(`/servers/${s.id}`)}
                  />
                </View>
              );
            })}
          </Card>
        ) : null}

        {hasReviews ? (
          <Card title={t("moreScreens.gameDetail.reviews")}>
            {ext.reviews ? (
              <View>
                <Text style={{ ...typography.caption, color: colors.muted }}>{t("moreScreens.gameDetail.steamReviews")}</Text>
                <Text
                  style={{
                    ...typography.bodyStrong,
                    color: ext.reviews.score >= 7 ? colors.success : ext.reviews.score >= 5 ? colors.warning : ext.reviews.score > 0 ? colors.danger : colors.bright,
                  }}
                >
                  {ext.reviews.label}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {t("moreScreens.gameDetail.reviewSummary", { percent: ext.reviews.percent, total: number(ext.reviews.total) })}
                </Text>
              </View>
            ) : null}
            {isGame && ext.metacritic ? (
              <Pressable
                onPress={() => (ext.metacritic?.url ? openGuardedLink(ext.metacritic.url) : undefined)}
                disabled={!ext.metacritic.url}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: ext.metacritic.score >= 75 ? "#66cc33" : ext.metacritic.score >= 50 ? "#ffcc33" : "#ff0000",
                  }}
                >
                  <Text style={{ fontSize: 15, ...fw(900), color: ext.metacritic.score >= 50 && ext.metacritic.score < 75 ? "#000" : "#fff" }}>
                    {ext.metacritic.score}
                  </Text>
                </View>
                <Text style={{ ...typography.bodyStrong, color: colors.bright }}>Metacritic{ext.metacritic.url ? " ↗" : ""}</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {hasDetails ? <DetailsCard data={data} /> : null}

        {ext.similar.length > 0 ? (
          <Strip title={t("moreScreens.gameDetail.similar")}>
            {ext.similar.map((game) => {
              const uri = resolveMediaUrl(game.coverUrl);
              return (
                <Pressable
                  key={game.name}
                  disabled={!game.igdbId}
                  onPress={() =>
                    router.push({
                      pathname: "/games/details",
                      params: { name: game.name, type: data.type, igdbId: String(game.igdbId), ...(data.owner ? { profileId: data.owner.id } : {}) },
                    })
                  }
                  style={{ width: 96, gap: 4 }}
                >
                  <View style={{ width: 96, height: 128, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.raised }}>
                    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                  </View>
                  <Text style={{ fontSize: 11, ...fw(600), color: colors.bright }} numberOfLines={2}>{game.name}</Text>
                </Pressable>
              );
            })}
          </Strip>
        ) : null}

        {ext.news.length > 0 ? (
          <Strip title={t("moreScreens.gameDetail.news")}>
            {ext.news.map((item) => {
              const uri = resolveMediaUrl(item.imageUrl ?? ext.headerUrl);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => openGuardedLink(item.url)}
                  style={{ width: 240, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.panel }}
                >
                  <View style={{ width: 240, height: 120, backgroundColor: colors.raised }}>
                    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                  </View>
                  <View style={{ padding: spacing.md, gap: 4 }}>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      {new Date(item.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
                    </Text>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={2}>{item.title}</Text>
                    {item.excerpt ? (
                      <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={3}>{item.excerpt}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Strip>
        ) : null}

        {ext.sources.length > 0 ? (
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {t("gameDetail.sources", { list: ext.sources.map((s) => SOURCE_LABEL[s] ?? s).join(" / ") })}
          </Text>
        ) : null}
        {(ext.mediaCredits ?? []).length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 11, ...fw(600), color: colors.muted }}>{t("gameDetail.credits.title")}</Text>
            {ext.mediaCredits.map((c) => (
              <Text key={c.url} onPress={() => openGuardedLink(c.pageUrl)} style={{ fontSize: 11, color: colors.muted }}>
                {c.kind === "logo" ? t("gameDetail.credits.logo") : t("gameDetail.credits.screenshot")}: {c.title} ·{" "}
                {[c.license ?? t("gameDetail.credits.unknownLicense"), c.author].filter(Boolean).join(" · ")}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
      {title ? <Text style={{ ...typography.overline, color: colors.muted }}>{title.toLocaleUpperCase("tr-TR")}</Text> : null}
      {children}
    </View>
  );
}

function Strip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{title.toLocaleUpperCase("tr-TR")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
        {children}
      </ScrollView>
    </View>
  );
}

function CikletInfoCard({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const ext = data.external;
  const isGame = data.bucket === "game";
  const hours = data.usage ? Math.round(data.usage.totalMs / 3_600_000) : 0;
  const stats = [
    data.usage && { label: isGame ? t("moreScreens.gameDetail.players") : t("moreScreens.gameDetail.users"), value: t("moreScreens.gameDetail.people", { count: data.usage.players.toLocaleString(locale) }) },
    data.usage && { label: t("moreScreens.gameDetail.totalTime"), value: hours > 0 ? t("moreScreens.gameDetail.hours", { count: hours.toLocaleString(locale) }) : playtimeLabel(data.usage.totalMs) },
    data.rank && { label: t("moreScreens.gameDetail.rank"), value: `#${data.rank.rank}` },
  ].filter((s): s is { label: string; value: string } => Boolean(s));
  return (
    <Card>
      <Text style={{ ...typography.caption, color: colors.muted }}>
        {[ext.genres[0] ?? (isGame ? t("moreScreens.gameDetail.game") : t("moreScreens.gameDetail.app")), ext.developers[0]].filter(Boolean).join(" · ")}
      </Text>
      {stats.length > 0 ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.raised }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>{s.label}</Text>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{s.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!ext.shortDescription && !ext.description ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{isGame ? t("moreScreens.gameDetail.gameSoon") : t("moreScreens.gameDetail.appSoon")}</Text>
      ) : null}
    </Card>
  );
}

function OwnerCard({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const lang = useLocale();
  const locale = INTL_LOCALES[lang];
  const owner = data.owner!;
  const setHidden = useSetGameHidden();
  const [hidden, setHiddenState] = useState(owner.hidden);

  const toggle = () =>
    setHidden.mutate(
      { name: data.name, type: data.type, hidden: !hidden },
      {
        onSuccess: () => {
          showToast(hidden ? t("moreScreens.gameDetail.shownAgain") : t("moreScreens.gameDetail.hiddenToast"));
          setHiddenState(!hidden);
        },
        onError: () => showToast(t("moreScreens.gameDetail.saveFailed"), "error"),
      }
    );

  return (
    <Card title={owner.isSelf ? t("moreScreens.gameDetail.yourTime") : t("moreScreens.gameDetail.theirTime", { name: lang === "tr" ? possessiveTr(owner.displayName) : owner.displayName })}>
      <Text style={{ fontSize: 22, ...fw(800), color: colors.bright }}>{playtimeLabel(owner.playtimeMs)}</Text>
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("moreScreens.gameDetail.sessions")}</Text>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{owner.sessionCount.toLocaleString(locale)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("moreScreens.gameDetail.lastPlayed")}</Text>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{relativeTime(owner.lastPlayedAt, locale)}</Text>
        </View>
      </View>
      {owner.isSelf ? (
        <Button
          label={hidden ? t("moreScreens.gameDetail.showOnProfile") : t("moreScreens.gameDetail.hideOnProfile")}
          icon={hidden ? "eye" : "eye-off"}
          variant="secondary"
          
          onPress={toggle}
          loading={setHidden.isPending}
          fullWidth
        />
      ) : null}
    </Card>
  );
}

function Screenshots({ data }: { data: GameDetailsResponse }) {
  const { width } = useWindowDimensions();
  const ext = data.external;
  const shots = ext.screenshots.length > 0 ? ext.screenshots : ext.headerUrl ? [{ url: ext.headerUrl, thumbUrl: ext.headerUrl }] : [];
  const shotWidth = Math.min(width - spacing.lg * 2, 420);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {shots.map((shot) => {
        const full = resolveMediaUrl(shot.url);
        const thumb = resolveMediaUrl(shot.thumbUrl) ?? full;
        return (
          <Pressable
            key={shot.url}
            onPress={() => (full ? openImageViewer(full) : undefined)}
            accessibilityRole="imagebutton"
            accessibilityLabel={data.name}
            style={{ width: shotWidth, aspectRatio: 16 / 9, borderRadius: radii.lg, overflow: "hidden", backgroundColor: "#000" }}
          >
            {thumb ? <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Description({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const { shortDescription: short, description: long, descriptionCredit: credit } = data.external;
  const [expanded, setExpanded] = useState(false);
  const showLong = Boolean(long && long !== short);
  return (
    <Card title={t("gameDetail.about.title")}>
      {short ? <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{short}</Text> : null}
      {showLong ? (
        <>
          <Text style={{ ...typography.body, color: colors.text }} numberOfLines={expanded ? undefined : 5}>
            {long}
          </Text>
          <Text onPress={() => setExpanded((v) => !v)} style={{ ...typography.caption, ...fw(700), color: colors.brand }}>
            {expanded ? t("gameDetail.about.showLess") : t("gameDetail.about.showMore")}
          </Text>
        </>
      ) : null}
      {credit ? (
        <Text style={{ fontSize: 11, color: colors.muted }}>
          {t("gameDetail.about.source")}{" "}
          <Text onPress={() => openGuardedLink(credit.url)} style={{ ...fw(700), textDecorationLine: "underline" }}>
            {t("gameDetail.about.wikipediaLang", { lang: credit.lang.toUpperCase() })}
          </Text>
          {" · "}
          <Text onPress={() => openGuardedLink(WIKIPEDIA_LICENSE_URL)} style={{ textDecorationLine: "underline" }}>
            CC BY-SA 4.0
          </Text>
        </Text>
      ) : null}
    </Card>
  );
}

function FriendsCard({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const rest = data.friendsTotal - data.friends.length;
  return (
    <Card title={t("moreScreens.gameDetail.friends")}>
      {data.friends.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => router.push(`/profile/${f.id}`)}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <Avatar profileId={f.id} imageUrl={f.imageUrl} fallbackText={f.name || f.username} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>{f.name || f.username}</Text>
            <Text style={{ ...typography.caption, ...fw(f.playingNow ? 700 : 400), color: f.playingNow ? colors.success : colors.muted }} numberOfLines={1}>
              {f.playingNow ? t("moreScreens.gameDetail.playingNow") : playtimeLabel(f.playtimeMs)}
            </Text>
          </View>
        </Pressable>
      ))}
      {rest > 0 ? <Text style={{ fontSize: 11, color: colors.muted }}>{t("moreScreens.gameDetail.moreFriends", { count: rest })}</Text> : null}
    </Card>
  );
}

function DetailsCard({ data }: { data: GameDetailsResponse }) {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const ext = data.external;
  const isGame = data.bucket === "game";
  const links = [
    ext.website && { href: ext.website, label: t("gameDetail.details.website") },
    ext.storeUrl && { href: ext.storeUrl, label: t("gameDetail.details.steamStore") },
    ext.igdbUrl && { href: ext.igdbUrl, label: "IGDB" },
    ext.wikipediaUrl && { href: ext.wikipediaUrl, label: "Wikipedia" },
    ext.wikidataUrl && { href: ext.wikidataUrl, label: "Wikidata" },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const rows = [
    ext.genres.length > 0 && { label: t(isGame ? "gameDetail.details.genre" : "gameDetail.details.category"), value: ext.genres.join(", ") },
    ext.developers.length > 0 && { label: t("gameDetail.details.developer"), value: ext.developers.join(", ") },
    ext.publishers.length > 0 && { label: t("gameDetail.details.publisher"), value: ext.publishers.join(", ") },
    ext.releaseDate && {
      label: t(isGame ? "gameDetail.details.releaseDate" : "gameDetail.details.firstRelease"),
      value: ext.releaseDateIso
        ? new Date(ext.releaseDateIso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
        : ext.releaseDate,
    },
    ext.license && {
      label: t("gameDetail.details.license"),
      value: [ext.license.kind ? t(`gameDetail.license.${ext.license.kind}`) : null, ext.license.names.join(", ") || null].filter(Boolean).join(" · "),
    },
    ext.platforms.length > 0 && { label: t("gameDetail.details.platform"), value: ext.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(", ") },
  ].filter((r): r is { label: string; value: string } => Boolean(r));

  return (
    <Card title={t("gameDetail.details.title")}>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: "row", gap: spacing.md }}>
          <Text style={{ width: 92, ...typography.caption, color: colors.muted }}>{row.label}</Text>
          <Text style={{ flex: 1, ...typography.caption, ...fw(600), color: colors.bright }}>{row.value}</Text>
        </View>
      ))}
      {links.length > 0 ? (
        <View style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
          {links.map((link) => (
            <Pressable key={link.href} onPress={() => openGuardedLink(link.href)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="arrow-up-right" size={14} color={colors.muted} />
              <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
