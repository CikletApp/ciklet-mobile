import { FlatList, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Avatar } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kanalda "/" komut önerileri (Telegram'daki bot komut listesi).
 *
 * Komutlar düz mesaj olarak gönderilir; botlar mesajı okuyup yanıtlıyor.
 * Burada yalnızca yazmayı kolaylaştıran öneri listesi var.
 */

export interface BotCommand {
  /** "/" OLMADAN; [a-z0-9_-], en çok 32. */
  name: string;
  description: string;
}

export interface CommandBot {
  /** Botun profil kimliği. */
  id: string;
  applicationId: string;
  /** Görünen ad. */
  name: string;
  username: string;
  imageUrl: string | null;
  commands: BotCommand[];
}

export interface CommandMatch {
  key: string;
  bot: CommandBot;
  command: BotCommand;
}

/**
 * Kanaldaki botların komutları. Uç henüz her ortamda yayında değil: 404
 * (ya da 401/403) ve boş liste "öneri yok" demek — "/" düğmesi hiç
 * görünmez, hata gösterilmez.
 */
export function useBotCommands(serverId: string | undefined, channelId: string | undefined) {
  return useQuery({
    queryKey: ["bot-commands", serverId, channelId],
    enabled: Boolean(serverId && channelId),
    queryFn: async (): Promise<CommandBot[]> => {
      try {
        const data = await api<{ bots?: CommandBot[] }>(endpoints.botCommands(serverId ?? "", channelId ?? ""));
        return (data.bots ?? []).filter((bot) => Array.isArray(bot.commands) && bot.commands.length > 0);
      } catch (reason) {
        if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) return [];
        throw reason;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Taslak "/" ile başlıyor ve henüz boşluk yoksa (komut adı yazılıyor) ada
 * göre süzülmüş öneriler. Aynı adı taşıyan iki botun komutu ayrı ayrı
 * listelenir; hangisi olduğu avatar ve addan anlaşılır.
 */
export function matchCommands(bots: CommandBot[], draft: string): CommandMatch[] {
  if (!draft.startsWith("/") || /\s/.test(draft)) return [];
  const prefix = draft.slice(1).toLowerCase();
  const matches: CommandMatch[] = [];
  for (const bot of bots) {
    for (const command of bot.commands) {
      if (command.name.toLowerCase().startsWith(prefix)) {
        matches.push({ key: `${bot.id}:${command.name}`, bot, command });
      }
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
  onPick: (command: string) => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: spacing.sm,
        right: spacing.sm,
        bottom: spacing.xs,
        maxHeight: 272,
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
        boxShadow: `0 8px 24px ${colors.shadow}`,
        overflow: "hidden",
      }}
    >
      <FlatList
        data={matches}
        keyExtractor={(match) => match.key}
        // Klavye açıkken ilk dokunuş klavyeyi kapatmakla harcanmasın.
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingVertical: spacing.xs }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item.command.name)}
            accessibilityRole="button"
            accessibilityLabel={`/${item.command.name}, ${item.bot.name}: ${item.command.description}`}
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
            <Avatar imageUrl={item.bot.imageUrl} fallbackText={item.bot.name} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                <Text numberOfLines={1} style={{ ...typography.body, ...fw(700), color: colors.bright, flexShrink: 1 }}>
                  /{item.command.name}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, color: colors.muted, flexShrink: 1 }}>
                  {item.bot.name}
                </Text>
              </View>
              {item.command.description ? (
                <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>
                  {item.command.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
