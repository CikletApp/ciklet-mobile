import { create } from "zustand";

import {
  isAutoSelect,
  readSelect,
  readTextDisplay,
  type AnySelectComponent,
  type TextDisplayComponent,
} from "@/lib/message-components";

/**
 * Bot etkileşim modalının durumu ve tanım okuyucusu (web `lib/modals`,
 * `hooks/use-interaction-modal`). Çizim `interaction-modal.tsx`te.
 *
 * Kökte 1–5 bileşen: Etiket (18) içinde bir alan, Metin (10) ya da eski
 * biçim eylem satırı (1) + metin girişi (4). Alanlar: metin girişi (4),
 * seçim menüleri (3, 5–8), dosya yükleme (19), radyo grubu (21), onay
 * kutusu grubu (22), onay kutusu (23). Sunucu tanımı doğrulamıştır; burada
 * yalnızca güvenli okuma ve form doğrulaması (web `modalFieldError` ile
 * aynı metinler).
 */

const MAX_ROWS = 5;
export const VALUE_MAX = 4000;

export interface TextInputDef {
  type: 4;
  custom_id: string;
  label: string;
  style: 1 | 2;
  placeholder?: string;
  value?: string;
  required: boolean;
  min_length?: number;
  max_length?: number;
}

export interface FileUploadDef {
  type: 19;
  custom_id: string;
  min_values?: number;
  max_values?: number;
  required: boolean;
  file_types?: string[];
}

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  default?: boolean;
}

export interface RadioGroupDef {
  type: 21;
  custom_id: string;
  options: ChoiceOption[];
  required: boolean;
}

export interface CheckboxGroupDef {
  type: 22;
  custom_id: string;
  options: ChoiceOption[];
  min_values?: number;
  max_values?: number;
  required: boolean;
}

export interface CheckboxDef {
  type: 23;
  custom_id: string;
  default?: boolean;
}

export type ModalFieldDef = TextInputDef | AnySelectComponent | FileUploadDef | RadioGroupDef | CheckboxGroupDef | CheckboxDef;

/** Form satırı: alanlı (etiket ya da eski satır) ya da yalnızca metin. */
export type ModalItem =
  | { kind: "field"; label: string; description?: string; field: ModalFieldDef }
  | { kind: "text"; text: TextDisplayComponent };

export interface ModalDef {
  custom_id: string;
  title: string;
  items: ModalItem[];
}

export interface OpenModal {
  interactionId: string;
  channelId: string;
  modal: ModalDef;
}

/** Formdaki bir alanın değeri (web `ModalSubmitValue`). */
export interface FieldValue {
  value?: string | boolean | null;
  values?: string[];
}

/** Yüklenmiş dosya (dosya alanı); `id` gönderimde "0", "1", … olarak verilir. */
export interface UploadedFile {
  key: string;
  url: string;
  filename: string;
  size: number;
  content_type?: string;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function int(value: unknown, min: number, max: number): number | undefined {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined;
}

function textInput(c: Record<string, unknown>, label: string | undefined): TextInputDef | null {
  const id = str(c.custom_id, 100);
  if (Number(c.type) !== 4 || !id) return null;
  return {
    type: 4,
    custom_id: id,
    label: label ?? str(c.label, 45) ?? "",
    style: Number(c.style) === 2 ? 2 : 1,
    placeholder: str(c.placeholder, 100),
    value: typeof c.value === "string" ? c.value : undefined,
    required: c.required !== false,
    min_length: int(c.min_length, 0, VALUE_MAX),
    max_length: int(c.max_length, 1, VALUE_MAX),
  };
}

function choices(raw: unknown): ChoiceOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).flatMap((entry): ChoiceOption[] => {
    const o = obj(entry);
    const value = o ? str(o.value, 100) : undefined;
    const label = o ? str(o.label, 100) : undefined;
    if (!o || !value || !label) return [];
    return [{ value, label, description: str(o.description, 100), default: o.default === true }];
  });
}

function field(raw: unknown, label: string): ModalFieldDef | null {
  const c = obj(raw);
  if (!c) return null;
  const type = Number(c.type);
  const id = str(c.custom_id, 100);
  if (type === 4) return textInput(c, label);
  if (type === 3 || type === 5 || type === 6 || type === 7 || type === 8) return readSelect(c);
  if (!id) return null;
  if (type === 19) {
    const types = Array.isArray(c.file_types) ? c.file_types.filter((t): t is string => typeof t === "string") : [];
    return {
      type: 19,
      custom_id: id,
      required: c.required !== false,
      min_values: int(c.min_values, 0, 10),
      max_values: int(c.max_values, 1, 10),
      ...(types.length > 0 ? { file_types: types } : {}),
    };
  }
  if (type === 21) {
    const options = choices(c.options);
    return options.length >= 2 ? { type: 21, custom_id: id, options, required: c.required !== false } : null;
  }
  if (type === 22) {
    const options = choices(c.options);
    if (options.length === 0) return null;
    return {
      type: 22,
      custom_id: id,
      options,
      required: c.required !== false,
      min_values: int(c.min_values, 0, 10),
      max_values: int(c.max_values, 1, 10),
    };
  }
  if (type === 23) return { type: 23, custom_id: id, default: c.default === true };
  return null;
}

