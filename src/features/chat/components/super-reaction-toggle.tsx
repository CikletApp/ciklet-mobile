import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import {
  SUPER_REACTION_PLAN_TEXT,
  canSendSuperReaction,
  superReactionQuotaLabel,
  useSuperReactionQuota,
} from "../super-reactions";

/** Süper tepki vurgu rengi (web'deki fuşya→indigo geçişinin ilk rengi). */
export const SUPER_REACTION_ACCENT = "#d946ef";

/**
 * Tepki seçicisinin üstündeki "Süper Tepki" anahtarı (web:
 * components/chat/v2/super-reaction-toggle). Açıkken seçilen emoji süper
 * tepki olarak gider; kalan haftalık hak yanında yazar. Ücretsiz planda
 * anahtar yerine Mentol tanıtımı çıkar.
 */
export function SuperReactionToggle({
  enabled,
  onEnabledChange,
  onNavigate,
}: {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  /** "Mentol'ü keşfet"e basılınca (menüyü kapatmak için). */
  onNavigate?: () => void;
}) {
  const { data: quota } = useSuperReactionQuota();
  if (!quota) return null;

  if (quota.plan === "FREE") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Icon name="sparkles" size={16} color={SUPER_REACTION_ACCENT} />
        <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>{SUPER_REACTION_PLAN_TEXT}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onNavigate?.();
            router.push("/settings/mentol");
          }}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.sm,
            backgroundColor: SUPER_REACTION_ACCENT,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 12, lineHeight: 16, ...fw(700), color: "#ffffff" }}>{"Mentol'ü keşfet"}</Text>
        </Pressable>
      </View>
    );
  }

  const available = canSendSuperReaction(quota);
  const on = enabled && available;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !available }}
      accessibilityLabel="Süper Tepki"
      disabled={!available}
      onPress={() => onEnabledChange(!on)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: available ? 1 : 0.6,
      })}
    >
      <Icon name="sparkles" size={16} color={on ? SUPER_REACTION_ACCENT : colors.muted} />
      <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>Süper Tepki</Text>
      <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }} numberOfLines={1}>
        {superReactionQuotaLabel(quota)}
      </Text>
      <View
        style={{
          width: 32,
          height: 18,
          borderRadius: radii.full,
          backgroundColor: on ? SUPER_REACTION_ACCENT : colors.border,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: radii.full,
            backgroundColor: "#ffffff",
            marginLeft: on ? 16 : 2,
          }}
        />
      </View>
    </Pressable>
  );
}
