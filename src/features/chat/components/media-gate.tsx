import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { useCurrentProfile } from "@/api/hooks/use-profile";
import { Icon, Pressable } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Spoiler / hassas medya örtüsü (ciklet-web lib/sensitive-media). Spoiler
 * (`SPOILER_` önekli ad) herkes için; hassas işaretli medya kullanıcının
 * "Hassas Medya" ayarı açıksa (varsayılan) örtülü gelir. Dokununca açılır.
 */
export function MediaGate({ spoiler, sensitive, children }: { spoiler: boolean; sensitive: boolean; children: ReactNode }) {
  const { data: profile } = useCurrentProfile();
  const [revealed, setRevealed] = useState(false);
  const blur = (profile as { blurSensitiveMedia?: boolean } | undefined)?.blurSensitiveMedia ?? true;
  const gated = spoiler || (sensitive && blur);
  if (!gated || revealed) return <>{children}</>;
  return (
    <Pressable
      onPress={() => setRevealed(true)}
      style={{ width: 220, height: 150, borderRadius: radii.md, backgroundColor: colors.deep, alignItems: "center", justifyContent: "center", gap: spacing.xs }}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Icon name="eye-off" size={22} color={colors.muted} />
        <Text style={{ ...typography.bodyStrong, color: colors.text }}>{spoiler ? "Spoiler" : "Hassas içerik olabilir"}</Text>
        <Text style={{ ...typography.caption, color: colors.brand }}>Göstermek için dokun</Text>
      </View>
    </Pressable>
  );
}
