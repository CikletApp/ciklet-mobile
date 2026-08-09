import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Linking, Text, View, type TextStyle } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

interface MessageMarkdownProps {
  value: string;
  style?: TextStyle;
  compact?: boolean;
}

type InlineStyle = Pick<TextStyle, "fontWeight" | "fontStyle" | "textDecorationLine">;

const FORMATS: { open: string; close: string; style: InlineStyle }[] = [
  { open: "***", close: "***", style: { fontWeight: "700", fontStyle: "italic" } },
  { open: "___", close: "___", style: { fontWeight: "700", fontStyle: "italic", textDecorationLine: "underline" } },
  { open: "**", close: "**", style: { fontWeight: "700" } },
  { open: "__", close: "__", style: { textDecorationLine: "underline" } },
  { open: "~~", close: "~~", style: { textDecorationLine: "line-through" } },
  { open: "*", close: "*", style: { fontStyle: "italic" } },
];

/**
 * Web sohbetindeki güvenli Markdown alt kümesi. HTML hiçbir zaman
 * yorumlanmaz; biçimler yalnız native Text düğümlerine çevrilir.
 */
export function MessageMarkdown({ value, style, compact = false }: MessageMarkdownProps) {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const blocks = useMemo(() => splitCodeBlocks(value), [value]);

  const toggleSpoiler = (key: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={{ gap: compact ? 2 : spacing.xs }}>
      {blocks.map((block, index) =>
        block.kind === "code" ? (
          <View
            key={`code-${index}`}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.deep,
            }}
          >
            <Text selectable style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 18, color: colors.bright }}>
              {block.value}
            </Text>
          </View>
        ) : (
          <Text key={`text-${index}`} selectable style={{ ...typography.body, color: colors.text, ...style }}>
            {renderInline(block.value, `b${index}`, revealed, toggleSpoiler)}
          </Text>
        )
      )}
    </View>
  );
}

function splitCodeBlocks(value: string): { kind: "text" | "code"; value: string }[] {
  const result: { kind: "text" | "code"; value: string }[] = [];
  const pattern = /```(?:[a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) result.push({ kind: "text", value: value.slice(cursor, match.index) });
    result.push({ kind: "code", value: match[1].replace(/\n$/, "") });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) result.push({ kind: "text", value: value.slice(cursor) });
  return result.length > 0 ? result : [{ kind: "text", value }];
}

function renderInline(
  value: string,
  prefix: string,
  revealed: Set<string>,
  toggleSpoiler: (key: string) => void
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const token = findNextToken(value, cursor);
    if (!token) {
      nodes.push(value.slice(cursor));
      break;
    }
    if (token.start > cursor) nodes.push(value.slice(cursor, token.start));
    const key = `${prefix}-${token.start}`;

    if (token.kind === "url") {
      nodes.push(
        <Text key={key} onPress={() => void Linking.openURL(token.url)} style={{ color: colors.accent, textDecorationLine: "underline" }}>
          {token.label}
        </Text>
      );
    } else if (token.kind === "code") {
      nodes.push(
        <Text key={key} style={{ fontFamily: "monospace", fontSize: 12, color: colors.bright, backgroundColor: colors.deep }}>
          {token.value}
        </Text>
      );
    } else if (token.kind === "spoiler") {
      const visible = revealed.has(key);
      nodes.push(
        <Text
          key={key}
          onPress={() => toggleSpoiler(key)}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Spoilerı gizle" : "Spoilerı göster"}
          style={{
            color: visible ? colors.text : colors.deep,
            backgroundColor: visible ? colors.raised : colors.text,
          }}
        >
          {visible ? renderInline(token.value, `${key}-spoiler`, revealed, toggleSpoiler) : token.value.replace(/./g, "•")}
        </Text>
      );
    } else {
      nodes.push(
        <Text key={key} style={token.style}>
          {renderInline(token.value, `${key}-format`, revealed, toggleSpoiler)}
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
  | { kind: "format"; start: number; end: number; value: string; style: InlineStyle };

function findNextToken(value: string, from: number): InlineToken | null {
  const candidates: InlineToken[] = [];
  const link = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
  link.lastIndex = from;
  const linkMatch = link.exec(value);
  if (linkMatch) candidates.push({ kind: "url", start: linkMatch.index, end: link.lastIndex, label: linkMatch[1], url: linkMatch[2] });

  const raw = /https?:\/\/[^\s<>]+/g;
  raw.lastIndex = from;
  const rawMatch = raw.exec(value);
  if (rawMatch) {
    const url = rawMatch[0].replace(/[),.!?;:'"\]]+$/g, "");
    candidates.push({ kind: "url", start: rawMatch.index, end: rawMatch.index + url.length, label: url, url });
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
        style: format.style,
      });
    }
  }

  return candidates.sort((a, b) => a.start - b.start || b.end - a.end)[0] ?? null;
}
