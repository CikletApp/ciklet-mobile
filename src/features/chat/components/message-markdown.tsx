import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { Text, View, type TextStyle } from "react-native";
import { Image } from "expo-image";

import { openGuardedLink } from "@/lib/external-link";
import { emojify, emojiSizeFor } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { readable, withAlpha } from "@/theme/palette";
import { useChatScope } from "../chat-scope";
import {
  BROADCAST_LABEL,
  CUSTOM_EMOJI_SOURCE,
  MENTION_SOURCE,
  ROLE_MENTION_SOURCE,
  TIMESTAMP_SOURCE,
  broadcastKindOf,
  formatTimestamp,
  type BroadcastKind,
  type TimestampStyle,
} from "../message-markup";
import { useServerEmojis, useServerRoles, type ServerEmojiLite, type ServerRoleLite } from "../server-assets";
import { CodeBlock } from "./code-block";

/**
 * Yalnızca emojiden oluşan mesajın boyu: `jumbo` 1–3 emoji (balonsuz),
 * `large` 4–8 emoji. Satır yüksekliği emojiye göre seçilir ki görsel
 * satıra sığsın (bkz. `emojiSizeFor`); yazı boyu küçük kalır, yalnızca
 * emojiler arasındaki boşluk ona göre ölçülür.
 */
export type EmojiScale = "jumbo" | "large";

const EMOJI_SCALES: Record<EmojiScale, { emoji: number; text: TextStyle }> = {
  jumbo: { emoji: 48, text: { fontSize: 16, lineHeight: 56 } },
  large: { emoji: 30, text: { fontSize: 15, lineHeight: 38 } },
};

/**
 * Mesaj metni: gövde yazısından bir tık ferah satır (15/22). 22'lik satırda
 * 16'lık emoji iniş payıyla birlikte sığar; 21'de Android'de tepeden kesiliyordu.
 */
const MESSAGE_TEXT: TextStyle = { fontSize: typography.body.fontSize, lineHeight: 22 };

interface MessageMarkdownProps {
  value: string;
  style?: TextStyle;
  compact?: boolean;
  /** Metin rengi (balonun kendi okunur rengi); verilmezse gövde rengi. */
  color?: string;
  emojiScale?: EmojiScale;
  /**
   * Son satırın sonuna eklenen görünmez yer tutucu metni (bkz. message-item
   * `metaSpacerText`) — balonun sağ alt köşesine binen saat metnin üstüne
   * gelmesin (WhatsApp/Telegram). Son blok kod bloğuysa yer tutucu kendi
   * satırında durur. Düz metin: ezberlenen çizimi her seferinde bozmasın.
   */
  trailing?: string;
}

type InlineStyle = Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle" | "textDecorationLine">;

/**
 * Biçim stilleri İSTEK ANINDA üretilir: kalın yüz uygulama fontu seçildikten
 * sonra belli oluyor (bkz. `fw`); modül yüklenirken hesaplansaydı kalın
 * metin sistem fontuna düşerdi.
 */
const FORMATS: { open: string; close: string; style: () => InlineStyle }[] = [
  { open: "***", close: "***", style: () => ({ ...fw(700), fontStyle: "italic" }) },
  { open: "___", close: "___", style: () => ({ ...fw(700), fontStyle: "italic", textDecorationLine: "underline" }) },
  { open: "**", close: "**", style: () => ({ ...fw(700) }) },
  { open: "__", close: "__", style: () => ({ textDecorationLine: "underline" }) },
  { open: "~~", close: "~~", style: () => ({ textDecorationLine: "line-through" }) },
  { open: "*", close: "*", style: () => ({ fontStyle: "italic" }) },
];

/** Satır içi çizimin ihtiyaç duyduğu, mesajdan bağımsız bilgiler. */
interface InlineContext {
  revealed: Set<string>;
  toggleSpoiler: (key: string) => void;
  emojiSize: number;
  customEmojiSize: number;
  roles: ServerRoleLite[];
  emojis: ServerEmojiLite[];
  myUsername: string | undefined;
}

/**
 * Web sohbetindeki güvenli Markdown alt kümesi. HTML hiçbir zaman
 * yorumlanmaz; biçimler yalnız native Text düğümlerine çevrilir. Web'in
 * küçük işaretleri de burada: `<t:unix:stil>` zaman damgası, `-# ` alt
 * metin, `@herkes`/`@burada`/`<@&rol>` pilleri, `<:ad:id>` sunucu emojisi.
 */
