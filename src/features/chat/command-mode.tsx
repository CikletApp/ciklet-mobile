import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View, type KeyboardTypeOptions } from "react-native";

import { useDirect, useDirectDisplay, useMemberSearch, useServerChannels, type ChatKind } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { Avatar, Icon, showToast, type IconName } from "@/components/ui";
import { useLocale, useT, type MessageKey } from "@/lib/i18n";
import { pickDocuments, uploadMessageAttachment } from "@/lib/uploads";
import { useDebouncedValue } from "@/lib/use-debounced";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import {
  ApplicationCommandOptionType as T,
  cikletChannelType,
  coerceOptionValue,
  leafOptions,
  localize,
  resolveInvocation,
  wrapLeafInputs,
  type AutocompleteChoice,
  type CommandOption,
  type InvocationOptionInput,
} from "./app-commands";
import { FloatingList, ListHeader, type CommandMatch } from "./components/command-suggestions";
import {
  requestAutocomplete,
  runSlashCommand,
  silentNotice,
  waitForAck,
  type CommandAttachment,
  type SlashCommandEntry,
} from "./interactions";
import { useServerRoles } from "./server-assets";

/**
 * Yazı kutusunun "komut kipi" (Discord gibi; web chat-input ile aynı akış).
 *
 * "/" listesinden komut seçilince kutunun üstünde `/ad alt` etiketi ve
 * seçenek çipleri (`ad: değer`) belirir. Zorunlu seçenekler hemen eklenir,
 * ilki odaklanır; yazı kutusu ODAKTAKİ seçeneğin metnini düzenler. İsteğe
 * bağlılar, hiçbir alan odakta değilken üstteki "İsteğe bağlı" listesinden
 * eklenir. Odaktaki seçeneğin türüne göre üstte seçici açılır (sabit
 * seçimler, otomatik tamamlama, Doğru/Yanlış, kullanıcı/rol/kanal, dosya).
 *
 * Dokunmatik karşılıklar (web klavye kısayolları yerine): çipe dokun → o
 * alan; çipteki × → isteğe bağlı seçeneği kaldır (komut etiketindeki ×
 * kipten çıkar); boş alanda geri silme → isteğe bağlı çipi kaldırır, ilk
 * alanda kipten çıkar; gönder düğmesi → doğrula ve çalıştır.
 *
 * Gönderimde `resolveInvocation` (sunucuyla aynı kural ve metinler) hata
 * verirse metin kutunun altında kırmızı görünür ve ilgili alana odaklanılır.
 */

interface CommandField {
  option: CommandOption;
  /** Kutuda görünen metin: serbest değer ya da seçicide arama. */
  text: string;
  /** Seçiciden alınan değer; metin değişince düşer. */
  picked?: { value: string | number | boolean; display: string };
  /** Dosya seçeneği: yüklenmiş dosya. */
  file?: { url: string; name: string; size: number; mimeType: string | null };
  uploading?: boolean;
}

export interface CommandModeState {
  /** Kipin açıldığı sohbet; sohbet değişince kip kapalı sayılır. */
  chatId: string;
  entry: SlashCommandEntry;
  path: string[];
  /** `ad grup alt` (yerel adlarla). */
  label: string;
  defs: CommandOption[];
  fields: CommandField[];
  /** Odaktaki alan; -1 = hiçbiri (isteğe bağlı listesi). */
  focus: number;
  /** Odak yokken yazılan süzgeç metni. */
  filter: string;
  error: string | null;
}

/** Değeri yalnızca seçiciden alınabilen türler (metin arama içindir). */
const PICKER_ONLY = new Set<number>([T.USER, T.CHANNEL, T.ROLE, T.MENTIONABLE, T.ATTACHMENT]);

export function optionLabel(option: CommandOption, locale: string): string {
  return localize(option.name, option.name_localizations, locale);
}

/** Odaktaki seçeneğin yer tutucu metni. */
function placeholderKey(option: CommandOption): MessageKey {
  switch (option.type) {
    case T.INTEGER:
    case T.NUMBER:
      return option.choices || option.autocomplete ? "appCommands.enterValue" : "appCommands.enterNumber";
    case T.USER:
      return "appCommands.selectUser";
    case T.ROLE:
      return "appCommands.selectRole";
    case T.CHANNEL:
      return "appCommands.selectChannel";
    case T.MENTIONABLE:
      return "appCommands.selectMentionable";
    case T.ATTACHMENT:
      return "appCommands.chooseFile";
    default:
      return "appCommands.enterValue";
  }
}

