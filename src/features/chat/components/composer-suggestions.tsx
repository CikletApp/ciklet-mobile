import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import { useMemberSearch } from "@/api/hooks";
import { Avatar, Icon } from "@/components/ui";
import { useDebouncedValue } from "@/lib/use-debounced";
import { fw } from "@/theme/fonts";
import { readable } from "@/theme/palette";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { BROADCAST_LABEL, formatCustomEmoji } from "../message-markup";
import { usableEmojis, useCanMentionEveryone, useServerEmojis, useServerRoles } from "../server-assets";

/**
 * Yazarken açılan öneri listesi — ciklet-web editörünün `@` ve `:`
 * önerileri:
 *  • `@ad`  → üyeler; izin varsa @herkes, @burada ve roller (MENTION_EVERYONE
 *    ya da moderatör+; web `canBroadcastMention`).
 *  • `:ad`  → sunucu emojileri (en az iki harf).
 *
 * Rol ve sunucu emojisi yazı kutusunda OKUNUR biçimde durur (`@Moderatör`,
 * `:kedi:`); gönderimde belirtece çevrilir (`<@&id>`, `<:kedi:id>`) — bkz.
 * `encodeComposerTokens`. Kutu satır içi pil/görsel taşıyamıyor; ham
 * belirteç yazmak kullanıcıya anlamsız bir kimlik gösterirdi.
 */

export interface ComposerSuggestion {
  key: string;
  kind: "member" | "broadcast" | "role" | "emoji";
  label: string;
  detail?: string;
  imageUrl?: string | null;
  color?: string | null;
  /** Yazı kutusuna giren metin (sonuna boşluk eklenir). */
  insert: string;
  /** Rol önerisi: gönderimde `@ad` → `<@&id>`. */
  roleId?: string;
}

export interface SuggestionTrigger {
  char: "@" | ":";
  query: string;
  /** Tetikleyicinin metindeki başlangıcı (`@`/`:` dahil). */
  start: number;
  end: number;
}

const MAX_ITEMS = 8;

/** İmlecin solundaki sözcük `@…` ya da `:…` ile başlıyorsa tetikleyici. */
export function findSuggestionTrigger(text: string, caret: number): SuggestionTrigger | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)([@:])([0-9A-Za-z_.ğüşıöçĞÜŞİÖÇ]*)$/.exec(before);
  if (!match) return null;
  const char = match[2] as "@" | ":";
  const query = match[3];
  if (char === ":" && query.length < 2) return null;
  return { char, query, start: caret - query.length - 1, end: caret };
}

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

export function useComposerSuggestions(
  trigger: SuggestionTrigger | null,
  serverId: string | undefined
): ComposerSuggestion[] {
  const active = Boolean(trigger && serverId);
  const roles = useServerRoles(active ? serverId : undefined);
  // Role özel olup rolü olmadığın emojiler önerilmez (Discord).
  const emojis = usableEmojis(useServerEmojis(active ? serverId : undefined));
  const canBroadcast = useCanMentionEveryone(active ? serverId : undefined);
  // Üyeler sunucuda aranır (yalnızca ilk sayfayı süzmek büyük sunucuda
  // çoğu üyeyi önerilemez bırakıyordu); yazarken her harfte istek atılmaz.
  const mentionQuery = useDebouncedValue(trigger?.char === "@" ? trigger.query : "", 250);
  const members = useMemberSearch(active && trigger?.char === "@" ? serverId : undefined, mentionQuery);

  return useMemo(() => {
    if (!trigger || !serverId) return [];
    const q = fold(trigger.query);
    if (trigger.char === ":") {
      return emojis
        .filter((emoji) => fold(emoji.name).includes(q))
        .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)))
        .slice(0, MAX_ITEMS)
        .map((emoji) => ({
          key: `e-${emoji.id}`,
          kind: "emoji" as const,
          label: `:${emoji.name}:`,
          imageUrl: emoji.imageUrl,
          insert: `:${emoji.name}:`,
        }));
    }

    const out: ComposerSuggestion[] = [];
    for (const member of members.data ?? []) {
      const profile = member.profile;
      const nickname = (member as { nickname?: string | null }).nickname?.trim();
      const display = nickname || profile.name?.trim() || profile.username;
      if (!fold(profile.username).startsWith(q) && !fold(display).includes(q)) continue;
      out.push({
        key: `m-${member.id}`,
        kind: "member",
        label: display,
        detail: `@${profile.username}`,
        imageUrl: profile.imageUrl,
        insert: `@${profile.username}`,
      });
      if (out.length >= MAX_ITEMS) break;
    }
    if (canBroadcast) {
      for (const kind of ["everyone", "here"] as const) {
        const label = BROADCAST_LABEL[kind];
        if (!label.startsWith(q) && !kind.startsWith(q)) continue;
        out.push({
          key: `b-${kind}`,
          kind: "broadcast",
          label: `@${label}`,
          detail: kind === "everyone" ? "Kanaldaki herkese bildirim" : "Çevrimiçi olanlara bildirim",
          insert: `@${label}`,
        });
      }
    }
    // Roller: izinle hepsi, izinsiz yalnızca "bahsedilebilir" olanlar (web
    // `canMentionRole`, sunucu lib/mentions ile aynı kural).
    for (const role of roles) {
      if (!canBroadcast && !role.mentionable) continue;
      if (role.name === "@everyone" || !fold(role.name).includes(q)) continue;
      out.push({
        key: `r-${role.id}`,
        kind: "role",
        label: `@${role.name}`,
        detail: "Rol",
        color: role.color,
        insert: `@${role.name}`,
        roleId: role.id,
      });
      if (out.length >= MAX_ITEMS * 2) break;
    }
    return out;
  }, [trigger, serverId, emojis, members.data, canBroadcast, roles]);
}