export function MessageMarkdown({ value, style, compact = false, color, emojiScale, trailing }: MessageMarkdownProps) {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const blocks = useMemo(() => splitBlocks(value), [value]);
  const scope = useChatScope();
  const roles = useServerRoles(scope?.serverId);
  const emojis = useServerEmojis(scope?.serverId);
  const myUsername = useAuth((s) => s.profile?.username);
  const scale = emojiScale ? EMOJI_SCALES[emojiScale] : null;
  // Emojiler Twemoji görseli (lib/emoji.ts). Boyut satır yüksekliğine göre
  // sınırlanır; sunucu emojisi de aynı boyda (eskiden 1.25 katıydı ve
  // satırdan taşıp kesiliyordu).
  const emojiSize = scale ? scale.emoji : emojiSizeFor({ ...MESSAGE_TEXT, ...style }, typography.body.fontSize);

  const toggleSpoiler = useCallback((key: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Satır içi ayrıştırma pahalı (her belirteç için düzenli ifade taraması);
  // yalnızca girdiler değişince yeniden kurulur — sohbet ekranının başka
  // nedenlerle (yazma, imleç) yeniden çizilmesi bunu tetiklemez.
  const rendered = useMemo(() => {
    const ctx: InlineContext = {
      revealed,
      toggleSpoiler,
      emojiSize,
      customEmojiSize: emojiSize,
      roles,
      emojis,
      myUsername,
    };
    const textColor = color ?? colors.text;
    const last = blocks.length - 1;
    const spacer = trailing ? <InvisibleSpacer text={trailing} /> : null;
    const nodes = blocks.map((block, index) =>
        block.kind === "code" ? (
          <CodeBlock key={`code-${index}`} code={block.value} language={block.language} />
        ) : block.kind === "subtext" ? (
          // `-# ` alt metin: küçük ve soluk (web `md-subtext`).
          <Text key={`sub-${index}`} style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>
            {renderInline(block.value, `s${index}`, ctx)}
            {index === last ? spacer : null}
          </Text>
        ) : (
          // Seçilebilir DEĞİL: Android'de metin seçimi uzun basmayı yutuyor ve
          // mesaj eylemleri (yanıtla, tepki, kopyala) hiç açılmıyordu. Kopyalama
          // eylem sayfasında.
          <Text key={`text-${index}`} style={{ ...typography.body, ...MESSAGE_TEXT, color: textColor, ...style, ...scale?.text }}>
            {renderInline(block.value, `b${index}`, ctx)}
            {index === last ? spacer : null}
          </Text>
        )
    );
    if (trailing && blocks[last]?.kind === "code") {
      nodes.push(
        <Text key="trailing" style={{ ...typography.body, ...MESSAGE_TEXT, textAlign: "right" }}>
          {spacer}
        </Text>
      );
    }
    return nodes;
  }, [blocks, revealed, toggleSpoiler, emojiSize, roles, emojis, myUsername, style, color, scale, trailing]);

  return <View style={{ gap: compact ? 2 : spacing.xs }}>{rendered}</View>;
}

/**
 * Görünmez yer tutucu: saat rozetinin genişliğini metnin son satırında
 * ayırır. Saatle aynı yazı boyunda (11) çizilir ki genişlikler örtüşsün.
 */
export function InvisibleSpacer({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: 11, color: "transparent" }} accessible={false} importantForAccessibility="no">
      {text}
    </Text>
  );
}

type Block =
  | { kind: "text"; value: string }
  | { kind: "subtext"; value: string }
  | { kind: "code"; value: string; language: string | null };

