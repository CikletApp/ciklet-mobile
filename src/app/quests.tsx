import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";

import { useQuestAction, useQuests, type QuestEntry, type QuestKind } from "@/api/hooks/use-account-privacy";
import { useStoreCatalog } from "@/api/hooks";
import { Icon, Screen, showToast, type IconName } from "@/components/ui";
import { INTL_LOCALES, useLocale, useT, type Translator } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Görevler ve Ödüller — web `components/quests/quests-view.tsx` (/gorevler).
 * İlerleme sunucuda hesaplanır; ekran açıkken dakikada bir tazelenir.
 */

const KIND_ICON: Record<QuestKind, IconName> = {
  PLAY_GAME: "gamepad",
  VOICE_TIME: "headphones",
  ACTIVITY_TIME: "sparkles",
  CREATE_SERVER: "compass",
  INVITE_FRIEND: "user-plus",
  STREAK: "trending-up",
};

const GREEN = "#23a55a";
const PURPLE = "#8b5cf6";

export function questRuleText(q: QuestEntry, t: Translator): string {
  switch (q.kind) {
    case "PLAY_GAME":
      return t("quests.kind.playGame", { game: q.targetName ?? "", minutes: q.targetValue });
    case "VOICE_TIME":
      return t("quests.kind.voice", { minutes: q.targetValue });
    case "ACTIVITY_TIME":
      return q.targetName
        ? t("quests.kind.activity", { app: q.targetName, minutes: q.targetValue })
        : t("quests.kind.activityAny", { minutes: q.targetValue });
    case "CREATE_SERVER":
      return t("quests.kind.createServer");
    case "INVITE_FRIEND":
      return t("quests.kind.inviteFriend", { count: q.targetValue });
    case "STREAK": {
      const source =
        q.streakSource === "GAME"
          ? t("quests.source.game", { game: q.targetName ?? "" })
          : q.streakSource === "ACTIVITY"
            ? t("quests.source.activity")
            : t("quests.source.voice");
      return t(q.streakUnit === "WEEK" ? "quests.kind.streakWeek" : "quests.kind.streakDay", {
        count: q.targetValue,
        minutes: q.streakMinutes ?? 0,
        source,
      });
    }
    default:
      return q.title;
  }
}

function progressLabel(q: QuestEntry, value: number, t: Translator): string {
  const vars = { value, target: q.targetValue };
  if (q.kind === "STREAK") return t(q.streakUnit === "WEEK" ? "quests.progress.weeks" : "quests.progress.days", vars);
  if (q.kind === "CREATE_SERVER" || q.kind === "INVITE_FRIEND") return t("quests.progress.count", vars);
  return t("quests.progress.minutes", vars);
}

