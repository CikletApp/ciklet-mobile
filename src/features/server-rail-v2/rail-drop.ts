// Sunucu listesi v2 — bırakma hedefinin hesabı (SAF). Web
// `components/navigation/rail-v2/rail-drop.ts` kopyası; biri değişirse diğeri de.
//
// Discord gibi: sürüklerken diğer simgeler KAYMAZ; imlecin bulunduğu
// boşlukta tek bir yeşil çizgi görünür. Simgenin ortasına gelince çizgi
// yerine "klasör oluştur" vurgusu (hedef simge) çıkar.
//
// Yuvalar (slot) sürükleme başında DOM'dan bir kez ölçülür; her harekette
// yalnızca bu dizi taranır (düzen hesaplaması yok → 60 fps).

import type { RailDropTarget } from "@/lib/rail-layout";

export interface RailSlot {
  kind: "server" | "folder" | "child";
  /** Sunucu kimliği (server/child) ya da klasör kimliği (folder). */
  id: string;
  rootIndex: number;
  /** child: bulunduğu klasör ve klasör içi sırası. */
  folderId?: string;
  childIndex?: number;
  /** folder: açık mı, çocuk sayısı. */
  open?: boolean;
  childCount?: number;
  top: number;
  bottom: number;
}

export interface RailDropView {
  target: Exclude<RailDropTarget, { kind: "combine" }> | { kind: "combine"; serverId: string } | null;
  /** Yeşil çizginin dikey konumu (liste koordinatı) — yoksa vurgu var. */
  lineY: number | null;
  /** Çizgi klasör bandının içinde mi (daha dar çizilir)? */
  lineInFolder: boolean;
  /** Vurgulanan simge: birleşme (sunucu) ya da klasöre ekleme (klasör). */
  highlightId: string | null;
}

const EDGE = 0.3;
const NONE: RailDropView = { target: null, lineY: null, lineInFolder: false, highlightId: null };

/**
 * `dragKey`: sürüklenen sunucunun kimliği ya da `folder:<id>`.
 * `y`: imlecin liste koordinatındaki dikey konumu.
 */
export function computeRailDrop(slots: readonly RailSlot[], dragKey: string, y: number): RailDropView {
  if (slots.length === 0) return NONE;
  const draggingFolder = dragKey.startsWith("folder:");
  const rootCount = slots.reduce((max, s) => Math.max(max, s.rootIndex + 1), 0);

  // İmlecin üstünde olduğu yuva; boşluktaysa en yakını.
  let slot = slots[0];
  let best = Infinity;
  for (const s of slots) {
    if (y >= s.top && y <= s.bottom) {
      slot = s;
      best = 0;
      break;
    }
    const d = y < s.top ? s.top - y : y - s.bottom;
    if (d < best) {
      best = d;
      slot = s;
    }
  }

  const h = Math.max(1, slot.bottom - slot.top);
  const rel = (y - slot.top) / h;
  const rootTop = (index: number): number => {
    const first = slots.find((s) => s.rootIndex === index && s.kind !== "child");
    if (first) return first.top;
    const last = [...slots].reverse().find((s) => s.rootIndex === index - 1);
    return last ? last.bottom : slots[slots.length - 1].bottom;
  };
  const lineAtRoot = (index: number): RailDropView => {
    const clamped = Math.max(0, Math.min(index, rootCount));
    const prev = [...slots].reverse().find((s) => s.rootIndex === clamped - 1);
    const next = slots.find((s) => s.rootIndex === clamped && s.kind !== "child");
    const lineY = prev && next ? (prev.bottom + next.top) / 2 : next ? next.top - 2 : prev ? prev.bottom + 2 : rootTop(clamped);
    return { target: { kind: "root", index: clamped }, lineY, lineInFolder: false, highlightId: null };
  };

  if (draggingFolder) {
    // Klasör yalnızca kökte yer değiştirir; klasör içindeki yuvalar o
    // klasörün kök sırasına göre değerlendirilir.
    const below = rel >= 0.5;
    if (slot.kind === "child" || (slot.kind === "folder" && slot.open)) {
      // Açık klasörün tamamı tek kök öğe: üst yarısı önce, gerisi sonra.
      const all = slots.filter((s) => s.rootIndex === slot.rootIndex);
      const top = all[0].top;
      const bottom = all[all.length - 1].bottom;
      return lineAtRoot(y < (top + bottom) / 2 ? slot.rootIndex : slot.rootIndex + 1);
    }
    return lineAtRoot(below ? slot.rootIndex + 1 : slot.rootIndex);
  }

  const serverId = dragKey;

  if (slot.kind === "server") {
    if (rel < EDGE) return lineAtRoot(slot.rootIndex);
    if (rel > 1 - EDGE) return lineAtRoot(slot.rootIndex + 1);
    if (slot.id === serverId) return NONE;
    return { target: { kind: "combine", serverId: slot.id }, lineY: null, lineInFolder: false, highlightId: slot.id };
  }

  if (slot.kind === "folder") {
    if (rel < EDGE) return lineAtRoot(slot.rootIndex);
    if (!slot.open) {
      if (rel > 1 - EDGE) return lineAtRoot(slot.rootIndex + 1);
      return {
        target: { kind: "folder", folderId: slot.id, index: slot.childCount ?? Number.MAX_SAFE_INTEGER },
        lineY: null,
        lineInFolder: false,
        highlightId: `folder:${slot.id}`,
      };
    }
    // Açık klasörün başlığının altı: klasörün en başına.
    const first = slots.find((s) => s.kind === "child" && s.folderId === slot.id);
    return {
      target: { kind: "folder", folderId: slot.id, index: 0 },
      lineY: first ? (slot.bottom + first.top) / 2 : slot.bottom + 2,
      lineInFolder: true,
      highlightId: null,
    };
  }

  // slot.kind === "child"
  const siblings = slots.filter((s) => s.kind === "child" && s.folderId === slot.folderId);
  const isLast = siblings[siblings.length - 1] === slot;
  // Son çocuğun ALTINDAKİ boşluk (bandın alt dolgusu): klasörün dışına.
  if (isLast && y > slot.bottom + 2) return lineAtRoot(slot.rootIndex + 1);
  const index = (slot.childIndex ?? 0) + (rel >= 0.5 ? 1 : 0);
  const before = siblings[index - 1];
  const after = siblings[index];
  const lineY = before && after ? (before.bottom + after.top) / 2 : after ? after.top - 2 : before ? before.bottom + 2 : slot.top;
  return {
    target: { kind: "folder", folderId: slot.folderId!, index },
    lineY,
    lineInFolder: true,
    highlightId: null,
  };
}
