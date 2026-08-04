import { Text, View } from "react-native";
import { router } from "expo-router";

import { useOpenDirect, useSelfDirect } from "@/api/hooks";
import { Icon, Pressable, type IconName } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Mesaj listesinin üstündeki hızlı erişim satırları.
 *
 * Web'deki DM kenar çubuğunun üst bölümüyle aynı işlev: Arkadaşlar ve
 * Notlarım, "Direkt Mesajlar" başlığının ÜSTÜNDE ayrı satırlar olarak
 * durur (bkz. ciklet-web directs-sidebar.tsx).
 */
export function QuickLinks() {
  const myId = useAuth((s) => s.profile?.id);
  const { data: selfDirect } = useSelfDirect();
  const openDirect = useOpenDirect();

  /**
   * Not sohbeti henüz yoksa açılır. Sunucu `profileAId === profileBId`
   * durumunu kabul ediyor (lib/direct.ts'te bilerek serbest bırakılmış).
   */
  const openNotes = () => {
    if (selfDirect) {
      router.push(`/chat/direct/${selfDirect.id}`);
      return;
    }
    if (!myId) return;
    openDirect.mutate(myId, {
      onSuccess: (direct) => router.push(`/chat/direct/${direct.id}`),
    });
  };

  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
      <QuickRow
        icon="users"
        label="Arkadaşlar"
        onPress={() => router.push("/friends")}
      />
      <QuickRow
        icon="bookmark"
        label="Notlarım"
        onPress={openNotes}
        busy={openDirect.isPending}
      />
    </View>
  );
}

function QuickRow({
  icon,
  label,
  onPress,
  busy,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.panel : "transparent",
        opacity: busy ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={20} color={colors.muted} />
      <Text style={{ ...typography.bodyStrong, color: colors.text, flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
