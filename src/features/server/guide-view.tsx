import { Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle } from "react-native-svg";

import { ApiError } from "@/api/client";
import { useToggleGuideTask } from "@/api/hooks";
import { Avatar, EmojiText, Icon, Pressable, showToast, type IconName } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { withAlpha } from "@/theme/palette";
import type { GuideItemView, GuideView } from "@/lib/server-guide";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Rehberi gövdesi — web `server-guide-view.tsx` karşılığı: afişli
 * karşılama, ilerleme çubuklu yapılacaklar ve kaynak kartları. `preview`
 * verilirse (Sunucu Ayarları önizlemesi) hiçbir şey tıklanmaz, istek atılmaz.
 * İlerleme rehber sorgusunun önbelleğinde (iyimser işaretleme).
 */

const CHANNEL_ICONS: Record<GuideItemView["channelType"], IconName> = { TEXT: "hash", AUDIO: "mic", VIDEO: "video" };

type GuideBody = Pick<GuideView, "welcomeTitle" | "welcomeMessage" | "bannerUrl" | "tasks" | "resources" | "completed">;

/** Tema rengine saydamlık (`hsl(...)` ya da `#rrggbb`). */
function tint(color: string, alpha: number): string {
  if (color.startsWith("hsl(")) return color.replace("hsl(", "hsla(").replace(/\)$/, `, ${alpha})`);
  if (/^#[0-9a-f]{6}$/i.test(color)) return withAlpha(color, alpha);
  return color;
}

const cardStyle = {
  borderRadius: radii.bentoWrapper,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.bentoBorder,
  backgroundColor: colors.panel,
};

