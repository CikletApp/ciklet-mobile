/**
 * Mesaj bileşenleri — ciklet-web `lib/message-components` (Discord şeması).
 *
 * Sunucu bileşenleri doğrulayıp metadata'ya yazar (`metadata.components`,
 * Components V2 mesajında ayrıca `metadata.componentsV2: true`). Burada
 * yalnızca DEPODAN OKUMA var (web `readStoredComponents`): bozuk parça
 * atılır, ekran çökmez.
 *
 *  - Eski biçim: en çok 5 eylem satırı (1); satırda butonlar (2) ya da tek
 *    seçim menüsü (3 metin, 5 kullanıcı, 6 rol, 7 bahsedilebilir, 8 kanal).
 *  - V2: Kap (17), Bölüm (9) + Küçük Görsel (11) ya da buton, Metin (10),
 *    Medya Galerisi (12), Dosya (13), Ayırıcı (14), eylem satırı (1).
 */

export const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  USER_SELECT: 5,
  ROLE_SELECT: 6,
  MENTIONABLE_SELECT: 7,
  CHANNEL_SELECT: 8,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  FILE: 13,
  SEPARATOR: 14,
  CONTAINER: 17,
  LABEL: 18,
  FILE_UPLOAD: 19,
  RADIO_GROUP: 21,
  CHECKBOX_GROUP: 22,
  CHECKBOX: 23,
} as const;

const MAX_ACTION_ROWS = 5;
const MAX_BUTTONS_PER_ROW = 5;
const MAX_SELECT_OPTIONS = 25;
const MAX_V2_COMPONENTS = 40;
const MAX_V2_TEXT = 4000;
const MAX_GALLERY_ITEMS = 10;
const MAX_SECTION_TEXTS = 3;

export interface ButtonComponent {
  type: 2;
  id?: number;
  style: 1 | 2 | 3 | 4 | 5;
  label?: string;
  emoji?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

export interface SelectMenuComponent {
  type: 3;
  id?: number;
  custom_id: string;
  placeholder?: string;
  options: SelectOption[];
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  required?: boolean;
}

export type AutoSelectType = 5 | 6 | 7 | 8;
export type DefaultValueType = "user" | "role" | "channel";

export interface SelectDefaultValue {
  id: string;
  type: DefaultValueType;
}

export interface AutoSelectComponent {
  type: AutoSelectType;
  id?: number;
  custom_id: string;
  placeholder?: string;
  default_values?: SelectDefaultValue[];
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
  channel_types?: number[];
  required?: boolean;
}

export type AnySelectComponent = SelectMenuComponent | AutoSelectComponent;

export interface ActionRow {
  type: 1;
  id?: number;
  components: (ButtonComponent | AnySelectComponent)[];
}

export interface MediaItem {
  url: string;
  proxy_url?: string;
  content_type?: string;
  width?: number | null;
  height?: number | null;
  attachment_id?: string;
}

export interface TextDisplayComponent {
  type: 10;
  id?: number;
  content: string;
}

export interface ThumbnailComponent {
  type: 11;
  id?: number;
  media: MediaItem;
  description?: string;
  spoiler?: boolean;
}

export interface SectionComponent {
  type: 9;
  id?: number;
  components: TextDisplayComponent[];
  accessory: ButtonComponent | ThumbnailComponent;
}

export interface MediaGalleryItem {
  media: MediaItem;
  description?: string;
  spoiler?: boolean;
}

export interface MediaGalleryComponent {
  type: 12;
  id?: number;
  items: MediaGalleryItem[];
}

export interface FileComponent {
  type: 13;
  id?: number;
  file: MediaItem;
  spoiler?: boolean;
  name?: string;
  size?: number;
}

export interface SeparatorComponent {
  type: 14;
  id?: number;
  divider?: boolean;
  spacing?: 1 | 2;
}

export type ContainerChild =
  | ActionRow
  | TextDisplayComponent
  | SectionComponent
  | MediaGalleryComponent
  | SeparatorComponent
  | FileComponent;

export interface ContainerComponent {
  type: 17;
  id?: number;
  components: ContainerChild[];
  accent_color?: number | null;
  spoiler?: boolean;
}

export type MessageComponent = ContainerChild | ContainerComponent;

// ── Okuyucu ─────────────────────────────────────────────────────────────

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t.slice(0, max) : undefined;
}

function idOf(raw: Record<string, unknown>): { id?: number } {
  return Number.isInteger(raw.id) && (raw.id as number) > 0 ? { id: raw.id as number } : {};
}