/** Sunucunun doğruladığı tanımı okur; beklenmeyen biçim null (açılmaz). */
function parseModal(raw: unknown): ModalDef | null {
  const r = obj(raw);
  if (!r) return null;
  const customId = str(r.custom_id, 100);
  const title = str(r.title, 45);
  if (!customId || !title || !Array.isArray(r.components)) return null;
  const items: ModalItem[] = [];
  for (const rawItem of r.components.slice(0, MAX_ROWS)) {
    const c = obj(rawItem);
    if (!c) return null;
    const type = Number(c.type);
    if (type === 18) {
      const label = str(c.label, 45);
      const f = label ? field(c.component, label) : null;
      if (!label || !f) return null;
      items.push({ kind: "field", label, description: str(c.description, 100), field: f });
    } else if (type === 10) {
      const text = readTextDisplay(c);
      if (text) items.push({ kind: "text", text });
    } else {
      // Eski biçim: eylem satırında tek metin girişi (ya da satırsız type 4).
      const inner = type === 1 && Array.isArray(c.components) ? obj(c.components[0]) : c;
      const input = inner ? textInput(inner, undefined) : null;
      if (!input || !input.label) return null;
      items.push({ kind: "field", label: input.label, field: input });
    }
  }
  return items.some((i) => i.kind === "field") ? { custom_id: customId, title, items } : null;
}

/** Alanın başlangıç değeri (ön dolu metin, varsayılan seçimler). */
export function initialValue(f: ModalFieldDef): FieldValue {
  switch (f.type) {
    case 4:
      return { value: f.value ?? "" };
    case 3:
      return { values: f.options.filter((o) => o.default).map((o) => o.value) };
    case 5:
    case 6:
    case 7:
    case 8:
      return { values: (f.default_values ?? []).map((d) => d.id) };
    case 19:
      return { values: [] };
    case 21:
      return { value: f.options.find((o) => o.default)?.value ?? null };
    case 22:
      return { values: f.options.filter((o) => o.default).map((o) => o.value) };
    case 23:
      return { value: f.default === true };
  }
}

/** Web `fileTypeAllowed`: yalnızca uzantıya bakılır. */
export function fileTypeAllowed(fileTypes: readonly string[] | undefined, filename: string): boolean {
  if (!fileTypes || fileTypes.length === 0) return true;
  const ext = filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase()}` : "";
  const families: Record<string, RegExp> = {
    image: /^\.(png|jpe?g|gif|webp|avif|bmp|heic|heif|svg)$/,
    video: /^\.(mp4|webm|mov|m4v|mkv|avi)$/,
    audio: /^\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba)$/,
  };
  return fileTypes.some((t) => (t.startsWith(".") ? t === ext : Boolean(families[t]?.test(ext))));
}

function range(min: number, max: number, count: number, label: string, noun: "seçenek" | "dosya"): string | null {
  if (count >= min && count <= max) return null;
  return min === max ? `"${label}": ${min} ${noun} seçilmeli.` : `"${label}": ${min}–${max} arası ${noun} seçilmeli.`;
}

/** Web `modalFieldError` ile aynı metinler; geçerliyse null. */
export function fieldError(f: ModalFieldDef, label: string, value: FieldValue, files: UploadedFile[] = []): string | null {
  const values = value.values ?? [];
  switch (f.type) {
    case 4: {
      const v = typeof value.value === "string" ? value.value.trim() : "";
      if (f.required && !v) return `"${label}" zorunlu.`;
      if (!v) return null;
      if (f.min_length !== undefined && v.length < f.min_length) return `"${label}" en az ${f.min_length} karakter olmalı.`;
      const max = f.max_length ?? VALUE_MAX;
      if (v.length > max) return `"${label}" en fazla ${max} karakter olabilir.`;
      return null;
    }
    case 3:
    case 5:
    case 6:
    case 7:
    case 8: {
      if (f.required === false && values.length === 0) return null;
      if (!isAutoSelect(f) && values.some((v) => !f.options.some((o) => o.value === v))) return `"${label}": Geçersiz seçim.`;
      const min = f.min_values ?? 1;
      const max = f.max_values ?? 1;
      if (values.length < min || values.length > max) {
        return `"${label}": ${min === max ? `${min} seçenek seçilmeli.` : `${min}–${max} arası seçenek seçilmeli.`}`;
      }
      return null;
    }
    case 19: {
      if (!f.required && values.length === 0) return null;
      const error = range(f.min_values ?? 1, f.max_values ?? 1, values.length, label, "dosya");
      if (error) return error;
      for (const file of files) if (!fileTypeAllowed(f.file_types, file.filename)) return `"${label}": bu dosya türü kabul edilmiyor.`;
      return null;
    }
    case 21:
      return typeof value.value === "string" || !f.required ? null : `"${label}" zorunlu.`;
    case 22: {
      if (!f.required && values.length === 0) return null;
      return range(f.min_values ?? 1, f.max_values ?? f.options.length, values.length, label, "seçenek");
    }
    case 23:
      return null;
  }
}

export const useInteractionModal = create<{ current: OpenModal | null; seen: ReadonlySet<string> }>(() => ({
  current: null,
  seen: new Set(),
}));

/** Modalı açar (aynı etkileşim ikinci kez açılmaz). */
export function openInteractionModal(input: { interactionId: unknown; channelId: unknown; modal: unknown }) {
  const { interactionId, channelId } = input;
  if (typeof interactionId !== "string" || typeof channelId !== "string") return;
  const modal = parseModal(input.modal);
  const { seen } = useInteractionModal.getState();
  if (!modal || seen.has(interactionId)) return;
  useInteractionModal.setState({ current: { interactionId, channelId, modal }, seen: new Set(seen).add(interactionId) });
}

/** Çıkışta: bir sonraki hesap öncekinin formunu görmesin. */
export function resetInteractionModal() {
  useInteractionModal.setState({ current: null, seen: new Set() });
}
