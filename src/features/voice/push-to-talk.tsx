import { useEffect, useRef, useState } from "react";
import { AppState, Text } from "react-native";
import { useLocalParticipant } from "@livekit/react-native";

import { Icon, Pressable } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Bas-konuş düğmesi — Ayarlar → Ses ve Video → Giriş modu "Bas konuş"
 * seçiliyken ses kanalında mikrofon düğmesinin yerine geçer (web
 * `providers/push-to-talk` karşılığı). Basılı tutarken mikrofon açılır,
 * bırakınca ya da uygulama arka plana düşünce kapanır.
 */
export function PushToTalkButton({ disabled = false }: { disabled?: boolean }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [holding, setHolding] = useState(false);
  const holdingRef = useRef(false);

  const set = (on: boolean) => {
    holdingRef.current = on;
    setHolding(on);
    void localParticipant?.setMicrophoneEnabled(on).catch(() => undefined);
  };

  // Odak kaybında (arka plan, kilit) mikrofon açık kalmasın.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && holdingRef.current) set(false);
    });
    return () => subscription.remove();
    // `set` her çizimde yeni; yalnızca katılımcı değişince yeniden bağlanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localParticipant]);

  const live = holding && isMicrophoneEnabled;

  return (
    <Pressable
      onPressIn={disabled ? undefined : () => set(true)}
      onPressOut={disabled ? undefined : () => set(false)}
      disabled={disabled}
      haptic="light"
      noHitSlop
      accessibilityRole="button"
      accessibilityLabel="Konuşmak için basılı tut"
      accessibilityState={{ selected: live, disabled }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        minHeight: 56,
        borderRadius: radii.full,
        backgroundColor: live ? colors.success : holding ? colors.brandSoft : colors.raised,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={live ? "mic" : "mic-off"} size={22} color={live ? "#ffffff" : colors.bright} />
      <Text style={{ ...typography.bodyStrong, ...fw(700), color: live ? "#ffffff" : colors.bright }}>
        {live ? "Konuşuyorsun" : "Konuşmak için basılı tut"}
      </Text>
    </Pressable>
  );
}