function int(value: unknown, min: number, max: number): number | undefined {
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value as number)) : undefined;
}

/** Emoji metni ya da Discord kısmi emoji nesnesi (sunucu metne çevirir). */
function emojiOf(value: unknown): string | undefined {
  if (typeof value === "string") return str(value, 64);
  const o = obj(value);
  if (!o) return undefined;
  const name = typeof o.name === "string" ? o.name : "";
  const id = typeof o.id === "string" || typeof o.id === "number" ? String(o.id) : "";
  if (id && /^\d+$/.test(id) && name) return `<${o.animated === true ? "a" : ""}:${name}:${id}>`;
  return name || undefined;
}

function safeUrl(value: unknown): string | undefined {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined;
}

function button(raw: Record<string, unknown>): ButtonComponent | null {
  const style = ([1, 2, 3, 4, 5] as const).find((s) => s === Number(raw.style)) ?? 2;
  const label = str(raw.label, 80);
  const emoji = emojiOf(raw.emoji);
  if (!label && !emoji) return null;
  const out: ButtonComponent = { type: 2, ...idOf(raw), style };
  if (label) out.label = label;
  if (emoji) out.emoji = emoji;
  if (raw.disabled === true) out.disabled = true;
  if (style === 5) {
    const url = safeUrl(raw.url);
    if (!url) return null;
    out.url = url;
    return out;
  }
  const id = str(raw.custom_id, 100);
  if (!id) return null;
  out.custom_id = id;
  return out;
}

function stringSelect(raw: Record<string, unknown>): SelectMenuComponent | null {
  const id = str(raw.custom_id, 100);
  if (!id || !Array.isArray(raw.options)) return null;
  const seen = new Set<string>();
  const options: SelectOption[] = [];
  for (const entry of raw.options) {
    const o = obj(entry);
    const label = o ? str(o.label, 100) : undefined;
    const value = o ? str(o.value, 100) : undefined;
    if (!o || !label || !value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      label,
      value,
      ...(str(o.description, 100) ? { description: str(o.description, 100) } : {}),
      ...(emojiOf(o.emoji) ? { emoji: emojiOf(o.emoji) } : {}),
      ...(o.default === true ? { default: true } : {}),
    });
    if (options.length >= MAX_SELECT_OPTIONS) break;
  }
  if (options.length === 0) return null;
  const min = int(raw.min_values, 0, options.length);
  const max = int(raw.max_values, 1, options.length);
  return {
    type: 3,
    ...idOf(raw),
    custom_id: id,
    options,
    ...(str(raw.placeholder, 150) ? { placeholder: str(raw.placeholder, 150) } : {}),
    ...(min !== undefined ? { min_values: min } : {}),
    ...(max !== undefined ? { max_values: Math.max(max, min ?? 0, 1) } : {}),
    ...(raw.disabled === true ? { disabled: true } : {}),
    ...(raw.required === false ? { required: false } : {}),
  };
}

const DEFAULT_TYPES: Record<AutoSelectType, readonly DefaultValueType[]> = {
  5: ["user"],
  6: ["role"],
  7: ["user", "role"],
  8: ["channel"],
};

function autoSelect(raw: Record<string, unknown>, type: AutoSelectType): AutoSelectComponent | null {
  const id = str(raw.custom_id, 100);
  if (!id) return null;
  const out: AutoSelectComponent = { type, ...idOf(raw), custom_id: id };
  const placeholder = str(raw.placeholder, 150);
  if (placeholder) out.placeholder = placeholder;
  const min = int(raw.min_values, 0, 25);
  const max = int(raw.max_values, 1, 25);
  if (min !== undefined) out.min_values = min;
  if (max !== undefined) out.max_values = Math.max(max, min ?? 0, 1);
  if (raw.disabled === true) out.disabled = true;
  if (raw.required === false) out.required = false;
  if (type === 8 && Array.isArray(raw.channel_types)) {
    const types = raw.channel_types.filter((t): t is number => Number.isInteger(t));
    if (types.length > 0) out.channel_types = types;
  }
  if (Array.isArray(raw.default_values)) {
    const defaults = raw.default_values.flatMap((entry): SelectDefaultValue[] => {
      const d = obj(entry);
      const dId = d && (typeof d.id === "string" || typeof d.id === "number") ? String(d.id) : "";
      const dType = d?.type as DefaultValueType;
      return dId && DEFAULT_TYPES[type].includes(dType) ? [{ id: dId, type: dType }] : [];
    });
    if (defaults.length > 0) out.default_values = defaults.slice(0, out.max_values ?? 1);
  }
  return out;
}

