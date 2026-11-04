import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { ColorPickerSheet } from "@/features/appearance/color-picker-sheet";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/** web profile-editor/banner-edit `PRESETS` ile aynı hazır renkler. */
export const BANNER_PRESETS = ["#ff5e8a", "#ff7a59", "#ffb300", "#12b98a", "#2d9cdb", "#7c4dff", "#1e1f22", "#e30a17"];

/**
 * "Afiş Rengi": hazır renkler + "Özel renk" seçici. Görsel yüklüyse renk
 * görselin arkasında kalır (web ipucu metniyle aynı).
 */
export function BannerColorRow({
  value,
  onChange,
  disabled,
  label = "AFİŞ RENGİ",
}: {
  value: string | null | undefined;
  onChange: (color: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const current = (value ?? "").toLowerCase();
  const hex = /^#[0-9a-f]{6}$/.test(current) ? current : "#ffb300";

  return (
    <View style={{ gap: spacing.sm, opacity: disabled ? 0.6 : 1 }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{label}</Text>
      <Text style={{ ...typography.caption, color: colors.muted }}>Görsel rengin yerine geçer. 960×360 önerilir.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }} accessibilityRole="radiogroup">
        {BANNER_PRESETS.map((preset) => {
          const active = current === preset;
          return (
            <Pressable
              key={preset}
              disabled={disabled}
              onPress={() => onChange(preset)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={preset}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: preset,
                borderWidth: 2,
                borderColor: active ? colors.brand : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {active ? <Icon name="check" size={14} color="#ffffff" /> : null}
            </Pressable>
          );
        })}
        <Pressable
          disabled={disabled}
          onPress={() => setCustomOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            height: 30,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.raised : colors.deep,
          })}
        >
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: value ?? colors.brand }} />
          <Text style={{ ...typography.caption, color: colors.text }}>Özel renk</Text>
        </Pressable>
      </View>
      <ColorPickerSheet
        visible={customOpen}
        title="Afiş Rengi"
        value={hex}
        onClose={() => setCustomOpen(false)}
        onApply={(color) => {
          setCustomOpen(false);
          onChange(color);
        }}
      />
    </View>
  );
}
