import { create } from "zustand";

/**
 * Bot etkileşim modalının durumu ve tanım okuyucusu (web `lib/modals`,
 * `hooks/use-interaction-modal`). Çizim `interaction-modal.tsx`te.
 */

const MAX_ROWS = 5;
export const VALUE_MAX = 4000;

export interface TextInputDef {
  custom_id: string;
  label: string;
  style: 1 | 2;
  placeholder?: string;
  value?: string;
  required: boolean;
  min_length?: number;
  max_length?: number;
}

export interface ModalDef {
  custom_id: string;
  title: string;
  inputs: TextInputDef[];
}

export interface OpenModal {
  interactionId: string;
  channelId: string;
  modal: ModalDef;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function int(value: unknown, min: number, max: number): number | undefined {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined;
}

/** Sunucunun doğruladığı tanımı okur; beklenmeyen biçim null (açılmaz). */
function parseModal(raw: unknown): ModalDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const customId = str(r.custom_id, 100);
  const title = str(r.title, 45);
  if (!customId || !title || !Array.isArray(r.components)) return null;
  const inputs: TextInputDef[] = [];
  for (const rawRow of r.components.slice(0, MAX_ROWS)) {
    const row = rawRow && typeof rawRow === "object" ? (rawRow as Record<string, unknown>) : null;
    const item = row && Array.isArray(row.components) ? row.components[0] : rawRow;
    if (!item || typeof item !== "object") return null;
    const c = item as Record<string, unknown>;
    const id = str(c.custom_id, 100);
    const label = str(c.label, 45);
    if (Number(c.type) !== 4 || !id || !label) return null;
    inputs.push({
      custom_id: id,
      label,
      style: Number(c.style) === 2 ? 2 : 1,
      placeholder: str(c.placeholder, 100),
      value: typeof c.value === "string" ? c.value : undefined,
      required: c.required !== false,
      min_length: int(c.min_length, 0, VALUE_MAX),
      max_length: int(c.max_length, 1, VALUE_MAX),
    });
  }
  return inputs.length > 0 ? { custom_id: customId, title, inputs } : null;
}

/** Web `textInputError`: geçerliyse null. */
export function inputError(input: TextInputDef, value: string): string | null {
  const v = value.trim();
  if (input.required && !v) return `"${input.label}" zorunlu.`;
  if (!v) return null;
  if (input.min_length !== undefined && v.length < input.min_length) {
    return `"${input.label}" en az ${input.min_length} karakter olmalı.`;
  }
  const max = input.max_length ?? VALUE_MAX;
  if (v.length > max) return `"${input.label}" en fazla ${max} karakter olabilir.`;
  return null;
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