export function isSelectType(type: unknown): type is 3 | AutoSelectType {
  return type === 3 || type === 5 || type === 6 || type === 7 || type === 8;
}

export function isAutoSelect(c: { type: number }): c is AutoSelectComponent {
  return c.type === 5 || c.type === 6 || c.type === 7 || c.type === 8;
}

/** Seçim menüsü (her tür); modal da kullanır. */
export function readSelect(raw: unknown): AnySelectComponent | null {
  const o = obj(raw);
  if (!o) return null;
  const type = Number(o.type);
  if (type === 3) return stringSelect(o);
  if (type === 5 || type === 6 || type === 7 || type === 8) return autoSelect(o, type);
  return null;
}

function actionRow(raw: Record<string, unknown>, ids: Set<string>): ActionRow | null {
  const items = Array.isArray(raw.components) ? raw.components : [raw];
  const components: ActionRow["components"] = [];
  for (const entry of items) {
    const item = obj(entry);
    if (!item) continue;
    const type = Number(item.type);
    if (isSelectType(type)) {
      const menu = readSelect(item);
      if (!menu || ids.has(menu.custom_id)) continue;
      ids.add(menu.custom_id);
      components.splice(0, components.length, menu);
      break;
    }
    if (type === 2) {
      const btn = button(item);
      if (!btn) continue;
      if (btn.custom_id) {
        if (ids.has(btn.custom_id)) continue;
        ids.add(btn.custom_id);
      }
      components.push(btn);
      if (components.length >= MAX_BUTTONS_PER_ROW) break;
    }
  }
  return components.length > 0 ? { type: 1, ...idOf(raw), components } : null;
}

function mediaItem(raw: unknown): MediaItem | null {
  const o = obj(raw);
  const url = o ? safeUrl(o.url) : undefined;
  if (!o || !url) return null;
  const out: MediaItem = { url };
  const proxy = safeUrl(o.proxy_url);
  if (proxy) out.proxy_url = proxy;
  if (typeof o.content_type === "string") out.content_type = o.content_type.slice(0, 100);
  if (Number.isInteger(o.width)) out.width = o.width as number;
  if (Number.isInteger(o.height)) out.height = o.height as number;
  if (typeof o.attachment_id === "string") out.attachment_id = o.attachment_id;
  return out;
}

function textDisplay(raw: Record<string, unknown>): TextDisplayComponent | null {
  const content = typeof raw.content === "string" ? raw.content : "";
  return content.trim() ? { type: 10, ...idOf(raw), content: content.slice(0, MAX_V2_TEXT) } : null;
}

/** Modal da kullanır. */
export function readTextDisplay(raw: unknown): TextDisplayComponent | null {
  const o = obj(raw);
  return o && Number(o.type) === 10 ? textDisplay(o) : null;
}

function thumbnail(raw: Record<string, unknown>): ThumbnailComponent | null {
  const media = mediaItem(raw.media);
  if (!media) return null;
  return {
    type: 11,
    ...idOf(raw),
    media,
    ...(str(raw.description, 1024) ? { description: str(raw.description, 1024) } : {}),
    ...(raw.spoiler === true ? { spoiler: true } : {}),
  };
}

function section(raw: Record<string, unknown>, ids: Set<string>): SectionComponent | null {
  const texts = (Array.isArray(raw.components) ? raw.components : [])
    .slice(0, MAX_SECTION_TEXTS)
    .map((c) => readTextDisplay(c))
    .filter((t): t is TextDisplayComponent => t !== null);
  const acc = obj(raw.accessory);
  if (texts.length === 0 || !acc) return null;
  let accessory: ButtonComponent | ThumbnailComponent | null = null;
  if (Number(acc.type) === 2) {
    accessory = button(acc);
    if (accessory?.custom_id) {
      if (ids.has(accessory.custom_id)) return null;
      ids.add(accessory.custom_id);
    }
  } else if (Number(acc.type) === 11) {
    accessory = thumbnail(acc);
  }
  return accessory ? { type: 9, ...idOf(raw), components: texts, accessory } : null;
}

function mediaGallery(raw: Record<string, unknown>): MediaGalleryComponent | null {
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_GALLERY_ITEMS).flatMap((entry): MediaGalleryItem[] => {
    const o = obj(entry);
    const media = o ? mediaItem(o.media) : null;
    if (!o || !media) return [];
    return [{
      media,
      ...(str(o.description, 1024) ? { description: str(o.description, 1024) } : {}),
      ...(o.spoiler === true ? { spoiler: true } : {}),
    }];
  });
  return items.length > 0 ? { type: 12, ...idOf(raw), items } : null;
}

