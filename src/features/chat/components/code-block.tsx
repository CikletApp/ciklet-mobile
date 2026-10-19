import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { Icon, Pressable, showToast } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";
import { codeLanguageLabel, highlightCode, resolveCodeLanguage, type CodeTokenKind } from "../syntax-highlight";

/**
 * ```kod``` bloğu — ciklet-web `chat/v2/code-block.tsx` karşılığı: dil
 * etiketi, sözdizimi renkleri (bkz. syntax-highlight) ve kopyala düğmesi.
 */

/** Koyu ve açık temada okunur, birbirinden ayrışan tonlar (One Dark / GitHub Light esinli). */
const DARK: Record<Exclude<CodeTokenKind, "plain">, string> = {
  keyword: "#c792ea",
  literal: "#f78c6c",
  string: "#c3e88d",
  number: "#f78c6c",
  comment: "#7f8ea3",
  function: "#82aaff",
  type: "#ffcb6b",
  tag: "#f07178",
  attr: "#ffcb6b",
  variable: "#89ddff",
};

const LIGHT: Record<Exclude<CodeTokenKind, "plain">, string> = {
  keyword: "#8250df",
  literal: "#0550ae",
  string: "#0a7d32",
  number: "#0550ae",
  comment: "#6e7781",
  function: "#6639ba",
  type: "#953800",
  tag: "#116329",
  attr: "#0550ae",
  variable: "#953800",
};

export function CodeBlock({ code, language }: { code: string; language: string | null }) {
  const lang = resolveCodeLanguage(language);
  const tokens = useMemo(() => highlightCode(code, lang), [code, lang]);
  const palette = colors.scheme === "light" ? LIGHT : DARK;
  const label = codeLanguageLabel(lang) ?? (language?.trim() || null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // Yerel modül tembel yüklenir (bkz. message-context-menu `copyText`).
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Kopyalanamadı.", "error");
    }
  };

  return (
    <View
      style={{
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.deep,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 28,
          paddingLeft: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 11, lineHeight: 14, ...fw(600), color: colors.muted }} numberOfLines={1}>
          {label ?? "Kod"}
        </Text>
        <Pressable
          onPress={() => void copy()}
          accessibilityRole="button"
          accessibilityLabel="Kodu kopyala"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 28,
            paddingHorizontal: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name={copied ? "check" : "copy"} size={13} color={copied ? colors.success : colors.muted} />
          <Text style={{ fontSize: 11, lineHeight: 14, ...fw(600), color: copied ? colors.success : colors.muted }}>
            {copied ? "Kopyalandı" : "Kopyala"}
          </Text>
        </Pressable>
      </View>
      <Text
        selectable
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 18,
          color: colors.bright,
        }}
      >
        {tokens.map((token, index) =>
          token.kind === "plain" ? (
            token.text
          ) : (
            <Text
              key={index}
              style={{ color: palette[token.kind], fontStyle: token.kind === "comment" ? "italic" : undefined }}
            >
              {token.text}
            </Text>
          )
        )}
      </Text>
    </View>
  );
}
