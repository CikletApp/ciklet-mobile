import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { Icon } from "@/components/ui";
import {
  QUARANTINE_BANNER_TITLE,
  QUARANTINE_EDIT_PROFILE_LABEL,
  quarantineBannerHelp,
  quarantineBannerReason,
  readQuarantine,
} from "@/lib/quarantine";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/** Karantina kalkmış mı diye üyelik listesinin yeniden istenme aralığı (bant açıkken). */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Karantina bandı (Discord "Block Member Interactions") — kilitli yazma
 * çubuğunun hemen üstünde. Web components/chat/quarantine-banner ile aynı
 * metinler (lib/quarantine). Zorlama sunucu uçlarında; burası yalnızca gösterir.
 *
 * Gerçek zamanlı "üye güncellendi" olayı kullanıcıya gelmiyor: bant açıkken
 * üyelik listesi (`/api/members/mine`) dakikada bir tazelenir; uygulama öne
 * gelince de react-query odak yöneticisi yeniler.
 */
export function QuarantineBanner({ quarantine, onRefresh }: { quarantine: unknown; onRefresh?: () => unknown }) {
  const fromProfile = readQuarantine(quarantine)?.source === "profile";

  useEffect(() => {
    if (!onRefresh) return;
    const timer = setInterval(() => void onRefresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [onRefresh]);

  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xs }} accessibilityRole="alert">
      <View
        style={{
          flexDirection: "row",
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.panel,
        }}
      >
        <Icon name="shield" size={20} color={colors.danger} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{QUARANTINE_BANNER_TITLE}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{quarantineBannerReason(quarantine)}</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>{quarantineBannerHelp(quarantine)}</Text>
          {fromProfile ? (
            <Pressable
              onPress={() => router.push("/profile/edit")}
              accessibilityRole="button"
              hitSlop={8}
              style={{
                alignSelf: "flex-start",
                marginTop: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderRadius: radii.md,
                backgroundColor: colors.dangerSolid,
              }}
            >
              <Text style={{ ...typography.caption, ...fw(600), color: "#fff" }}>{QUARANTINE_EDIT_PROFILE_LABEL}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
