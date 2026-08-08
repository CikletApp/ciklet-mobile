import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";

import { onConnectionState, type ConnectionState } from "@/realtime/socket";
import { useAuth } from "@/stores/auth";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Bağlantı durumu şeridi.
 *
 * Yalnızca bir SORUN varken görünür — "bağlandı" bildirimi göstermek
 * kullanıcıya bilgi vermez, sadece dikkat dağıtır. Kısa dalgalanmalarda
 * yanıp sönmemesi için 2 sn gecikmeyle belirir.
 */
export function ConnectionBanner() {
  const status = useAuth((s) => s.status);
  const [state, setState] = useState<ConnectionState>("idle");

  useEffect(() => onConnectionState(setState), []);

  const degraded = status === "signedIn" && state === "reconnecting";

  return degraded ? <DelayedConnectionBanner /> : null;
}

/** Her kopmada yeniden mount olur; böylece gecikme durumu sıfırlanır. */
function DelayedConnectionBanner() {
  const [visible, setVisible] = useState(false);
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Kısa kopmalarda şerit hiç görünmesin.
    const timer = setTimeout(() => setVisible(true), 2_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity: slide,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
        ],
      }}
      pointerEvents="none"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          paddingVertical: spacing.xs,
          backgroundColor: colors.warning,
        }}
        accessibilityLiveRegion="polite"
      >
        <Text style={{ ...typography.caption, fontWeight: "600", color: colors.deep }}>
          Bağlantı yeniden kuruluyor…
        </Text>
      </View>
    </Animated.View>
  );
}
