import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Icon } from "@/components/ui";
import { colors, radii, spacing } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

interface OpenGraphPreview {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

/** Webdeki OpenGraph kartının native karşılığı. Önizlemeyi cihaz doğrudan
 * hedef siteden değil, oturum ve SSRF korumalı `/api/link-preview` ucundan
 * alır. */
export function LinkPreviewCard({ url }: { url: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => api<OpenGraphPreview>(endpoints.linkPreview(url)),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  if (preview.isLoading) return <LinkPreviewSkeleton />;

  const data = preview.data;
  if (preview.isError || !data || (!data.title && !data.description && !data.image)) {
    return null;
  }

  const imageUrl = resolveImageUrl(data.image, data.url || url);
  const siteName = data.siteName?.trim() || hostnameOf(url);

  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`${data.title || siteName} bağlantısını aç`}
      style={({ pressed }) => ({
        width: 320,
        maxWidth: "100%",
        marginTop: spacing.xs,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 3,
        borderLeftColor: colors.brand,
        backgroundColor: pressed ? colors.raised : colors.panel,
        overflow: "hidden",
      })}
    >
      <View style={{ padding: spacing.md, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 10, lineHeight: 13, ...fw(700), color: colors.muted }} numberOfLines={1}>
            {siteName}
          </Text>
          <Icon name="link" size={11} color={colors.muted} />
        </View>
        {data.title ? (
          <Text style={{ fontSize: 13, lineHeight: 17, ...fw(700), color: colors.accent }} numberOfLines={2}>
            {data.title}
          </Text>
        ) : null}
        {data.description ? (
          <Text style={{ fontSize: 11, lineHeight: 15, color: colors.text }} numberOfLines={2}>
            {data.description}
          </Text>
        ) : null}
      </View>

      {imageUrl && !imageFailed ? (
        <View style={{ width: "100%", height: 140, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.deep }}>
          <Image
            source={{ uri: imageUrl }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onError={() => setImageFailed(true)}
            accessibilityLabel={data.title ? `${data.title} önizleme görseli` : "Bağlantı önizleme görseli"}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function LinkPreviewSkeleton() {
  return (
    <View
      accessibilityLabel="Bağlantı önizlemesi yükleniyor"
      style={{
        width: 320,
        maxWidth: "100%",
        height: 112,
        marginTop: spacing.xs,
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderColor: colors.border,
        borderLeftColor: colors.brand,
        backgroundColor: colors.panel,
      }}
    >
      <View style={{ width: 86, height: 9, borderRadius: radii.full, backgroundColor: colors.raised }} />
      <View style={{ width: "88%", height: 13, borderRadius: radii.full, backgroundColor: colors.raised }} />
      <View style={{ width: "72%", height: 11, borderRadius: radii.full, backgroundColor: colors.raised }} />
    </View>
  );
}

function hostnameOf(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function resolveImageUrl(image: string | undefined, pageUrl: string): string | null {
  if (!image) return null;
  try {
    const resolved = new URL(image, pageUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}
