import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Pressable, emojify, showToast } from "@/components/ui";
import type { ActionRow, ButtonComponent, SelectMenuComponent } from "@/lib/message-extras";
import { isChannelMessage, type ChatMessagePayload } from "@/realtime/events";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { runComponentInteraction, waitForAck } from "../interactions";

/**
 * Bot mesajının altındaki butonlar / seçim menüsü — ciklet-web
 * `chat/v2/message-components.tsx`. Dokunma type 3 etkileşim açar (aynı uç);
 * bot yanıtlayınca mesaj akıştan güncellenir. Bağlantı butonu (stil 5)
 * etkileşim açmaz, adresi açar. Yalnızca sunucu kanalında (uç kanal ister).
 */
export function MessageComponents({ message, rows }: { message: ChatMessagePayload; rows: ActionRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<SelectMenuComponent | null>(null);
  const channelId = isChannelMessage(message) ? message.channelId : null;
  const botName = isChannelMessage(message)
    ? message.member.profile.name?.trim() || message.member.profile.username
    : "Bot";

  const fire = async (customId: string, values?: string[]) => {
    if (!channelId || busy) return;
    setBusy(customId);
    const result = await runComponentInteraction(channelId, message.id, customId, values);
    setBusy(null);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    void waitForAck(channelId, result.id).then((silent) => {
      if (silent) showToast(`${botName} yanıt vermedi.`);
    });
  };

  if (!channelId) return null;

  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {row.components.map((component, index) =>
            component.type === 2 ? (
              <ComponentButton
                key={index}
                component={component}
                busy={busy === component.custom_id}
                onPress={() => {
                  if (component.style === 5) {
                    if (component.url) void Linking.openURL(component.url);
                    return;
                  }
                  if (component.custom_id) void fire(component.custom_id);
                }}
              />
            ) : (
              <SelectTrigger
                key={index}
                component={component}
                busy={busy === component.custom_id}
                onPress={() => setMenu(component)}
              />
            )
          )}
        </View>
      ))}

      {menu ? (
        <SelectSheet
          component={menu}
          onClose={() => setMenu(null)}
          onPick={(value) => {
            const id = menu.custom_id;
            setMenu(null);
            void fire(id, [value]);
          }}
        />
      ) : null}
    </View>
  );
}

function buttonColors(style: ButtonComponent["style"]): { background: string; text: string } {
  switch (style) {
    case 1:
      return { background: colors.brand, text: colors.onBrand };
    case 3:
      return { background: colors.success, text: "#ffffff" };
    case 4:
      return { background: colors.dangerSolid, text: "#ffffff" };
    default:
      return { background: colors.raised, text: colors.bright };
  }
}

function ComponentButton({ component, busy, onPress }: { component: ButtonComponent; busy: boolean; onPress: () => void }) {
  const tone = buttonColors(component.style);
  const disabled = Boolean(component.disabled) || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      accessibilityRole={component.style === 5 ? "link" : "button"}
      accessibilityLabel={component.label ?? component.emoji ?? "Düğme"}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 32,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: tone.background,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone.text} /> : null}
      {component.emoji ? <Text style={{ fontSize: 14 }}>{emojify(component.emoji, `cb-${component.custom_id ?? component.url}`, 16)}</Text> : null}
      {component.label ? (
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, ...fw(600), color: tone.text, maxWidth: 200 }}>
          {component.label}
        </Text>
      ) : null}
      {component.style === 5 ? <Icon name="link" size={12} color={tone.text} /> : null}
    </Pressable>
  );
}

function SelectTrigger({ component, busy, onPress }: { component: SelectMenuComponent; busy: boolean; onPress: () => void }) {
  const chosen = component.options.find((option) => option.default);
  const disabled = Boolean(component.disabled) || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={component.placeholder ?? "Seç"}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        minWidth: 200,
        maxWidth: "100%",
        height: 34,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.raised : colors.panel,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, color: chosen ? colors.bright : colors.muted, flexShrink: 1 }}>
        {chosen ? chosen.label : component.placeholder || "Seç…"}
      </Text>
      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Icon name="chevron-down" size={14} color={colors.muted} />}
    </Pressable>
  );
}

/** Seçim menüsünün seçenekleri — alttan açılan liste. */
function SelectSheet({
  component,
  onClose,
  onPick,
}: {
  component: SelectMenuComponent;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <Animated.View
          entering={SlideInDown.duration(200)}
          style={{
            maxHeight: "70%",
            marginHorizontal: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: 6,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.overline, color: colors.muted, padding: spacing.md }}>
            {(component.placeholder || "Bir seçenek seç").toLocaleUpperCase("tr-TR")}
          </Text>
          <ScrollView>
            {component.options.map((option) => (
              <Pressable
                key={option.value}
                noHitSlop
                onPress={() => onPick(option.value)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  minHeight: 52,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: pressed ? colors.raised : "transparent",
                })}
              >
                {option.emoji ? <Text style={{ fontSize: 18 }}>{emojify(option.emoji, `so-${option.value}`, 20)}</Text> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.body, ...fw(600), color: colors.bright }}>{option.label}</Text>
                  {option.description ? (
                    <Text style={{ ...typography.caption, color: colors.muted }}>{option.description}</Text>
                  ) : null}
                </View>
                {option.default ? <Icon name="check" size={16} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </RNPressable>
    </Modal>
  );
}
