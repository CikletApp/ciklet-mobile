import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable as RNPressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDirect, useDirectDisplay, useMemberSearch, useServerChannels } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { Avatar, Button, Icon, Pressable, emojify } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/use-debounced";
import { isAutoSelect, type AnySelectComponent } from "@/lib/message-components";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { cikletChannelType } from "../app-commands";
import type { ChatScope } from "../chat-scope";
import { useServerRoles } from "../server-assets";

/**
 * Seçim menüsü (metin 3, kullanıcı 5, rol 6, bahsedilebilir 7, kanal 8) —
 * ciklet-web `chat/v2/component-select.tsx` ile aynı davranış. Hem mesaj
 * bileşenlerinde hem bot formunda (modal) kullanılır; kontrollüdür.
 *
 * Tetikleyici seçilenleri (yoksa yer tutucuyu) gösterir; dokununca alttan
 * liste açılır. Otomatik menülerde (5–8) liste sunucudan dolar: üyeler,
 * roller, görünür kanallar (`channel_types` süzgeci); bot DM'inde kullanıcı
 * menüsü iki taraftır. `max_values` 1 ise satıra dokunmak seçer; fazlaysa
 * satırlar işaretlenir ve "Seç" ile onaylanır.
 */

export interface SelectItem {
  id: string;
  label: string;
  detail?: string;
  description?: string;
  emoji?: string;
  imageUrl?: string | null;
  kind: "option" | "user" | "role" | "channel";
  color?: string | null;
  voice?: boolean;
}

/** Varsayılan seçili değerler (metin menüsünde `default`, otomatikte `default_values`). */
export function selectDefaults(component: AnySelectComponent): string[] {
  if (isAutoSelect(component)) return (component.default_values ?? []).map((d) => d.id);
  return component.options.filter((o) => o.default).map((o) => o.value);
}

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

/** Seçeneklerin kaynağı — komut kipindeki seçicilerle aynı veriler. */
function useSelectItems(component: AnySelectComponent, scope: ChatScope | null, query: string, active: boolean) {
  const type = component.type;
  const inServer = scope?.kind === "channel" && Boolean(scope.serverId);
  const serverId = inServer ? scope?.serverId : undefined;
  const wantsMembers = type === 5 || type === 7;
  const wantsRoles = type === 6 || type === 7;
  const memberQuery = useDebouncedValue(wantsMembers && active ? query.trim() : "", 250);
  const members = useMemberSearch(wantsMembers ? serverId : undefined, memberQuery);
  const roles = useServerRoles(wantsRoles ? serverId : undefined);
  const channels = useServerChannels(type === 8 ? serverId : undefined);
  const direct = useDirect(scope?.kind === "direct" && wantsMembers ? scope.chatId : undefined);
  const display = useDirectDisplay(direct.data);
  const me = useAuth((s) => s.profile);

  const items = useMemo<SelectItem[]>(() => {
    if (component.type === 3) {
      return component.options.map((o) => ({
        id: o.value,
        label: o.label,
        description: o.description,
        emoji: o.emoji,
        kind: "option" as const,
      }));
    }
    const out: SelectItem[] = [];
    if (wantsMembers) {
      if (inServer) {
        for (const member of members.data ?? []) {
          out.push({
            id: member.profile.id,
            label: member.nickname?.trim() || member.profile.name?.trim() || member.profile.username,
            detail: `@${member.profile.username}`,
            imageUrl: member.profile.imageUrl,
            kind: "user",
          });
        }
      } else {
        // Bot DM'i: iki taraf.
        for (const person of [me, display?.peer]) {
          if (!person) continue;
          out.push({
            id: person.id,
            label: person.name?.trim() || person.username,
            detail: `@${person.username}`,
            imageUrl: person.imageUrl ?? null,
            kind: "user",
          });
        }
      }
    }
    if (wantsRoles) {
      for (const role of roles) {
        out.push({ id: role.id, label: role.name.startsWith("@") ? role.name : `@${role.name}`, kind: "role", color: role.color });
      }
    }
    if (component.type === 8) {
      const allowed = component.channel_types;
      for (const channel of channels.data ?? []) {
        if (allowed && !allowed.includes(cikletChannelType(channel as typeof channel & ChannelExtras))) continue;
        out.push({ id: channel.id, label: channel.name, kind: "channel", voice: channel.type !== "TEXT" });
      }
    }
    return out;
  }, [channels.data, component, display?.peer, inServer, me, members.data, roles, wantsMembers, wantsRoles]);

  const loading = (wantsMembers && inServer && members.isLoading) || (type === 8 && inServer && channels.isLoading);
  return { items, loading };
}

