import type { ReactNode } from "react";
import { Switch, Text, View } from "react-native";

import { Icon, type IconName, Pressable } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu Ayarları › Moderasyon kart parçaları (web moderation-tab'daki
 * CARD / LABEL / HINT / Switch / Select / PillPicker karşılıkları). Ekran ve
 * AutoMod kuralları / Güvenlik / Katılım Başvurusu bölümleri ortak kullanır.
 */
export function Card({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: highlight ? colors.brand : colors.border,
        backgroundColor: colors.panel,
      }}
    >
      {children}
    </View>
  );
}

export function CardHeader({ icon, title, description, toggle }: { icon?: IconName; title: string; description?: string; toggle?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {icon ? <Icon name={icon} size={14} color={colors.muted} /> : null}
          <Text style={{ ...typography.overline, color: colors.muted, flexShrink: 1 }}>{title.toLocaleUpperCase("tr-TR")}</Text>
        </View>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
      </View>
      {toggle}
    </View>
  );
}

export function SubTitle({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ gap: 2, marginTop: spacing.xs }}>
      <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{text}</Text>
      {hint ? <Text style={{ ...typography.caption, color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

export function Warning({ text, danger }: { text: string; danger?: boolean }) {
  return <Text style={{ ...typography.caption, color: danger ? colors.danger : colors.warning }}>{text}</Text>;
}

export function Toggle({ value, disabled, onChange }: { value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.brand }}
      thumbColor="#ffffff"
    />
  );
}

/** Başlık + açıklama + anahtar satırı (web `Toggle`). */
export function ToggleRow({ title, hint, value, disabled, onChange }: { title: string; hint?: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <SubTitle text={title} hint={hint} />
      </View>
      <Toggle value={value} disabled={disabled} onChange={onChange} />
    </View>
  );
}

export function SelectRow({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }} numberOfLines={2}>
        {label}
      </Text>
      <Icon name="chevron-down" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Çoklu seçim: seçili öğe vurgulu hap (web PillPicker). */
export function PillPicker({
  items,
  selected,
  disabled,
  emptyLabel,
  onToggle,
}: {
  items: { id: string; label: string; color?: string | null }[];
  selected: string[];
  disabled: boolean;
  emptyLabel: string;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return <Text style={{ ...typography.caption, color: colors.muted }}>{emptyLabel}</Text>;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {items.map((item) => {
        const on = selected.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            disabled={disabled}
            haptic="light"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 32,
              paddingHorizontal: 10,
              borderRadius: radii.full,
              borderWidth: 1,
              borderColor: on ? colors.brand : colors.border,
              backgroundColor: on ? colors.brandSoft : "transparent",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {item.color !== undefined ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color || "#99aab5" }} /> : null}
            <Text style={{ ...typography.caption, ...fw(on ? 700 : 500), color: on ? colors.bright : colors.muted }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
