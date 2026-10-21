import { useEffect } from "react";
import { create } from "zustand";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { parseNameStyle, sameNameStyle, type NameStyle } from "@/lib/name-style";

/**
 * Ad stili önbelleği — web `hooks/use-name-style` karşılığı (avatar süsü
 * deposu `stores/decorations`'ın ikizi; ayrı depo: ad stili değişince her
 * avatar tüketicisi yeniden çizilmesin).
 *
 * Öncelik: canlı (`profile.updated`, kendi kaydı) → çağıranın verdiği →
 * tohum / toplu sorgu. Adı çizen yer stili bilmiyorsa (üye listesi, sohbet
 * yazarı, DM listesi…) kimlik aynı karede toplanıp TEK istekte sorulur
 * (`GET /api/profile/name-styles?ids=`) — N+1 yok.
 *
 * Yalnızca sunum; hiçbir yetki kararı buna dayanmaz.
 */
interface Entry {
  style: NameStyle | null;
  live: boolean;
}

interface NameStyleState {
  entries: Record<string, Entry>;
}

const useNameStyleStore = create<NameStyleState>(() => ({ entries: {} }));

function seed(list: readonly { id: string; style: NameStyle | null }[]) {
  const current = useNameStyleStore.getState().entries;
  let next: Record<string, Entry> | null = null;
  for (const { id, style } of list) {
    const existing = (next ?? current)[id];
    if (existing?.live) continue; // canlı değer tohumla geri alınmaz
    if (existing && sameNameStyle(existing.style, style)) continue;
    next ??= { ...current };
    next[id] = { style, live: false };
  }
  if (next) useNameStyleStore.setState({ entries: next });
}

/** Gerçek bir değişikliği yayar (kendi kaydı, `profile.updated`). Ham değer de olur. */
export function publishNameStyle(profileId: string, style: unknown): void {
  if (!profileId) return;
  const parsed = parseNameStyle(style);
  const current = useNameStyleStore.getState().entries;
  const existing = current[profileId];
  if (existing?.live && sameNameStyle(existing.style, parsed)) return;
  useNameStyleStore.setState({ entries: { ...current, [profileId]: { style: parsed, live: true } } });
}

/**
 * Payload'lardaki profillerin stillerini tohumlar (kart, kendi profilin).
 * Alanı HİÇ taşımayan nesne atlanır — dar bir payload bilinen stili düşürmesin.
 */
export function rememberNameStyles(profiles: readonly ({ id?: unknown; nameStyle?: unknown } | null | undefined)[]): void {
  const list: { id: string; style: NameStyle | null }[] = [];
  for (const profile of profiles) {
    if (!profile || typeof profile.id !== "string" || !("nameStyle" in profile)) continue;
    list.push({ id: profile.id, style: parseNameStyle(profile.nameStyle) });
  }
  if (list.length) seed(list);
}

/** Çıkışta: bir sonraki hesap öncekinin gördüğü stilleri taşımasın. */
export function clearNameStyles(): void {
  useNameStyleStore.setState({ entries: {} });
  requested.clear();
  pending = [];
}

/**
 * Etkin ad stili.
 *  - `fallback === undefined`: çağıran bilmiyor → depo; o da bilmiyorsa toplu sorgu.
 *  - `fallback` verilmiş (null dahil): canlı değer yoksa o kullanılır, sorgu yok.
 *  - `enabled: false`: stil çizilmeyecek; sorgu da yok.
 */
export function useNameStyle(profileId: string | undefined, fallback?: NameStyle | null, enabled = true): NameStyle | null {
  const entry = useNameStyleStore((s) => (profileId ? s.entries[profileId] : undefined));
  const needsLookup = enabled && !!profileId && fallback === undefined && !entry;
  useEffect(() => {
    if (needsLookup && profileId) requestNameStyle(profileId);
  }, [needsLookup, profileId]);
  if (!enabled) return null;
  if (entry?.live) return entry.style;
  if (fallback !== undefined) return fallback;
  return entry?.style ?? null;
}

// ── Toplu sorgu ─────────────────────────────────────────────────────────

/** Web `MAX_DECORATION_LOOKUP` — uç tek istekte en fazla bu kadar kimlik okur. */
const MAX_LOOKUP = 100;
const requested = new Set<string>();
let pending: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function requestNameStyle(profileId: string): void {
  if (!profileId || requested.has(profileId)) return;
  requested.add(profileId);
  pending.push(profileId);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, 30);
}

async function flush(): Promise<void> {
  const ids = pending;
  pending = [];
  for (let i = 0; i < ids.length; i += MAX_LOOKUP) {
    const chunk = ids.slice(i, i + MAX_LOOKUP);
    try {
      const data = await api<Record<string, unknown>>(endpoints.profileNameStyles(chunk));
      seed(chunk.map((id) => ({ id, style: parseNameStyle(data?.[id]) })));
    } catch {
      // Unutulur: bir sonraki çizimde yeniden sorulabilir (yalnızca effect'ten
      // çıkar, döngü olmaz).
      for (const id of chunk) requested.delete(id);
    }
  }
}