function Chip({ label, color, icon }: { label: string; color: string; icon?: IconName }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.full,
        backgroundColor: `${color}26`,
      }}
    >
      {icon ? <Icon name={icon} size={12} color={color} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />}
      <Text style={{ ...typography.caption, fontSize: 12, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

function QuestCard({
  q,
  busy,
  itemName,
  onEnroll,
  onClaim,
}: {
  q: QuestEntry;
  busy: boolean;
  itemName: string | null;
  onEnroll: () => void;
  onClaim: () => void;
}) {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const num = (n: number) => n.toLocaleString(locale);
  const value = q.progress?.value ?? 0;
  const percent = q.progress ? Math.min(100, Math.round((value / Math.max(1, q.progress.target)) * 100)) : 0;
  const done = q.status === "completed" || q.status === "claimed";
  const icon = KIND_ICON[q.kind] ?? "flag";

  const action = (() => {
    if (q.status === "available" || q.status === "completed") {
      const claim = q.status === "completed";
      return (
        <Pressable
          disabled={busy}
          onPress={claim ? onClaim : onEnroll}
          accessibilityRole="button"
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            backgroundColor: claim ? PURPLE : colors.brand,
            opacity: busy ? 0.5 : pressed ? 0.85 : 1,
            minWidth: 72,
            alignItems: "center",
          })}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={{ ...typography.caption, fontWeight: "700", color: claim ? "#ffffff" : colors.onBrand }}>
              {t(claim ? "quests.action.claim" : "quests.action.enroll")}
            </Text>
          )}
        </Pressable>
      );
    }
    if (q.status === "claimed") {
      return <Chip label={t("quests.action.claimed")} color={GREEN} icon="check" />;
    }
    return (
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: colors.raised }}>
        <Text style={{ ...typography.caption, fontWeight: "600", color: colors.muted }}>
          {t(q.status === "enrolled" ? "quests.action.inProgress" : "quests.action.expired")}
        </Text>
      </View>
    );
  })();

  return (
    <View
      style={{
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: q.status === "completed" ? colors.brand : colors.border,
        backgroundColor: colors.panel,
        overflow: "hidden",
      }}
    >
      <View style={{ height: 88, backgroundColor: colors.brandSoft, justifyContent: "flex-end" }}>
        {q.imageUrl ? (
          <Image source={{ uri: q.imageUrl }} contentFit="cover" style={{ position: "absolute", inset: 0 }} />
        ) : (
          <View style={{ position: "absolute", right: -8, top: -8, opacity: 0.2, transform: [{ rotate: "12deg" }] }}>
            <Icon name={icon} size={96} color={colors.brand} />
          </View>
        )}
        {q.sponsorName ? (
          <View
            style={{
              position: "absolute",
              left: spacing.md,
              top: spacing.md,
              maxWidth: "70%",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radii.full,
              backgroundColor: "rgba(0,0,0,0.55)",
            }}
          >
            {q.sponsorImageUrl ? <Image source={{ uri: q.sponsorImageUrl }} style={{ width: 16, height: 16, borderRadius: 8 }} /> : null}
            <Text numberOfLines={1} style={{ ...typography.caption, fontSize: 11, fontWeight: "600", color: "#ffffff" }}>
              {t("quests.sponsor", { name: q.sponsorName })}
            </Text>
          </View>
        ) : null}
        <View
          style={{
            margin: spacing.md,
            width: 36,
            height: 36,
            borderRadius: radii.md,
            backgroundColor: colors.panel,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={20} color={colors.brand} />
        </View>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{q.title}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{questRuleText(q, t)}</Text>
          {q.description ? <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>{q.description}</Text> : null}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {q.rewardPoints > 0 ? <Chip label={t("quests.reward.points", { points: num(q.rewardPoints) })} color={colors.brand} /> : null}
          {itemName ? <Chip label={t("quests.reward.item", { name: itemName })} color={PURPLE} icon="sparkles" /> : null}
          {q.rewardMentolPlan && q.rewardMentolDays ? (
            <Chip
              label={t("quests.reward.mentol", { days: q.rewardMentolDays, plan: q.rewardMentolPlan === "PRO" ? "Pro" : "Plus" })}
              color={GREEN}
              icon="gem"
            />
          ) : null}
        </View>

        {q.progress ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...typography.caption, fontWeight: "600", color: colors.muted }}>{progressLabel(q, value, t)}</Text>
              <Text style={{ ...typography.caption, fontWeight: "600", color: done ? GREEN : colors.bright }}>%{percent}</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: q.progress.target, now: value }}
              style={{ height: 10, borderRadius: 5, backgroundColor: colors.raised, overflow: "hidden" }}
            >
              <View style={{ height: "100%", width: `${percent}%`, borderRadius: 5, backgroundColor: done ? GREEN : colors.brand }} />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
            <Icon name="clock" size={14} color={colors.muted} />
            <Text numberOfLines={1} style={{ ...typography.caption, fontSize: 11, color: colors.muted }}>
              {q.endsAt
                ? t("quests.endsAt", { date: new Date(q.endsAt).toLocaleDateString(locale, { day: "numeric", month: "short" }) })
                : t("quests.noEnd")}
            </Text>
          </View>
          {action}
        </View>
      </View>
    </View>
  );
}

type Tab = "open" | "done";

