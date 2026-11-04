import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { useProfileCard } from "@/api/hooks";
import type { RichPresence } from "@/api/types";
import { Avatar, Icon } from "@/components/ui";
import { isStreamingSoftwareActivity } from "@/lib/activity-broadcast";
import { resolveMediaUrl } from "@/lib/config";
import { displayNameOf, formatActivity, formatActivityTitle } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { visibleActivity } from "@/lib/recognized-games";
import { usePresenceStore, useRecognizedGames } from "@/stores/presence";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * DM üstündeki profil afişi + etkinlik afişi — web `directs/direct-banner-row`
 * (DirectFriendBanner + DirectActivityBanner). Afiş görseli/rengi zeminde,
 * avatar, ad, @kullanıcı adı · zamirler · ortak sunucu, hakkında; karşı
 * tarafın şu anki etkinliği (oyun, müzik, yayın) altında kart olarak.
 * Dokununca tam profil. Açık/kapalı tercihi cihazda kalıcı (web
 * `direct-profile-panel-storage` gibi, varsayılan açık); başlık menüsünden
 * değişir.
 */

const STORAGE_KEY = "ciklet.directProfileBanner";

interface BannerPref {
  open: boolean;
  loaded: boolean;
  toggle: () => void;
  load: () => void;
}

export const useDirectProfileBanner = create<BannerPref>((set, get) => ({
  open: true,
  loaded: false,
  toggle: () => {
    const open = !get().open;
    set({ open });
    void AsyncStorage.setItem(STORAGE_KEY, open ? "1" : "0").catch(() => undefined);
  },
  load: () => {
    if (get().loaded) return;
    set({ loaded: true });
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "0") set({ open: false });
      })
      .catch(() => undefined);
  },
}));

export function DirectProfileBanner({ profileId }: { profileId: string }) {
  const t = useT();
  const open = useDirectProfileBanner((s) => s.open);
  const load = useDirectProfileBanner((s) => s.load);
  useEffect(load, [load]);
  const { data } = useProfileCard(open ? profileId : undefined);
  const entry = usePresenceStore((s) => s.entries[profileId]);
  const hidden = usePresenceStore((s) => s.hidden.has(profileId));
  const recognized = useRecognizedGames();

  if (!open || !data || data.isSelf) return null;
  const profile = data.profile;
  const banner = resolveMediaUrl(profile.bannerUrl ?? null);
  const bannerColor = profile.bannerColor || colors.brand;
  const mutualServers = data.mutualServers?.length ?? 0;
  const meta = [`@${profile.username}`, profile.pronouns || null, mutualServers > 0 ? t("parityScreens.directBanner.mutualServers", { count: mutualServers }) : null].filter(
    Boolean
  ) as string[];
  const activity = hidden ? null : (visibleActivity(entry?.activity, recognized) as RichPresence | null);
  const openProfile = () => router.push(`/profile/${profileId}`);

  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.xs }}>
      <Pressable
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={t("parityScreens.directBanner.openProfile", { name: displayNameOf(profile) })}
        style={{ borderRadius: radii.lg, borderCurve: "continuous", overflow: "hidden", backgroundColor: colors.panel }}
      >
        {/* Afiş zemini: görsel bulanık, yoksa afiş rengi (web DirectFriendBannerShell). */}
        {banner ? (
          <Image source={{ uri: banner }} contentFit="cover" blurRadius={12} style={{ position: "absolute", inset: 0, opacity: 0.45 }} />
        ) : (
          <View style={{ position: "absolute", inset: 0, backgroundColor: bannerColor, opacity: 0.35 }} />
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
          <Avatar
            profileId={profile.id}
            imageUrl={profile.imageUrl}
            fallbackText={profile.username}
            decorationId={profile.avatarDecorationId ?? null}
            size={56}
            showPresence
            backgroundColor={colors.panel}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ ...typography.title, ...fw(800), color: colors.bright }} numberOfLines={1}>
              {displayNameOf(profile).toLocaleUpperCase()}
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
              {meta.join(" • ")}
            </Text>
            {profile.bio ? (
              <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={2}>
                {profile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {activity ? <ActivityStrip activity={activity} onPress={openProfile} /> : null}
    </View>
  );
}

function ActivityStrip({ activity, onPress }: { activity: RichPresence; onPress: () => void }) {
  const t = useT();
  const software = isStreamingSoftwareActivity(activity);
  const large = software ? null : resolveMediaUrl(activity.largeImageUrl);
  const logo = software ? null : resolveMediaUrl(activity.gameIconUrl) || resolveMediaUrl(activity.appIconUrl) || large;
  const label = formatActivity(activity, t);
  const title = formatActivityTitle(activity, t);
  const detail = [activity.details, activity.state].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, title, detail].filter(Boolean).join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: colors.panel,
      }}
    >
      {large ? <Image source={{ uri: large }} contentFit="cover" blurRadius={20} style={{ position: "absolute", inset: -24, opacity: 0.2 }} /> : null}
      {logo ? (
        <Image source={{ uri: logo }} contentFit="cover" style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.raised }} />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised }}>
          <Icon name="gamepad" size={20} color={colors.muted} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {label ? (
          <Text style={{ fontSize: 11, lineHeight: 14, ...fw(700), color: colors.accent }} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={{ ...typography.caption, color: colors.muted }} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