/**
 * Gönderim öncesi okunur yazımı belirtece çevirir: seçilmiş rol adları
 * `<@&id>`, sunucu emojisi adları `<:ad:id>`. Kod blokları ve satır içi kod
 * dokunulmaz.
 */
export function encodeComposerTokens(
  text: string,
  roles: Map<string, string>,
  emojis: { id: string; name: string }[]
): string {
  if (roles.size === 0 && emojis.length === 0) return text;
  const byName = new Map(emojis.map((emoji) => [emoji.name, emoji]));
  // Uzun rol adı önce: "@Mod" "@Moderatör"ün içini yemesin.
  const roleNames = [...roles.keys()].sort((a, b) => b.length - a.length);
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      let out = part;
      for (const name of roleNames) {
        // Ad bir kullanıcı adının başı olabilir ("@Mod" / "@Moderatör"):
        // yalnızca ardından harf gelmiyorsa çevrilir.
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`@${escaped}(?![\\wğüşıöçĞÜŞİÖÇ])`, "g"), `<@&${roles.get(name)}>`);
      }
      return out.replace(/(^|[^<\w]):([A-Za-z0-9_]{2,32}):/g, (whole, lead: string, name: string) => {
        const emoji = byName.get(name);
        return emoji ? `${lead}${formatCustomEmoji(emoji)}` : whole;
      });
    })
    .join("");
}

/** Yazma çubuğunun hemen üstünde yüzen öneri listesi (komut önerileriyle aynı yer). */
export function ComposerSuggestions({
  items,
  onPick,
}: {
  items: ComposerSuggestion[];
  onPick: (item: ComposerSuggestion) => void;
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
        data={items}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingVertical: spacing.xs }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityLabel={item.detail ? `${item.label}, ${item.detail}` : item.label}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: 46,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            {item.kind === "member" ? (
              <Avatar imageUrl={item.imageUrl ?? null} fallbackText={item.label} size={28} />
            ) : item.kind === "emoji" && item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} contentFit="contain" style={{ width: 28, height: 28 }} />
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.raised,
                }}
              >
                <Icon name={item.kind === "broadcast" ? "users" : "shield"} size={15} color={colors.muted} />
              </View>
            )}
            <Text
              numberOfLines={1}
              style={{
                ...typography.body,
                ...fw(600),
                flexShrink: 1,
                color:
                  item.kind === "role" && item.color && /^#[0-9a-f]{6}$/i.test(item.color)
                    ? readable(item.color, colors.panel)
                    : colors.bright,
              }}
            >
              {item.label}
            </Text>
            {item.detail ? (
              <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
                {item.detail}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
