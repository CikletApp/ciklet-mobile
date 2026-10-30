import { FlatList, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { commandPaths, localize, pathOptions } from "../app-commands";
import { flattenSlashCommands, type SlashBot, type SlashCommandEntry } from "../interactions";

/**
 * "/" komut listesi (Discord gibi; web ile aynı): bot avatarı, `/ad`
 * (alt komutlar DÜZLEŞTİRİLMİŞ girişler: `/ad grup alt`), yerelleştirilmiş
 * açıklama, sağda bot adı. Başlık "Komutlar". Yazdıkça ad başına göre
 * süzülür (varsayılan ya da yerel ada göre).
 *
 * Seçilen giriş yazı kutusunu komut kipine sokar (bkz. command-mode.tsx).
 */

export interface CommandMatch {
  key: string;
  entry: SlashCommandEntry;
  /** Alt komut yolu: [] | ["alt"] | ["grup", "alt"]. */
  path: string[];
  /** Ekranda görünen `ad grup alt` (yerel adlarla). */
  label: string;
  description: string;
}

/** Taslak "/" ile başlıyorsa süzülmüş düzleştirilmiş girişler. */
export function matchCommands(bots: SlashBot[], draft: string, locale: string): CommandMatch[] {
  if (!draft.startsWith("/") || draft.includes("\n")) return [];
  const query = draft.slice(1).toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trimStart();
  const matches: CommandMatch[] = [];
  for (const entry of flattenSlashCommands(bots)) {
    const { command } = entry;
    for (const path of commandPaths(command)) {
      const chain = pathOptions(command, path);
      const base = [command.name, ...chain.map((o) => o.name)].join(" ");
      const label = [
        localize(command.name, command.name_localizations, locale),
        ...chain.map((o) => localize(o.name, o.name_localizations, locale)),
      ].join(" ");
      if (!base.startsWith(query) && !label.toLocaleLowerCase("tr-TR").startsWith(query)) continue;
      const leaf = chain[chain.length - 1];
      const description = leaf
        ? localize(leaf.description, leaf.description_localizations, locale)
        : localize(command.description, command.description_localizations, locale);
      matches.push({ key: `${entry.bot.id}:${command.id}:${path.join(" ")}`, entry, path, label, description });
    }
  }
  return matches;
}

/** Yazma çubuğunun hemen üstünde, mesajların üzerinde yüzen öneri listesi. */
export function CommandSuggestions({
  matches,
  onPick,
}: {
  matches: CommandMatch[];
  onPick: (match: CommandMatch) => void;
}) {
  const t = useT();
  return (
    <FloatingList>
      <FlatList
        data={matches}
        keyExtractor={(match) => match.key}
        // Klavye açıkken ilk dokunuş klavyeyi kapatmakla harcanmasın.
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingBottom: spacing.xs }}
        ListHeaderComponent={<ListHeader title={t("appCommands.commands")} />}
        stickyHeaderIndices={[0]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityLabel={`/${item.label}, ${item.entry.bot.name}: ${item.description}`}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 52,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            <Avatar imageUrl={item.entry.bot.imageUrl} fallbackText={item.entry.bot.name} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ ...typography.body, ...fw(700), color: colors.bright }}>
                /{item.label}
              </Text>
              {item.description ? (
                <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: colors.muted, maxWidth: "35%" }}>
              {item.entry.bot.name}
            </Text>
          </Pressable>
        )}
      />
    </FloatingList>
  );
}

/** Yazma çubuğunun hemen üstünde yüzen kart (komut ve seçici listeleri). */
export function FloatingList({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        position: "absolute",
        left: spacing.sm,
        right: spacing.sm,
        bottom: spacing.xs,
        maxHeight: 300,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
        boxShadow: `0 8px 24px ${colors.shadow}`,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

/** Listenin küçük büyük harfli başlığı ("Komutlar", "İsteğe bağlı"). */
export function ListHeader({ title }: { title: string }) {
  const locale = useLocale();
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, backgroundColor: colors.panel }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{title.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}</Text>
    </View>
  );
}