export function ServerGuideBody({
  serverId,
  serverName,
  serverImageUrl,
  guide,
  preview = false,
  onOpenChannel,
}: {
  serverId: string;
  serverName: string;
  serverImageUrl: string | null;
  guide: GuideBody;
  preview?: boolean;
  onOpenChannel?: (channelId: string) => void;
}) {
  const t = useT();
  const toggleTask = useToggleGuideTask(serverId);
  const completed = guide.completed;

  const total = guide.tasks.length;
  const done = guide.tasks.filter((task) => completed.includes(task.id)).length;
  const finished = total > 0 && done === total;

  const open = (channelId: string) => {
    if (!preview) onOpenChannel?.(channelId);
  };

  const toggle = (taskId: string) => {
    if (preview || toggleTask.isPending) return;
    toggleTask.mutate(
      { taskId, done: !completed.includes(taskId) },
      { onError: (error) => showToast(error instanceof ApiError ? error.message : t("serverGuide.page.saveFailed"), "error") }
    );
  };

  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      {/* ── Karşılama ── */}
      <View style={{ ...cardStyle, overflow: "hidden" }}>
        <View style={{ height: 144, backgroundColor: colors.brandSoft }}>
          {guide.bannerUrl ? (
            <Image source={{ uri: guide.bannerUrl }} contentFit="cover" style={{ position: "absolute", inset: 0 }} />
          ) : (
            // Afiş yoksa marka renginden yumuşak zemin + pusula filigranı (web ile aynı fikir).
            <View style={{ position: "absolute", right: -24, top: -24, opacity: 0.12 }}>
              <Icon name="compass" size={180} color={colors.brand} />
            </View>
          )}
        </View>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.md, marginTop: -36 }}>
            <View style={{ borderRadius: 22, borderCurve: "continuous", borderWidth: 4, borderColor: colors.panel, overflow: "hidden" }}>
              <Avatar imageUrl={serverImageUrl} fallbackText={serverName} size={72} radius={0} backgroundColor={colors.brand} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: spacing.xs,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radii.full,
                backgroundColor: colors.brandSoft,
              }}
            >
              <Icon name="compass" size={13} color={colors.brand} />
              <Text style={{ ...typography.overline, fontSize: 11, color: colors.brand }}>{t("serverGuide.title").toLocaleUpperCase()}</Text>
            </View>
          </View>
          <EmojiText style={{ ...typography.displayLg, ...fw(800), color: colors.bright, marginTop: spacing.lg }}>
            {guide.welcomeTitle || t("serverGuide.page.defaultWelcome", { server: serverName })}
          </EmojiText>
          {guide.welcomeMessage ? (
            <EmojiText style={{ ...typography.body, color: colors.text, marginTop: spacing.sm }}>{guide.welcomeMessage}</EmojiText>
          ) : null}
        </View>
      </View>

      {/* ── Yapılacaklar ── */}
      {total > 0 ? (
        <View style={{ ...cardStyle, padding: spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>{t("serverGuide.page.tasksTitle")}</Text>
              <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>
                {finished ? t("serverGuide.page.tasksFinished") : t("serverGuide.page.tasksHint")}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
                borderRadius: radii.full,
                backgroundColor: finished ? tint(colors.success, 0.15) : colors.raised,
              }}
            >
              {finished ? (
                <Icon name="sparkles" size={16} color={colors.success} />
              ) : (
                <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>{t("serverGuide.page.progress", { done, total })}</Text>
              )}
            </View>
          </View>
          <View style={{ height: 6, marginTop: spacing.lg, borderRadius: 3, overflow: "hidden", backgroundColor: colors.raised }}>
            <View style={{ height: "100%", width: `${(done / total) * 100}%`, borderRadius: 3, backgroundColor: finished ? colors.success : colors.brand }} />
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {guide.tasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                done={completed.includes(task.id)}
                busy={toggleTask.isPending && toggleTask.variables?.taskId === task.id}
                onToggle={() => toggle(task.id)}
                onOpen={() => open(task.channelId)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Kaynaklar ── */}
      {guide.resources.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xs }}>
            <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>{t("serverGuide.page.resourcesTitle")}</Text>
            <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>{t("serverGuide.page.resourcesHint")}</Text>
          </View>
          {guide.resources.map((resource) => (
            <Pressable
              key={resource.id}
              onPress={() => open(resource.channelId)}
              disabled={preview}
              accessibilityRole="button"
              accessibilityLabel={resource.title}
              style={({ pressed }) => ({
                ...cardStyle,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.md,
                padding: spacing.lg,
                backgroundColor: pressed ? colors.raised : colors.panel,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
                {resource.emoji ? <EmojiText style={{ fontSize: 22, lineHeight: 28 }}>{resource.emoji}</EmojiText> : <Icon name="compass" size={20} color={colors.brand} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <EmojiText style={{ ...typography.bodyStrong, ...fw(700), color: colors.bright, flexShrink: 1 }} numberOfLines={1}>
                    {resource.title}
                  </EmojiText>
                  <Icon name="arrow-up-right" size={15} color={colors.muted} />
                </View>
                {resource.description ? (
                  <Text style={{ ...typography.caption, color: colors.muted, marginTop: 4 }} numberOfLines={3}>
                    {resource.description}
                  </Text>
                ) : null}
                <ChannelChip item={resource} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChannelChip({ item }: { item: Pick<GuideItemView, "channelName" | "channelType"> }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        marginTop: spacing.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: colors.raised,
        maxWidth: "100%",
      }}
    >
      <Icon name={CHANNEL_ICONS[item.channelType] ?? "hash"} size={12} color={colors.muted} />
      <EmojiText style={{ ...typography.caption, fontSize: 12, ...fw(600), color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
        {item.channelName}
      </EmojiText>
    </View>
  );
}

function TaskRow({
  task,
  index,
  done,
  busy,
  onToggle,
  onOpen,
}: {
  task: GuideItemView;
  index: number;
  done: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const t = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: done ? tint(colors.success, 0.25) : colors.border,
        backgroundColor: done ? tint(colors.success, 0.06) : "transparent",
      }}
    >
      <Pressable
        onPress={onToggle}
        disabled={busy}
        haptic="light"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, busy }}
        accessibilityLabel={done ? t("serverGuide.page.markUndone") : t("serverGuide.page.markDone")}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
          borderColor: done ? colors.success : colors.border,
          backgroundColor: done ? colors.success : "transparent",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {done ? <Icon name="check" size={16} color="#ffffff" /> : <Text style={{ ...typography.caption, ...fw(700), color: colors.muted }}>{index + 1}</Text>}
      </Pressable>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint={t("serverGuide.page.goToChannel")} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        {task.emoji ? <EmojiText style={{ fontSize: 20, lineHeight: 26 }}>{task.emoji}</EmojiText> : null}
        <View style={{ flex: 1 }}>
          <EmojiText
            style={{
              ...typography.bodyStrong,
              color: done ? colors.muted : colors.bright,
              textDecorationLine: done ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {task.title}
          </EmojiText>
          {task.description ? <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>{task.description}</Text> : null}
          <ChannelChip item={task} />
        </View>
        <Icon name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/**
 * Kanal listesinin en üstündeki "Sunucu Rehberi" girişi (web
 * `server-guide-entry.tsx`): yapılacak varsa sağda ilerleme halkası, hepsi
 * bitince onay işareti.
 */
export function GuideEntryRow({ taskIds, completed, onPress }: { taskIds: string[]; completed: string[]; onPress: () => void }) {
  const t = useT();
  const total = taskIds.length;
  const done = taskIds.filter((id) => completed.includes(id)).length;
  const finished = total > 0 && done === total;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t("serverGuide.title")}
      accessibilityHint={total > 0 ? (finished ? t("serverGuide.sidebar.finished") : t("serverGuide.sidebar.progress", { done, total })) : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginHorizontal: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
      })}
    >
      <Icon name="compass" size={19} color={colors.muted} />
      <Text style={{ ...typography.body, ...fw(600), color: colors.text, flex: 1 }} numberOfLines={1}>
        {t("serverGuide.title")}
      </Text>
      {total > 0 ? (
        finished ? (
          <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.success }}>
            <Icon name="check" size={12} color="#ffffff" />
          </View>
        ) : (
          <ProgressRing done={done} total={total} />
        )
      ) : null}
    </Pressable>
  );
}

/** Küçük ilerleme halkası (18px). */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={9} cy={9} r={r} fill="none" strokeWidth={2.5} stroke={colors.border} />
      <Circle
        cx={9}
        cy={9}
        r={r}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        stroke={colors.brand}
      />
    </Svg>
  );
}