function fileComponent(raw: Record<string, unknown>): FileComponent | null {
  const file = mediaItem(raw.file);
  if (!file) return null;
  return {
    type: 13,
    ...idOf(raw),
    file,
    ...(raw.spoiler === true ? { spoiler: true } : {}),
    ...(typeof raw.name === "string" ? { name: raw.name.slice(0, 255) } : {}),
    ...(Number.isInteger(raw.size) && (raw.size as number) >= 0 ? { size: raw.size as number } : {}),
  };
}

function separator(raw: Record<string, unknown>): SeparatorComponent {
  return {
    type: 14,
    ...idOf(raw),
    ...(raw.divider === false ? { divider: false } : {}),
    ...(Number(raw.spacing) === 2 ? { spacing: 2 as const } : {}),
  };
}

function containerChild(raw: Record<string, unknown>, ids: Set<string>): ContainerChild | null {
  switch (Number(raw.type)) {
    case 1:
      return actionRow(raw, ids);
    case 10:
      return textDisplay(raw);
    case 9:
      return section(raw, ids);
    case 12:
      return mediaGallery(raw);
    case 14:
      return separator(raw);
    case 13:
      return fileComponent(raw);
    default:
      return null;
  }
}

function container(raw: Record<string, unknown>, ids: Set<string>): ContainerComponent | null {
  const children = (Array.isArray(raw.components) ? raw.components : [])
    .map((c) => obj(c))
    .map((c) => (c ? containerChild(c, ids) : null))
    .filter((c): c is ContainerChild => c !== null);
  if (children.length === 0) return null;
  const color = raw.accent_color;
  return {
    type: 17,
    ...idOf(raw),
    components: children,
    ...(Number.isInteger(color) && (color as number) >= 0 && (color as number) <= 0xffffff ? { accent_color: color as number } : {}),
    ...(raw.spoiler === true ? { spoiler: true } : {}),
  };
}

function countAll(list: readonly MessageComponent[]): number {
  let n = 0;
  const walk = (items: readonly unknown[]) => {
    for (const raw of items) {
      const c = obj(raw);
      if (!c) continue;
      n += 1;
      if (Array.isArray(c.components)) walk(c.components);
      if (c.accessory) walk([c.accessory]);
    }
  };
  walk(list);
  return n;
}

export interface ReadComponents {
  v2: boolean;
  components: MessageComponent[];
}

/** `metadata.components` (+ `componentsV2`) — web `readStoredComponents`. */
export function readMessageComponents(metadata: unknown): ReadComponents {
  const meta = obj(metadata);
  const v2 = meta?.componentsV2 === true;
  const raw = meta?.components;
  if (!Array.isArray(raw) || raw.length === 0) return { v2, components: [] };
  const ids = new Set<string>();
  const out: MessageComponent[] = [];
  for (const entry of raw) {
    const o = obj(entry);
    if (!o) continue;
    if (!v2) {
      const row = actionRow(o, ids);
      if (row) out.push(row);
      if (out.length >= MAX_ACTION_ROWS) break;
      continue;
    }
    const parsed = Number(o.type) === 17 ? container(o, ids) : containerChild(o, ids);
    if (parsed) out.push(parsed);
    if (countAll(out) > MAX_V2_COMPONENTS) break;
  }
  return { v2, components: out };
}

/** 0xRRGGBB tamsayı → "#rrggbb". */
export function accentHex(color: number | null | undefined): string | null {
  return typeof color === "number" ? `#${color.toString(16).padStart(6, "0")}` : null;
}

/**
 * Mesaj metni yokken önizleme/bildirim için V2 metinlerinin düz özeti —
 * web `componentsPlainText` ile aynı (iç içe Metin bileşenleri, 200 sınırı).
 */
export function componentsPlainText(components: readonly unknown[], max = 200): string {
  const parts: string[] = [];
  const walk = (list: readonly unknown[]) => {
    for (const raw of list) {
      const c = obj(raw);
      if (!c || typeof c.type !== "number") continue;
      if (c.type === ComponentType.TEXT_DISPLAY && typeof c.content === "string") parts.push(c.content);
      if (Array.isArray(c.components)) walk(c.components);
      if (c.accessory) walk([c.accessory]);
    }
  };
  walk(components);
  const joined = parts.join("\n").trim();
  return joined.length > max ? `${joined.slice(0, max - 1)}…` : joined;
}
