/**
 * Sunucu listesi (şerit) v2 — iyimser düzen deposu.
 *
 * Web `components/navigation/rail-v2/rail-store.ts` ile aynı kurallar:
 *  • Bırakıldığı karede yeni düzen çizilir (`override`); istek arka planda.
 *  • Aynı anda en çok bir istek; uçuştayken gelen işlemler yalnızca son
 *    düzeni bekletir, istek dönünce tek istekte gönderilir (son düzen kazanır).
 *  • Başarıda yanıt React Query önbelleğine YAZILIR (yeniden çekme
 *    beklenmez); hata olursa (bekleyen yoksa) önbellekteki onaylı düzene
 *    dönülür ve kısa bildirim gösterilir.
 *  • `origin` bu oturumun kimliği: kendi `sidebar.updated` yankımız yok sayılır.
 */
import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import * as Crypto from "expo-crypto";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { qk } from "@/api/query-keys";
import type { ServerFolder } from "@/api/hooks/use-folders";
import type { MembershipWithServer } from "@/api/types";
import { layoutsEqual, normalizeLayout, type RailLayout } from "@/lib/rail-layout";

export const RAIL_ORIGIN = Crypto.randomUUID();

/** İstemci tarafı klasör kimliği (sunucunun generateId alfabesiyle; web ile aynı). */
export function newClientFolderId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (const byte of Crypto.getRandomBytes(21)) id += alphabet[byte % alphabet.length];
  return id;
}

export interface RailFolderMeta {
  id: string;
  name: string | null;
  color: string | null;
}

interface RailStore {
  /** Kaydedilmemiş iyimser düzen; null → önbellekteki düzen geçerli. */
  override: RailLayout | null;
  open: Record<string, true>;
  toggle: (folderId: string) => void;
  closeAll: () => void;
}

export const useRailV2 = create<RailStore>((set) => ({
  override: null,
  open: {},
  toggle: (folderId) =>
    set((state) => {
      const open = { ...state.open };
      if (open[folderId]) delete open[folderId];
      else open[folderId] = true;
      return { open };
    }),
  closeAll: () => set({ open: {} }),
}));

const queue = { inFlight: false, pending: false };
let queryClient: QueryClient | null = null;
let onError: (() => void) | null = null;

export function bindRail(client: QueryClient, errorHandler: () => void): void {
  queryClient = client;
  onError = errorHandler;
}

export function railBusy(): boolean {
  return queue.inFlight || queue.pending;
}

/** Sunucunun düzen yanıtını (ya da uzak olayı) önbelleklere yazar. */
export function writeLayoutToCache(
  client: QueryClient,
  items: RailLayout,
  folders: RailFolderMeta[] | undefined,
): string[] {
  const meta = new Map((folders ?? []).map((f) => [f.id, f]));
  const previous = client.getQueryData<ServerFolder[]>(qk.folders) ?? [];
  const prevById = new Map(previous.map((f) => [f.id, f]));
  const nextFolders: ServerFolder[] = [];
  const position = new Map<string, { order: number; folderId: string | null; orderInFolder: number | null }>();
  items.forEach((item, order) => {
    if (item.type === "server") {
      position.set(item.id, { order, folderId: null, orderInFolder: null });
      return;
    }
    const m = meta.get(item.id) ?? prevById.get(item.id);
    nextFolders.push({
      id: item.id,
      name: m?.name ?? null,
      color: m?.color ?? null,
      order,
      members: item.serverIds.map((serverId, orderInFolder) => ({ serverId, orderInFolder })),
    });
    item.serverIds.forEach((serverId, orderInFolder) => position.set(serverId, { order, folderId: item.id, orderInFolder }));
  });
  client.setQueryData<ServerFolder[]>(qk.folders, nextFolders);
  const memberships = client.getQueryData<MembershipWithServer[]>(qk.memberships) ?? [];
  const known = new Set(memberships.map((m) => m.serverId));
  client.setQueryData<MembershipWithServer[]>(qk.memberships, (current) =>
    (current ?? []).map((m) => {
      const p = position.get(m.serverId);
      return p ? { ...m, ...p } : m;
    }),
  );
  return [...position.keys()].filter((id) => !known.has(id));
}

function send(): void {
  const snapshot = useRailV2.getState().override;
  if (!snapshot) return;
  queue.inFlight = true;
  queue.pending = false;
  void (async () => {
    try {
      const result = await api<{ items: RailLayout; folders: RailFolderMeta[] }>(endpoints.sidebarLayout, {
        method: "PUT",
        body: { items: snapshot, origin: RAIL_ORIGIN },
      });
      if (!queue.pending && queryClient) {
        writeLayoutToCache(queryClient, result.items, result.folders);
        // Önbellek artık aynı düzeni çiziyor; iyimser katman kalkar.
        if (useRailV2.getState().override === snapshot) useRailV2.setState({ override: null });
      }
    } catch (error) {
      console.warn("[RAIL_SAVE]", error);
      if (!queue.pending) {
        useRailV2.setState({ override: null });
        onError?.();
      }
    } finally {
      queue.inFlight = false;
      if (queue.pending) send();
    }
  })();
}

/** İyimser işlem: `base` ekrandaki düzen, `next` yeni düzen. */
export function commitRail(base: RailLayout, next: RailLayout): void {
  const normalized = normalizeLayout(next);
  if (layoutsEqual(normalized, base)) return;
  useRailV2.setState({ override: normalized });
  if (queue.inFlight) {
    queue.pending = true;
    return;
  }
  send();
}