export function SelectField({
  component,
  scope,
  values,
  onCommit,
  busy,
  error,
}: {
  component: AnySelectComponent;
  scope: ChatScope | null;
  values: string[];
  /** Mesajda: etkileşimi başlatır; formda: değeri yazar. */
  onCommit: (values: string[]) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { items } = useSelectItems(component, scope, "", values.length > 0);
  const disabled = Boolean(component.disabled) || Boolean(busy);
  const chosen = values.map((id) => items.find((i) => i.id === id)?.label ?? t("messageComponents.unknown"));
  const label = chosen.length > 0 ? chosen.join(", ") : component.placeholder || t("messageComponents.choose");

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={component.placeholder ?? t("messageComponents.chooseOption")}
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
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: pressed ? colors.raised : colors.panel,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, color: chosen.length > 0 ? colors.bright : colors.muted, flexShrink: 1 }}>
          {label}
        </Text>
        {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Icon name="chevron-down" size={14} color={colors.muted} />}
      </Pressable>
      {open ? (
        <SelectSheet
          component={component}
          scope={scope}
          initial={values}
          onClose={() => setOpen(false)}
          onCommit={(next) => {
            setOpen(false);
            onCommit(next);
          }}
        />
      ) : null}
    </>
  );
}

function SelectSheet({
  component,
  scope,
  initial,
  onClose,
  onCommit,
}: {
  component: AnySelectComponent;
  scope: ChatScope | null;
  initial: string[];
  onClose: () => void;
  onCommit: (values: string[]) => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(initial);
  const { items, loading } = useSelectItems(component, scope, query, true);
  const multi = (component.max_values ?? 1) > 1;
  const min = component.min_values ?? 1;
  const max = component.max_values ?? 1;
  const searchable = isAutoSelect(component) || component.options.length > 10;
  const q = fold(query.trim().replace(/^[#@]/, ""));
  const shown = q ? items.filter((i) => fold(i.label).includes(q) || (i.detail ? fold(i.detail).includes(q) : false)) : items;
  const canConfirm = draft.length >= min && draft.length <= max;

  const toggle = (id: string) => {
    if (!multi) {
      onCommit([id]);
      return;
    }
    setDraft((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : current.length >= max ? current : [...current, id]
    );
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("messageComponents.cancel")}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <Animated.View
          entering={SlideInDown.duration(200)}
          onStartShouldSetResponder={() => true}
          style={{
            maxHeight: "75%",
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
            {(component.placeholder || t("messageComponents.chooseOption")).toLocaleUpperCase("tr-TR")}
          </Text>
          {searchable ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: spacing.sm,
                marginBottom: spacing.xs,
                paddingHorizontal: spacing.md,
                height: 38,
                borderRadius: radii.md,
                backgroundColor: colors.deep,
              }}
            >
              <Icon name="search" size={14} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("messageComponents.search")}
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={{ flex: 1, ...typography.body, color: colors.bright, paddingVertical: 0 }}
              />
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {loading && shown.length === 0 ? (
              <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md }}>{t("messageComponents.loading")}</Text>
            ) : shown.length === 0 ? (
              <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.md }}>{t("messageComponents.noResults")}</Text>
            ) : (
              shown.map((item) => {
                const selected = draft.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    noHitSlop
                    onPress={() => toggle(item.id)}
                    accessibilityRole={multi ? "checkbox" : "button"}
                    accessibilityState={{ checked: multi ? selected : undefined, selected }}
                    accessibilityLabel={item.label}
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
                    <ItemLead item={item} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ ...typography.body, ...fw(600), color: item.kind === "role" && item.color ? item.color : colors.bright }}>
                        {item.label}
                      </Text>
                      {item.description || item.detail ? (
                        <Text numberOfLines={2} style={{ ...typography.caption, color: colors.muted }}>
                          {item.description ?? item.detail}
                        </Text>
                      ) : null}
                    </View>
                    {multi ? (
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          borderWidth: 2,
                          borderColor: selected ? colors.brand : colors.border,
                          backgroundColor: selected ? colors.brand : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {selected ? <Icon name="check" size={13} color={colors.onBrand} /> : null}
                      </View>
                    ) : selected ? (
                      <Icon name="check" size={16} color={colors.brand} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          {multi ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, padding: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
                {draft.length > 0
                  ? t("messageComponents.selectedCount", { count: draft.length })
                  : t("messageComponents.selectRange", { min, max })}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {draft.length > 0 ? <Button label={t("messageComponents.clear")} variant="ghost" onPress={() => setDraft([])} /> : null}
                <Button label={t("messageComponents.confirm")} disabled={!canConfirm} onPress={() => onCommit(draft)} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </RNPressable>
    </Modal>
  );
}

function ItemLead({ item }: { item: SelectItem }) {
  if (item.kind === "user") return <Avatar imageUrl={item.imageUrl} fallbackText={item.label} size={28} />;
  if (item.kind === "role") {
    return <View style={{ width: 12, height: 12, borderRadius: 6, marginHorizontal: 8, backgroundColor: item.color || colors.muted }} />;
  }
  if (item.kind === "channel") return <Icon name={item.voice ? "volume" : "hash"} size={18} color={colors.muted} />;
  return item.emoji ? <Text style={{ fontSize: 18 }}>{emojify(item.emoji, `so-${item.id}`, 20)}</Text> : null;
}
