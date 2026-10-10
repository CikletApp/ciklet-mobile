import { useEffect, type ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { Image } from "expo-image";

import { DOKIMORJI_FONT, hasDokimorji, splitDokimorji, splitEmoji } from "@/lib/emoji";
import { localEmojiUri, persistEmoji } from "@/lib/emoji-cache";
import { fontFamily } from "@/theme/fonts";

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

/**
 * Yazı kutusu (`TextInput`) için içerik prop'ları.
 *
 * Kutu satır içi görsel taşıyamıyor; Dokimorji karakterleri bu yüzden renkli
 * Dokimorji yazı tipiyle iç içe `<Text>` olarak çizilir (web de girdilerde
 * aynı yazı tipini kullanıyor). Metin karakter karakter aynı kalır: imleç,
 * seçim, geri silme ve gönderim değişmez. Dokimorji yoksa düz `value` —
 * olağan yol hiç değişmez. RN `value` ile `children`'ı birlikte kabul etmez.
 */
export function dokimorjiInputProps(
  value: string,
  lineHeight?: number
): { value: string } | { children: ReactNode[] } {
  if (!hasDokimorji(value)) return { value };
  const family = fontFamily(400);
  return {
    children: splitDokimorji(value).map((segment, index) =>
      segment.kind === "dokimorji" ? (
        <Text key={`d${index}`} style={{ fontFamily: DOKIMORJI_FONT, fontWeight: "normal", lineHeight }}>
          {segment.text}
        </Text>
      ) : (
        // Yazı parçası da açık aileyle: iOS'ta Dokimorji'nin hemen ardından
        // yazılan harf onun yazı tipini miras almasın.
        <Text key={`t${index}`} style={family ? { fontFamily: family } : undefined}>
          {segment.text}
        </Text>
      )
    ),
  };
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