export default function QuestsScreen() {
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const quests = useQuests();
  const act = useQuestAction();
  const catalog = useStoreCatalog();
  const lang = useLocale();
  const itemName = (id: string | null) => {
    const item = id ? catalog.data?.items.find((i) => i.id === id) : null;
    return item ? (lang !== "tr" && item.nameEn ? item.nameEn : item.name) : null;
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");

  const lists = useMemo(() => {
    const all = quests.data?.quests ?? [];
    return {
      open: all.filter((q) => q.status !== "claimed" && q.status !== "expired"),
      done: all.filter((q) => q.status === "claimed" || q.status === "expired"),
    };
  }, [quests.data]);

  const run = (q: QuestEntry, action: "enroll" | "claim") => {
    if (busy) return;
    setBusy(q.id);
    act.mutate(
      { questId: q.id, action },
      {
        onSuccess: (res) => {
          if (action === "enroll") showToast(t("quests.toast.enrolled"));
          else if (res?.status === "already_claimed") showToast(t("quests.toast.alreadyClaimed"));
          else if (res?.itemAlreadyOwned) showToast(t("quests.toast.itemOwned"));
          else showToast(t("quests.toast.claimed"));
        },
        onError: (error) =>
          showToast(userErrorMessage(error, t("quests.toast.failed")), "error"),
        onSettled: () => setBusy(null),
      }
    );
  };

  const data = quests.data;
  const shown = lists[tab];

  return (
    <Screen>
      <Stack.Screen options={{ title: t("quests.title") }} />
      {!data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
          {quests.isError ? null : <ActivityIndicator color={colors.brand} />}
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {quests.isError ? t("quests.loadError") : t("quests.loading")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}
          refreshControl={<RefreshControl refreshing={quests.isRefetching} onRefresh={() => void quests.refetch()} tintColor={colors.brand} />}
        >
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("quests.subtitle")}</Text>

          {/* Bakiye kartı */}
          <View
            style={{
              borderRadius: radii.xl,
              borderCurve: "continuous",
              padding: spacing.lg,
              backgroundColor: colors.brand,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              overflow: "hidden",
            }}
          >
            <View style={{ position: "absolute", right: -24, top: -24, width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.15)" }} />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#f9a8d4", borderWidth: 4, borderColor: "rgba(255,255,255,0.25)" }} />
            <View>
              <Text style={{ ...typography.overline, color: colors.onBrand, opacity: 0.8 }}>{t("quests.balance").toLocaleUpperCase()}</Text>
              <Text style={{ ...typography.display, color: colors.onBrand }}>
                {data.balance.toLocaleString(locale)} <Text style={{ ...typography.caption, fontWeight: "700" }}>{t("quests.unit")}</Text>
              </Text>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.onBrand, opacity: 0.75 }}>
                {t("quests.lifetime", { points: data.lifetimeEarned.toLocaleString(locale) })}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border }}>
            <Icon name="help" size={16} color={colors.brand} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }}>{t("quests.disclaimer")}</Text>
              <Pressable onPress={() => router.push("/store")} accessibilityRole="link" style={{ alignSelf: "flex-start" }}>
                <Text style={{ ...typography.caption, fontWeight: "700", color: colors.brand }}>{t("quests.goStore")}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["open", "done"] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 6,
                  borderRadius: radii.full,
                  backgroundColor: tab === key ? colors.brand : colors.raised,
                }}
              >
                <Text style={{ ...typography.caption, fontWeight: "600", color: tab === key ? colors.onBrand : colors.muted }}>
                  {t(key === "open" ? "quests.tabs.open" : "quests.tabs.done")}  {lists[key].length}
                </Text>
              </Pressable>
            ))}
          </View>

          {shown.length === 0 ? (
            <View style={{ padding: spacing["2xl"], borderRadius: radii.xl, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border }}>
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>{t("quests.empty")}</Text>
            </View>
          ) : (
            shown.map((q) => (
              <QuestCard key={q.id} q={q} busy={busy === q.id} itemName={itemName(q.rewardItemId)} onEnroll={() => run(q, "enroll")} onClaim={() => run(q, "claim")} />
            ))
          )}

          <View style={{ padding: spacing.lg, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, gap: spacing.xs }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{t("quests.how.title")}</Text>
            {(["enroll", "game", "voice", "once"] as const).map((k) => (
              <Text key={k} style={{ ...typography.caption, color: colors.muted }}>
                • {t(`quests.how.${k}`)}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