/** Kod blokları ayrılır; kalan metinde `-# ` satırları kendi bloklarına düşer. */
function splitBlocks(value: string): Block[] {
  const result: Block[] = [];
  const pattern = /```([a-zA-Z0-9_+#-]+)?[^\S\n]*\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) result.push(...splitSubtext(value.slice(cursor, match.index)));
    result.push({ kind: "code", value: match[2].replace(/\n$/, ""), language: match[1] ?? null });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push(...splitSubtext(value.slice(cursor)));
  return result.length > 0 ? result : [{ kind: "text", value }];
}

function splitSubtext(text: string): Block[] {
  if (!text.includes("-# ")) return [{ kind: "text", value: text }];
  const out: Block[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join("\n");
    if (joined.trim()) out.push({ kind: "text", value: joined });
    buffer = [];
  };
  for (const line of text.split("\n")) {
    const sub = /^-# (.+)$/.exec(line);
    if (sub) {
      flush();
      out.push({ kind: "subtext", value: sub[1] });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

function renderInline(value: string, prefix: string, ctx: InlineContext): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const token = findNextToken(value, cursor);
    if (!token) {
      nodes.push(...emojify(value.slice(cursor), `${prefix}-t${cursor}`, ctx.emojiSize));
      break;
    }
    if (token.start > cursor) nodes.push(...emojify(value.slice(cursor, token.start), `${prefix}-t${cursor}`, ctx.emojiSize));
    const key = `${prefix}-${token.start}`;

    if (token.kind === "url") {
      nodes.push(
        <Text key={key} onPress={() => openGuardedLink(token.url)} style={{ color: colors.accent, textDecorationLine: "underline" }}>
          {token.label}
        </Text>
      );
    } else if (token.kind === "code") {
      nodes.push(
        <Text key={key} style={{ fontFamily: "monospace", fontSize: 12, color: colors.bright, backgroundColor: colors.deep }}>
          {token.value}
        </Text>
      );
    } else if (token.kind === "timestamp") {
      nodes.push(
        <Text key={key} style={{ fontSize: 13, color: colors.bright, backgroundColor: colors.deep }}>
          {` ${formatTimestamp(token.unix, token.style)} `}
        </Text>
      );
    } else if (token.kind === "emoji") {
      const emoji = ctx.emojis.find((item) => item.id === token.id);
      nodes.push(
        emoji ? (
          // Kalıcı Twemoji önbelleğine yazılmaz (silinen emoji cihazda kalmasın).
          <Image
            key={key}
            source={{ uri: emoji.imageUrl }}
            recyclingKey={emoji.imageUrl}
            contentFit="contain"
            accessibilityLabel={`:${emoji.name}:`}
            style={{ width: ctx.customEmojiSize, height: ctx.customEmojiSize }}
          />
        ) : (
          // Silinmiş ya da başka sunucunun emojisi: ad metin olarak kalır.
          <Text key={key} style={{ color: colors.muted }}>{`:${token.name}:`}</Text>
        )
      );
    } else if (token.kind === "role") {
      const role = ctx.roles.find((item) => item.id === token.id);
      const color = role?.color && /^#[0-9a-f]{6}$/i.test(role.color) ? role.color : null;
      nodes.push(
        <Text
          key={key}
          style={{
            ...fw(600),
            color: color ? readable(color, colors.bubbleOther) : colors.brand,
            backgroundColor: color ? withAlpha(color, 0.18) : colors.brandSoft,
          }}
        >
          {` @${role?.name ?? "silinmiş-rol"} `}
        </Text>
      );
    } else if (token.kind === "broadcast") {
      nodes.push(
        <Text key={key} style={{ ...fw(600), color: colors.bright, backgroundColor: withAlpha(colors.warning, 0.25) }}>
          {` @${BROADCAST_LABEL[token.broadcast]} `}
        </Text>
      );
    } else if (token.kind === "mention") {
      const self = Boolean(ctx.myUsername) && ctx.myUsername!.toLocaleLowerCase("tr-TR") === token.username.toLocaleLowerCase("tr-TR");
      nodes.push(
        <Text
          key={key}
          style={{
            ...fw(500),
            color: self ? colors.bright : colors.brand,
            backgroundColor: self ? withAlpha(colors.warning, 0.25) : colors.brandSoft,
          }}
        >
          {`@${token.username}`}
        </Text>
      );
    } else if (token.kind === "spoiler") {
      const visible = ctx.revealed.has(key);
      nodes.push(
        <Text
          key={key}
          onPress={() => ctx.toggleSpoiler(key)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Spoilerı gizle" : "Spoilerı göster"}
          style={{
            color: visible ? colors.text : colors.deep,
            backgroundColor: visible ? colors.raised : colors.text,
          }}
        >
          {visible ? renderInline(token.value, `${key}-spoiler`, ctx) : token.value.replace(/./g, "•")}
        </Text>
      );
    } else {
      nodes.push(
        <Text key={key} style={token.style}>
          {renderInline(token.value, `${key}-format`, ctx)}
        </Text>
      );
    }
    cursor = token.end;
  }

  return nodes.length > 0 ? nodes : [<Fragment key={`${prefix}-empty`} />];
}

type InlineToken =
  | { kind: "url"; start: number; end: number; url: string; label: string }
  | { kind: "code"; start: number; end: number; value: string }
  | { kind: "spoiler"; start: number; end: number; value: string }
  | { kind: "timestamp"; start: number; end: number; unix: number; style: TimestampStyle }
  | { kind: "emoji"; start: number; end: number; name: string; id: string }
  | { kind: "role"; start: number; end: number; id: string }
  | { kind: "broadcast"; start: number; end: number; broadcast: BroadcastKind }
  | { kind: "mention"; start: number; end: number; username: string }
  | { kind: "format"; start: number; end: number; value: string; style: InlineStyle };

// Düzenli ifadeler modül düzeyinde bir kez kurulur (her belirteç aramasında
// yeniden derlenmez). Hepsi `g` bayraklı; her kullanımda `lastIndex`
// ayarlanır, tarama eşzamanlı olduğundan paylaşmak güvenli.
const LINK_RE = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
const RAW_URL_RE = /https?:\/\/[^\s<>]+/g;
const STAMP_RE = new RegExp(TIMESTAMP_SOURCE, "g");
const CUSTOM_EMOJI_RE = new RegExp(CUSTOM_EMOJI_SOURCE, "g");
const ROLE_MENTION_RE = new RegExp(ROLE_MENTION_SOURCE, "g");
const MENTION_RE = new RegExp(MENTION_SOURCE, "g");

function findNextToken(value: string, from: number): InlineToken | null {
  const candidates: InlineToken[] = [];
  const link = LINK_RE;
  link.lastIndex = from;
  const linkMatch = link.exec(value);
  if (linkMatch) candidates.push({ kind: "url", start: linkMatch.index, end: link.lastIndex, label: linkMatch[1], url: linkMatch[2] });

  const raw = RAW_URL_RE;
  raw.lastIndex = from;
  const rawMatch = raw.exec(value);
  if (rawMatch) {
    const url = rawMatch[0].replace(/[),.!?;:'"\]]+$/g, "");
    candidates.push({ kind: "url", start: rawMatch.index, end: rawMatch.index + url.length, label: url, url });
  }

  const stamp = STAMP_RE;
  stamp.lastIndex = from;
  const stampMatch = stamp.exec(value);
  if (stampMatch) {
    candidates.push({
      kind: "timestamp",
      start: stampMatch.index,
      end: stamp.lastIndex,
      unix: Number(stampMatch[1]),
      style: (stampMatch[2] ?? "f") as TimestampStyle,
    });
  }

  const emoji = CUSTOM_EMOJI_RE;
  emoji.lastIndex = from;
  const emojiMatch = emoji.exec(value);
  if (emojiMatch) candidates.push({ kind: "emoji", start: emojiMatch.index, end: emoji.lastIndex, name: emojiMatch[1], id: emojiMatch[2] });

  const role = ROLE_MENTION_RE;
  role.lastIndex = from;
  const roleMatch = role.exec(value);
  if (roleMatch) candidates.push({ kind: "role", start: roleMatch.index, end: role.lastIndex, id: roleMatch[1] });

  const mention = MENTION_RE;
  mention.lastIndex = from;
  const mentionMatch = mention.exec(value);
  if (mentionMatch) {
    // Sondaki nokta cümle sonu; kullanıcı adının parçası sayılmaz.
    const username = mentionMatch[1].replace(/\.+$/, "");
    if (username) {
      const end = mentionMatch.index + 1 + username.length;
      const broadcast = broadcastKindOf(username);
      candidates.push(
        broadcast
          ? { kind: "broadcast", start: mentionMatch.index, end, broadcast }
          : { kind: "mention", start: mentionMatch.index, end, username }
      );
    }
  }

  for (const [open, close, kind] of [["`", "`", "code"], ["||", "||", "spoiler"]] as const) {
    const start = value.indexOf(open, from);
    const end = start >= 0 ? value.indexOf(close, start + open.length) : -1;
    if (start >= 0 && end > start + open.length) {
      candidates.push({ kind, start, end: end + close.length, value: value.slice(start + open.length, end) });
    }
  }

  for (const format of FORMATS) {
    const start = value.indexOf(format.open, from);
    const end = start >= 0 ? value.indexOf(format.close, start + format.open.length) : -1;
    if (start >= 0 && end > start + format.open.length) {
      candidates.push({
        kind: "format",
        start,
        end: end + format.close.length,
        value: value.slice(start + format.open.length, end),
        style: format.style(),
      });
    }
  }

  return candidates.sort((a, b) => a.start - b.start || b.end - a.end)[0] ?? null;
}
