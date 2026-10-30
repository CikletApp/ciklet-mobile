import { useMemo } from "react";
import { Text, View } from "react-native";

import { Avatar, Pressable, showToast, type ActionSheetItem } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { localize } from "./app-commands";
import {
  contextMenuCommands,
  runContextMenuCommand,
  silentNotice,
  useAppCommands,
  waitForAck,
  type SlashCommandEntry,
} from "./interactions";

/**
 * Kullanıcı bağlam menüsü komutları (USER, type 2) — üye eylem sayfası ve
 * profil sayfasındaki "Uygulamalar" bölümü (web: kullanıcı bağlam menüsü
 * ve profil kartı). Komut, sohbetin (`chatId`: kanal ya da botla DM)
 * bağlamında hedefin PROFİL kimliğiyle çalışır. Komut yoksa bölüm yok.
 */
export function useUserApps(chatId: string | undefined): SlashCommandEntry[] {
  const query = useAppCommands(chatId);
  return useMemo(() => contextMenuCommands(query.data ?? [], 2), [query.data]);
}

export function runUserApp(chatId: string, entry: SlashCommandEntry, targetId: string): void {
  void runContextMenuCommand(chatId, entry, targetId).then((result) => {
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    void waitForAck(chatId, result.id).then((silent) => {
      if (silent) showToast(silentNotice(entry.bot.name));
    });
  });
}

/** Eylem sayfası öğeleri: başlık + her komut (bot avatarı + yerel ad). */
export function useUserAppSheetItems(
  chatId: string | undefined,
  targetId: string | undefined
): (ActionSheetItem | { heading: string })[] {
  const apps = useUserApps(chatId);
  const t = useT();
  const locale = useLocale();
  if (!chatId || !targetId || apps.length === 0) return [];
  return [
    { heading: t("appCommands.apps").toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US") },
    ...apps.map((app) => ({
      key: `app-${app.bot.id}-${app.command.id}`,
      label: localize(app.command.name, app.command.name_localizations, locale),
      detail: app.bot.name,
      icon: "sparkles" as const,
      avatar: { imageUrl: app.bot.imageUrl, fallbackText: app.bot.name },
      onPress: () => runUserApp(chatId, app, targetId),
    })),
  ];
}

/** Profil sayfasındaki "Uygulamalar" kartı. */
export function UserAppsCard({ chatId, targetId }: { chatId: string | undefined; targetId: string }) {
  const apps = useUserApps(chatId);
  const t = useT();
  const locale = useLocale();
  if (!chatId || apps.length === 0) return null;
  return (
    <View style={{ backgroundColor: colors.panel, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>
        {t("appCommands.apps").toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
      </Text>
      {apps.map((app) => {
        const label = localize(app.command.name, app.command.name_localizations, locale);
        return (
          <Pressable
            key={`${app.bot.id}:${app.command.id}`}
            onPress={() => runUserApp(chatId, app, targetId)}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${app.bot.name}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 48,
              marginHorizontal: -spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            <Avatar imageUrl={app.bot.imageUrl} fallbackText={app.bot.name} size={28} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ ...typography.body, color: colors.bright }}>
                {label}
              </Text>
              <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>
                {app.bot.name}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
