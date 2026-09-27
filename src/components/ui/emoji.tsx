import { useEffect, type ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { Image } from "expo-image";

import { splitEmoji } from "@/lib/emoji";
import { localEmojiUri, persistEmoji } from "@/lib/emoji-cache";

/**
 * Twemoji çizimi — bkz. lib/emoji.ts. Metin içinde satıra gömülü görsel olarak
 * durur. expo-image kullanılıyor: Dokimorji SVG olabilir ve React Native'in
 * kendi Image bileşeni SVG çizemiyor.
 *
 * Emoji bir kez indikten sonra cihazdaki kalıcı kopyadan okunur (bkz.
 * lib/emoji-cache.ts); ağ adresi yalnızca ilk görüşte kullanılır.
 */
export function EmojiImage({ url, size, label }: { url: string; size: number; label?: string }) {
  const local = localEmojiUri(url);
  useEffect(() => {
    if (!local) persistEmoji(url);
  }, [local, url]);
  return (
    <Image
      source={{ uri: local ?? url }}
      recyclingKey={url}
      cachePolicy={local ? "memory" : "memory-disk"}
      contentFit="contain"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Metindeki emojileri görsele çevirir; `<Text>` içine konacak düğümler döner.
 * Emoji yoksa metnin kendisi — gereksiz düğüm üretilmez.
 */
export function emojify(text: string, keyPrefix: string, size: number): ReactNode[] {
  const segments = splitEmoji(text);
  if (segments.length === 1 && segments[0].kind === "text") return [text];
  return segments.map((segment, index) =>
    segment.kind === "text" ? (
      segment.text
    ) : (
      <EmojiImage key={`${keyPrefix}-e${index}`} url={segment.url} size={size} label={segment.text} />
    )
  );
}

/** Yazı boyutuna göre emoji boyutu — satır yüksekliğini bozmayacak kadar. */
export function emojiSizeFor(style: TextStyle | undefined, fallback = 15): number {
  return Math.round((style?.fontSize ?? fallback) * 1.25);
}

/** Emoji içerebilen tek satırlık/kısa metinler için (ad, önizleme, durum). */
export function EmojiText({ children, style, ...props }: Omit<TextProps, "children"> & { children: string; style?: TextStyle }) {
  return (
    <Text {...props} style={style}>
      {emojify(children, "t", emojiSizeFor(style))}
    </Text>
  );
}
