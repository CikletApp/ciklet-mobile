import type { ReactNode } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable as RNPressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Pressable, type IconName } from "@/components/ui";
import { EmojiPickerPanel } from "@/features/chat/components/emoji-picker";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucu ayar formlarının ortak parçaları (Karşılama Ekranı, Katılım
 * Soruları, Sunucu Rehberi) — web sekmelerindeki kart / anahtar / kanal
 * seçici / emoji seçici karşılıkları. Görünüm roles.tsx ve audit-log.tsx
 * ile aynı dil.
 */

/** Web `CARD`: kenarlıklı panel kutusu. */
export function FormCard({ children, gap = spacing.md }: { children: ReactNode; gap?: number }) {
  return (
    <View
      style={{
        gap,
        padding: spacing.lg,
        borderRadius: radii.xl,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.bentoBorder,
        backgroundColor: colors.panel,
      }}
    >
      {children}
    </View>
  );
}

/** Web `LABEL`: küçük, büyük harfli alan başlığı (+ isteğe bağlı sayaç). */
export function FormLabel({ children, counter }: { children: string; counter?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted, flexShrink: 1 }}>{children.toLocaleUpperCase("tr-TR")}</Text>
      {counter ? <Text style={{ ...typography.caption, fontSize: 11, color: colors.muted }}>{counter}</Text> : null}
    </View>
  );
}

export function FormHint({ children }: { children: string }) {
  return <Text style={{ ...typography.caption, color: colors.muted }}>{children}</Text>;
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{title}</Text>
        {subtitle ? <Text style={{ ...typography.caption, color: colors.muted }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />
    </View>
  );
}

/** Satır içi küçük simge düğmesi (yukarı/aşağı taşı, kaldır). */
export function RowIconButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
  rotate,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** "chevron-down" ile yukarı ok için 180. */
  rotate?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.md,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.3 : 1,
      })}
    >
      <View style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}>
        <Icon name={icon} size={17} color={danger ? colors.danger : colors.muted} />
      </View>
    </Pressable>
  );
}

/** Kesik çizgili "… ekle" düğmesi. */
export function AddButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        minHeight: 42,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name="plus" size={16} color={colors.brand} />
      <Text style={{ ...typography.caption, ...fw(600), color: colors.brand }}>{label}</Text>
    </Pressable>
  );
}

/** Seçim kutusu görünümlü düğme — dokununca seçim sayfası açılır. */
export function SelectButton({
  value,
  placeholder,
  onPress,
  disabled,
  icon,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ?? placeholder}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : colors.deep,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={15} color={colors.muted} /> : null}
      <Text style={{ ...typography.body, color: value ? colors.text : colors.muted, flex: 1 }} numberOfLines={1}>
        {value ?? placeholder}
      </Text>
      <Icon name="chevron-down" size={14} color={colors.muted} />
    </Pressable>
  );
}

export interface ChoiceOption {
  id: string;
  label: string;
  icon?: IconName;
  /** Rol rengi gibi küçük nokta. */
  dot?: string | null;
}

/** Kaydırılabilir seçim sayfası (kanal / rol listesi) — audit-log PickerSheet deseni. */
export function ChoiceSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onPick,
  empty,
}: {
  visible: boolean;
  title?: string;
  options: ChoiceOption[];
  /** Seçili kimlikler (çoklu seçimde birden çok). */
  selected: readonly string[];
  onClose: () => void;
  onPick: (id: string) => void;
  empty?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <RNPressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "70%",
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm }} />
          {title ? (
            <Text style={{ ...typography.bodyStrong, color: colors.bright, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>{title}</Text>
          ) : null}
          {options.length === 0 && empty ? (
            <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.lg }}>{empty}</Text>
          ) : null}
          <FlatList
            data={options}
            keyExtractor={(option) => option.id}
            renderItem={({ item }) => {
              const active = selected.includes(item.id);
              return (
                <Pressable
                  onPress={() => onPick(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    minHeight: 48,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: pressed ? colors.raised : "transparent",
                  })}
                >
                  {item.dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.dot }} /> : null}
                  {item.icon ? <Icon name={item.icon} size={16} color={colors.muted} /> : null}
                  <Text style={{ ...typography.body, color: active ? colors.brand : colors.text, flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {active ? <Icon name="check" size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Alttan açılan emoji seçici (roles.tsx'teki rol simgesi sayfasıyla aynı kabuk). */
export function EmojiSheet({
  visible,
  title,
  onClose,
  onEmoji,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onEmoji: (emoji: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <RNPressable onPress={onClose} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          onStartShouldSetResponder={() => true}
          style={{
            height: 440,
            marginHorizontal: spacing.sm,
            marginBottom: spacing.sm,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" style={{ padding: spacing.xs }}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <EmojiPickerPanel
            onEmoji={(emoji) => {
              onClose();
              onEmoji(emoji);
            }}
          />
        </View>
      </RNPressable>
    </Modal>
  );
}

/** Başlık çubuğundaki "Kaydet" (settings.tsx deseni). */
export function SaveHeaderButton({ dirty, busy, onPress }: { dirty: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!dirty || busy} accessibilityRole="button" accessibilityLabel="Kaydet">
      {busy ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <Text style={{ ...typography.bodyStrong, color: dirty ? colors.brand : colors.muted }}>Kaydet</Text>
      )}
    </Pressable>
  );
}