/** Seçeneğin gönderilecek ham değeri (yoksa undefined). */
function rawValue(field: CommandField, attachmentIds?: Map<CommandField, string>): unknown {
  if (field.option.type === T.ATTACHMENT) return attachmentIds?.get(field);
  if (field.picked) return field.picked.value;
  if (PICKER_ONLY.has(field.option.type)) return undefined;
  return field.text === "" ? undefined : field.text;
}

function leafInputs(fields: CommandField[], attachmentIds?: Map<CommandField, string>): InvocationOptionInput[] {
  const out: InvocationOptionInput[] = [];
  for (const field of fields) {
    const value = rawValue(field, attachmentIds);
    if (value === undefined || value === "") continue;
    out.push({ name: field.option.name, type: field.option.type, value });
  }
  return out;
}

export function useCommandMode({ chatId, onExit }: { chatId: string; onExit?: () => void }) {
  const locale = useLocale();
  const [rawState, setState] = useState<CommandModeState | null>(null);
  const state = rawState && rawState.chatId === chatId ? rawState : null;
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const enter = useCallback(
    (match: CommandMatch) => {
      const defs = leafOptions(match.entry.command, match.path) ?? [];
      const fields: CommandField[] = defs.filter((d) => d.required).map((option) => ({ option, text: "" }));
      setState({
        chatId,
        entry: match.entry,
        path: match.path,
        label: match.label,
        defs,
        fields,
        focus: fields.length > 0 ? 0 : -1,
        filter: "",
        error: null,
      });
    },
    [chatId]
  );

  const exit = useCallback(() => {
    setState(null);
    onExit?.();
  }, [onExit]);

  const focused = state && state.focus >= 0 ? state.fields[state.focus] : undefined;
  const inputValue = state ? (focused ? focused.text : state.filter) : "";

  const onChangeText = useCallback((text: string) => {
    setState((current) => {
      if (!current) return current;
      if (current.focus < 0) return { ...current, filter: text, error: null };
      const fields = current.fields.slice();
      const field = fields[current.focus];
      // Dosya alanına yazılmaz; seçici kullanılır.
      if (!field || field.option.type === T.ATTACHMENT) return current;
      fields[current.focus] = {
        ...field,
        text,
        picked: field.picked && field.picked.display === text ? field.picked : undefined,
      };
      return { ...current, fields, error: null };
    });
  }, []);

  const focusField = useCallback((index: number) => {
    setState((current) => (current ? { ...current, focus: index, filter: "" } : current));
  }, []);

  const removeField = useCallback((index: number) => {
    setState((current) => {
      if (!current) return current;
      const field = current.fields[index];
      if (!field || field.option.required) return current;
      const fields = current.fields.filter((_, i) => i !== index);
      return { ...current, fields, focus: -1, filter: "", error: null };
    });
  }, []);

  const addOptional = useCallback((option: CommandOption) => {
    setState((current) => {
      if (!current || current.fields.some((f) => f.option.name === option.name)) return current;
      const fields = [...current.fields, { option, text: "" }];
      return { ...current, fields, focus: fields.length - 1, filter: "", error: null };
    });
  }, []);

  /** Seçiciden değer alındı: sonraki boş alana geçilir, yoksa odak bırakılır. */
  const pick = useCallback((value: string | number | boolean, display: string) => {
    setState((current) => {
      if (!current || current.focus < 0) return current;
      const fields = current.fields.slice();
      fields[current.focus] = { ...fields[current.focus], text: display, picked: { value, display } };
      const next = fields.findIndex((f, i) => i > current.focus && rawValue(f) === undefined && !f.file);
      return { ...current, fields, focus: next, filter: "", error: null };
    });
  }, []);

  /** Dosya seçeneği: seç → yükle (sohbet eki yüklemesiyle aynı yol) → çipte ad. */
  const chooseFile = useCallback(async () => {
    const index = state?.focus ?? -1;
    if (index < 0) return;
    const picked = await pickDocuments(1);
    if (picked.length === 0) return;
    const asset = picked[0];
    const patch = (fn: (field: CommandField) => CommandField) =>
      setState((current) => {
        if (!current || !current.fields[index]) return current;
        const fields = current.fields.slice();
        fields[index] = fn(fields[index]);
        return { ...current, fields };
      });
    patch((field) => ({ ...field, uploading: true, text: asset.name, file: undefined }));
    try {
      const file = await uploadMessageAttachment(asset);
      setState((current) => {
        if (!current || !current.fields[index]) return current;
        const fields = current.fields.slice();
        fields[index] = { ...fields[index], uploading: false, text: file.name, file: { url: file.url, name: file.name, size: file.size ?? 0, mimeType: file.mimeType ?? null } };
        const next = fields.findIndex((f, i) => i > index && rawValue(f) === undefined && !f.file);
        return { ...current, fields, focus: next, error: null };
      });
    } catch (reason) {
      patch((field) => ({ ...field, uploading: false, text: "" }));
      showToast(reason instanceof Error ? reason.message : "Dosya yüklenemedi.", "error");
    }
  }, [state?.focus]);

  /** Boş alanda geri silme (web Backspace kuralı). */
  const onBackspaceEmpty = useCallback(() => {
    if (!state) return;
    if (state.focus <= 0 && (state.focus === 0 || state.fields.length === 0)) {
      exit();
      return;
    }
    if (state.focus < 0) {
      focusField(state.fields.length - 1);
      return;
    }
    const field = state.fields[state.focus];
    if (field && !field.option.required) removeField(state.focus);
    else focusField(state.focus - 1);
  }, [exit, focusField, removeField, state]);

  const submit = useCallback(async () => {
    if (!state || runningRef.current) return;
    if (state.fields.some((f) => f.uploading)) return;
    const { entry, path, fields } = state;
    const fail = (error: string, focusIndex: number) =>
      setState((current) => (current ? { ...current, error, focus: focusIndex >= 0 ? focusIndex : current.focus } : current));

    // Seçici türüne metin yazılmış ama seçim yapılmamış.
    const unpicked = fields.findIndex((f) => PICKER_ONLY.has(f.option.type) && f.option.type !== T.ATTACHMENT && !f.picked && f.text.trim() !== "");
    if (unpicked >= 0) {
      const result = coerceOptionValue(fields[unpicked].option, undefined, locale);
      fail(result.ok ? "" : result.error, unpicked);
      return;
    }

    const attachmentIds = new Map<CommandField, string>();
    const attachments: CommandAttachment[] = [];
    for (const field of fields) {
      if (field.option.type !== T.ATTACHMENT || !field.file) continue;
      const id = String(attachments.length);
      attachmentIds.set(field, id);
      attachments.push({
        id,
        url: field.file.url,
        filename: field.file.name,
        size: field.file.size,
        ...(field.file.mimeType ? { content_type: field.file.mimeType } : {}),
      });
    }

    const resolved = resolveInvocation(entry.command, wrapLeafInputs(entry.command, path, leafInputs(fields, attachmentIds)), "execute", locale);
    if (!resolved.ok) {
      // Hatalı değer taşıyan ilk alan; yoksa eksik ilk zorunlu seçenek.
      let index = fields.findIndex((f) => {
        const value = rawValue(f, attachmentIds);
        return value !== undefined && value !== "" && !coerceOptionValue(f.option, value, locale).ok;
      });
      if (index < 0) {
        const missing = state.defs.find((d) => d.required && rawValue(fields.find((f) => f.option.name === d.name) ?? { option: d, text: "" }, attachmentIds) === undefined);
        if (missing) index = fields.findIndex((f) => f.option.name === missing.name);
      }
      fail(resolved.error, index);
      return;
    }

    runningRef.current = true;
    setRunning(true);
    try {
      const result = await runSlashCommand(chatId, entry, {
        options: resolved.value.options as InvocationOptionInput[],
        attachments,
      });
      if (!result.ok) {
        fail(result.error, -1);
        return;
      }
      exit();
      void waitForAck(chatId, result.id).then((silent) => {
        if (silent) showToast(silentNotice(entry.bot.name));
      });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [chatId, exit, locale, state]);

  return {
    state,
    active: state !== null,
    running,
    uploading: Boolean(state?.fields.some((f) => f.uploading)),
    focused,
    inputValue,
    enter,
    exit,
    onChangeText,
    focusField,
    removeField,
    addOptional,
    pick,
    chooseFile,
    onBackspaceEmpty,
    submit,
  };
}

export type CommandMode = ReturnType<typeof useCommandMode>;

/** Komut kipindeki yazı kutusunun ayarları. */
export function commandInputProps(mode: CommandMode, t: (key: MessageKey) => string): {
  placeholder: string | undefined;
  keyboardType: KeyboardTypeOptions | undefined;
  maxLength: number | undefined;
} {
  const option = mode.focused?.option;
  if (!option) return { placeholder: undefined, keyboardType: undefined, maxLength: undefined };
  const numeric = (option.type === T.INTEGER || option.type === T.NUMBER) && !option.choices && !option.autocomplete;
  return {
    placeholder: t(placeholderKey(option)),
    keyboardType: numeric ? "numbers-and-punctuation" : undefined,
    maxLength: option.type === T.STRING && !option.choices ? option.max_length : undefined,
  };
}

// ── Çipler ─────────────────────────────────────────────────────────────

/** Yazı kutusunun üstünde: `/ad alt` etiketi + seçenek çipleri. */
export function CommandBar({ mode }: { mode: CommandMode }) {
  const t = useT();
  const locale = useLocale();
  const state = mode.state;
  if (!state) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: spacing.xs, alignItems: "center" }}
    >
      <Chip
        active={false}
        brand
        label={`/${state.label}`}
        accessibilityLabel={`/${state.label}, ${state.entry.bot.name}`}
        onRemove={mode.exit}
      />
      {state.fields.map((field, index) => {
        const name = optionLabel(field.option, locale);
        const value = field.uploading ? t("appCommands.loading") : field.picked?.display ?? field.text;
        return (
          <Chip
            key={field.option.name}
            active={index === state.focus}
            label={`${name}:`}
            value={value}
            accessibilityLabel={`${name}, ${field.option.required ? t("appCommands.required") : t("appCommands.optional")}${value ? `: ${value}` : ""}`}
            onPress={() => mode.focusField(index)}
            onRemove={field.option.required ? undefined : () => mode.removeField(index)}
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  value,
  active,
  brand = false,
  accessibilityLabel,
  onPress,
  onRemove,
}: {
  label: string;
  value?: string;
  active: boolean;
  brand?: boolean;
  accessibilityLabel: string;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        maxWidth: 240,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: brand ? colors.brandSoft : colors.panel,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={accessibilityLabel}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: spacing.sm, paddingRight: onRemove ? 2 : spacing.sm, paddingVertical: 4, flexShrink: 1 }}
      >
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, ...fw(700), color: brand ? colors.brand : colors.bright }}>
          {label}
        </Text>
        {value !== undefined ? (
          <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: colors.text, flexShrink: 1 }}>
            {value}
          </Text>
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Kaldır"
          style={{ paddingHorizontal: 6, paddingVertical: 4 }}
        >
          <Icon name="close" size={12} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Seçici ─────────────────────────────────────────────────────────────

interface PickerRow {
  key: string;
  title: string;
  detail?: string;
  imageUrl?: string | null;
  avatar?: boolean;
  icon?: IconName;
  color?: string | null;
  /** Bilgi satırı (Yükleniyor…, Öneri bulunamadı) — dokunulmaz. */
  info?: boolean;
  onPress?: () => void;
}

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

/** Odaktaki seçeneğe göre yazma çubuğunun üstünde açılan liste. */
export function CommandPicker({
  mode,
  chatId,
  kind,
  serverId,
}: {
  mode: CommandMode;
  chatId: string;
  kind: ChatKind;
  serverId?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const state = mode.state;
  const option = mode.focused?.option;
  const type = option?.type;
  const query = mode.inputValue;
  const picked = Boolean(mode.focused?.picked);
  // Değer seçildiyse metin aramaya dönüşmez; liste tümünü gösterir.
  const search = picked ? "" : query;
  const q = fold(search.trim());

  const inServer = kind === "channel" && Boolean(serverId);
  const wantsMembers = type === T.USER || type === T.MENTIONABLE;
  const wantsRoles = type === T.ROLE || type === T.MENTIONABLE;
  const memberQuery = useDebouncedValue(wantsMembers ? search.trim() : "", 250);
  const members = useMemberSearch(wantsMembers && inServer ? serverId : undefined, memberQuery);
  const roles = useServerRoles(wantsRoles && inServer ? serverId : undefined);
  const channels = useServerChannels(type === T.CHANNEL && inServer ? serverId : undefined);
  const direct = useDirect(kind === "direct" && wantsMembers ? chatId : undefined);
  const display = useDirectDisplay(direct.data);
  const me = useAuth((s) => s.profile);
  const autocomplete = useAutocomplete(mode, chatId);

  const rows = useMemo<PickerRow[]>(() => {
    if (!state) return [];
    if (!option) {
      const used = new Set(state.fields.map((f) => f.option.name));
      return state.defs
        .filter((d) => !d.required && !used.has(d.name))
        .filter((d) => !q || fold(optionLabel(d, locale)).startsWith(q) || d.name.startsWith(q))
        .map((d) => ({
          key: `o-${d.name}`,
          title: optionLabel(d, locale),
          detail: localize(d.description, d.description_localizations, locale),
          onPress: () => mode.addOptional(d),
        }));
    }
    if (option.choices) {
      return option.choices
        .map((c) => ({ c, name: localize(c.name, c.name_localizations, locale) }))
        .filter(({ name }) => !q || fold(name).includes(q))
        .map(({ c, name }) => ({ key: `c-${String(c.value)}`, title: name, onPress: () => mode.pick(c.value, name) }));
    }
    if (option.autocomplete) {
      if (picked) return [];
      if (autocomplete.loading) return [{ key: "ac-loading", title: t("appCommands.loading"), info: true }];
      if (autocomplete.timedOut) return [{ key: "ac-timeout", title: t("appCommands.timedOut"), info: true }];
      if (autocomplete.error) return [{ key: "ac-error", title: autocomplete.error, info: true }];
      if (autocomplete.choices.length === 0) return [{ key: "ac-empty", title: t("appCommands.noSuggestions"), info: true }];
      return autocomplete.choices.map((c, i) => {
        const name = localize(c.name, c.name_localizations, locale);
        return { key: `ac-${i}-${String(c.value)}`, title: name, onPress: () => mode.pick(c.value, name) };
      });
    }
    switch (option.type) {
      case T.BOOLEAN:
        return [
          { key: "b-true", title: t("appCommands.true"), onPress: () => mode.pick(true, t("appCommands.true")) },
          { key: "b-false", title: t("appCommands.false"), onPress: () => mode.pick(false, t("appCommands.false")) },
        ];
      case T.ATTACHMENT:
        return [
          mode.focused?.uploading
            ? { key: "f-loading", title: t("appCommands.loading"), info: true, icon: "attachment" as IconName }
            : { key: "f-pick", title: t("appCommands.chooseFile"), icon: "attachment" as IconName, onPress: () => void mode.chooseFile() },
        ];
      case T.USER:
      case T.MENTIONABLE:
      case T.ROLE: {
        const out: PickerRow[] = [];
        if (option.type !== T.ROLE) {
          if (inServer) {
            for (const member of members.data ?? []) {
              const name = member.nickname?.trim() || member.profile.name?.trim() || member.profile.username;
              if (q && !fold(member.profile.username).startsWith(q) && !fold(name).includes(q)) continue;
              out.push({
                key: `m-${member.profile.id}`,
                title: name,
                detail: `@${member.profile.username}`,
                imageUrl: member.profile.imageUrl,
                avatar: true,
                onPress: () => mode.pick(member.profile.id, name),
              });
            }
          } else {
            // DM: iki taraf.
            const people = [me, display?.peer].filter((p): p is NonNullable<typeof p> => Boolean(p));
            for (const person of people) {
              const name = person.name?.trim() || person.username;
              if (q && !fold(person.username).startsWith(q) && !fold(name).includes(q)) continue;
              out.push({
                key: `m-${person.id}`,
                title: name,
                detail: `@${person.username}`,
                imageUrl: person.imageUrl ?? null,
                avatar: true,
                onPress: () => mode.pick(person.id, name),
              });
            }
          }
        }
        if (option.type !== T.USER) {
          for (const role of roles) {
            if (q && !fold(role.name).includes(q)) continue;
            const name = role.name.startsWith("@") ? role.name : `@${role.name}`;
            out.push({ key: `r-${role.id}`, title: name, icon: "shield", color: role.color, onPress: () => mode.pick(role.id, name) });
          }
        }
        return out.slice(0, 50);
      }
      case T.CHANNEL: {
        const allowed = option.channel_types;
        return (channels.data ?? [])
          .filter((channel) => !allowed || allowed.includes(cikletChannelType(channel as typeof channel & ChannelExtras)))
          .filter((channel) => !q || fold(channel.name).includes(q))
          .map((channel) => ({
            key: `ch-${channel.id}`,
            title: channel.name,
            icon: (channel.type === "TEXT" ? "hash" : "volume") as IconName,
            onPress: () => mode.pick(channel.id, `#${channel.name}`),
          }));
      }
      default:
        return [];
    }
  }, [autocomplete, channels.data, display?.peer, inServer, locale, me, members.data, mode, option, picked, q, roles, state, t]);

  if (!state || rows.length === 0) return null;
  const header = option ? optionLabel(option, locale) : t("appCommands.optional");
  return (
    <FloatingList>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ paddingBottom: spacing.xs }}
        ListHeaderComponent={<ListHeader title={header} />}
        stickyHeaderIndices={[0]}
        renderItem={({ item }) => (
          <Pressable
            onPress={item.onPress}
            disabled={item.info || !item.onPress}
            accessibilityRole={item.info ? "text" : "button"}
            accessibilityLabel={item.detail ? `${item.title}, ${item.detail}` : item.title}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              minHeight: item.info ? 40 : 46,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            {item.avatar ? (
              <Avatar imageUrl={item.imageUrl ?? null} fallbackText={item.title} size={28} />
            ) : item.icon ? (
              <Icon name={item.icon} size={18} color={item.color && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : colors.muted} />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ ...typography.body, ...(item.info ? {} : fw(600)), color: item.info ? colors.muted : colors.bright }}
              >
                {item.title}
              </Text>
              {item.detail ? (
                <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </FloatingList>
  );
}

/**
 * Otomatik tamamlama: odaktaki seçenek `autocomplete` ise yazdıkça 300 ms
 * gecikmeyle sorulur, önceki istek iptal edilir (sonucu yok sayılır).
 */
function useAutocomplete(mode: CommandMode, chatId: string) {
  const state = mode.state;
  const option = mode.focused?.option;
  const enabled = Boolean(state && option?.autocomplete && !mode.focused?.picked);
  const text = mode.focused?.text ?? "";
  // Odaktaki alan dışındaki değerler de gider (bot bağlam için kullanır).
  const request = useMemo(() => {
    if (!enabled || !state || !option) return null;
    const leaf: InvocationOptionInput[] = [];
    for (const field of state.fields) {
      if (field.option.name === option.name) {
        leaf.push({ name: option.name, type: option.type, value: text, focused: true });
        continue;
      }
      const value = rawValue(field);
      if (value !== undefined && value !== "") leaf.push({ name: field.option.name, type: field.option.type, value });
    }
    return { entry: state.entry, options: wrapLeafInputs(state.entry.command, state.path, leaf), key: JSON.stringify(leaf) + state.path.join(" ") };
  }, [enabled, option, state, text]);

  const [result, setResult] = useState<{ key: string; choices: AutocompleteChoice[]; timedOut?: boolean; error?: string } | null>(null);
  const requestKey = request?.key;
  const latest = useRef(request);
  useEffect(() => {
    latest.current = request;
  }, [request]);

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const current = latest.current;
      if (!current) return;
      void requestAutocomplete(chatId, current.entry, current.options, controller.signal).then((res) => {
        if (res.aborted || controller.signal.aborted) return;
        setResult({ key: current.key, choices: res.choices, timedOut: res.timedOut, error: res.error });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chatId, requestKey]);

  const fresh = result && result.key === requestKey ? result : null;
  return {
    loading: enabled && !fresh,
    choices: fresh?.choices ?? [],
    timedOut: Boolean(fresh?.timedOut),
    error: fresh?.error,
  };
}
