import { Linking, Text, View } from "react-native";
import { Image } from "expo-image";

import { Pressable } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { MessageMarkdown } from "./message-markdown";
import { fw } from "@/theme/fonts";

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface RichEmbed {
  title?: string;
  url?: string;
  description?: string;
  color?: number | string;
  thumbnail?: { url?: string };
  image?: { url?: string };
  author?: { name?: string; icon_url?: string; url?: string };
  footer?: { text?: string; icon_url?: string };
  fields?: EmbedField[];
  timestamp?: string;
}

/** Bot API metadata'sındaki doğrulanmış embed'leri native kartlara çizer. */
export function MessageEmbeds({ metadata }: { metadata: unknown }) {
  const embeds = readEmbeds(metadata);
  if (embeds.length === 0) return null;

  return (
    <View style={{ width: 320, maxWidth: "100%", gap: spacing.sm, paddingTop: spacing.xs }}>
      {embeds.map((embed, index) => (
        <EmbedCard key={`${index}-${embed.title ?? embed.description ?? "embed"}`} embed={embed} />
      ))}
    </View>
  );
}

function EmbedCard({ embed }: { embed: RichEmbed }) {
  const authorUrl = safeUrl(embed.author?.url);
  const titleUrl = safeUrl(embed.url);
  const authorIcon = safeUrl(embed.author?.icon_url, true);
  const thumbnail = safeUrl(embed.thumbnail?.url, true);
  const image = safeUrl(embed.image?.url, true);
  const footerIcon = safeUrl(embed.footer?.icon_url, true);
  const timestamp = formatTimestamp(embed.timestamp);
  const fieldRows = groupFieldsIntoRows(embed.fields ?? []);

  return (
    <View
      style={{
        paddingVertical: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        gap: spacing.sm,
        borderLeftWidth: 4,
        borderLeftColor: embedColor(embed.color),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.lg }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
          {embed.author?.name ? (
            <Pressable
              onPress={() => authorUrl && void Linking.openURL(authorUrl)}
              disabled={!authorUrl}
              noHitSlop
              accessibilityRole={authorUrl ? "link" : "text"}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              {authorIcon ? (
                <Image
                  source={{ uri: authorIcon }}
                  contentFit="cover"
                  style={{ width: 24, height: 24, borderRadius: radii.full, backgroundColor: colors.raised }}
                />
              ) : null}
              <Text style={{ ...typography.caption, ...fw(600), color: colors.bright }} numberOfLines={1}>
                {embed.author.name}
              </Text>
            </Pressable>
          ) : null}

          {embed.title ? (
            <Text
              selectable
              onPress={() => titleUrl && void Linking.openURL(titleUrl)}
              style={{ ...typography.title, color: titleUrl ? colors.accent : colors.bright }}
            >
              {embed.title}
            </Text>
          ) : null}

          {embed.description ? (
            <EmbedText value={embed.description} color={colors.text} />
          ) : null}

          {fieldRows.length > 0 ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              {fieldRows.map((row, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: "row", gap: spacing.lg }}>
                  {row.map((field, fieldIndex) => (
                    <View key={`${field.name}-${fieldIndex}`} style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text selectable style={{ ...typography.caption, ...fw(700), color: colors.bright }}>
                        {field.name}
                      </Text>
                      <EmbedText value={field.value} color={colors.text} />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            contentFit="contain"
            style={{ width: 80, height: 80, borderRadius: radii.sm, backgroundColor: colors.deep }}
          />
        ) : null}
      </View>

      {image ? (
        <Pressable onPress={() => void Linking.openURL(image)} noHitSlop accessibilityRole="imagebutton">
          <Image
            source={{ uri: image }}
            contentFit="contain"
            style={{ width: "100%", aspectRatio: 16 / 9, maxHeight: 300, borderRadius: radii.sm, backgroundColor: colors.deep }}
          />
        </Pressable>
      ) : null}

      {embed.footer?.text || timestamp ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs }}>
          {footerIcon ? (
            <Image
              source={{ uri: footerIcon }}
              contentFit="cover"
              style={{ width: 20, height: 20, borderRadius: radii.full, backgroundColor: colors.raised }}
            />
          ) : null}
          <Text selectable style={{ fontSize: 11, lineHeight: 15, ...fw(500), color: colors.muted, flex: 1 }}>
            {embed.footer?.text}
            {embed.footer?.text && timestamp ? "  •  " : ""}
            {timestamp}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EmbedText({ value, color }: { value: string; color: string }) {
  return <MessageMarkdown value={value} compact style={{ ...typography.caption, color }} />;
}

function readEmbeds(metadata: unknown): RichEmbed[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as { embeds?: unknown }).embeds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is RichEmbed => Boolean(entry && typeof entry === "object")).slice(0, 10);
}

function safeUrl(raw: unknown, imageOnly = false): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    if (!imageOnly && url.protocol === "mailto:") return url.toString();
  } catch {
    // Geçersiz URL düz metne düşer.
  }
  return undefined;
}

function embedColor(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : colors.border;
}

function groupFieldsIntoRows(fields: EmbedField[]): EmbedField[][] {
  const rows: EmbedField[][] = [];
  let inlineRow: EmbedField[] | null = null;
  for (const field of fields.slice(0, 25)) {
    if (!field || typeof field.name !== "string" || typeof field.value !== "string") continue;
    if (!field.inline) {
      rows.push([field]);
      inlineRow = null;
    } else {
      if (!inlineRow || inlineRow.length >= 3) {
        inlineRow = [];
        rows.push(inlineRow);
      }
      inlineRow.push(field);
    }
  }
  return rows;
}

function formatTimestamp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}
