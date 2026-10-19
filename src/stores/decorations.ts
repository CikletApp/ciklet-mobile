import { create } from "zustand";

/**
 * Profil başına avatar süsü — web'deki "profil görsel önbelleği"nin mobil
 * karşılığı.
 *
 * Süs kimliği her payload'da yok: sohbet listesi (`/api/directs`) dar profil
 * seti döndürüyor, mesaj yazarları ise taşıyor. `Avatar` her çağrı yerine
 * yeni bir alan geçirmek yerine kimliği buradan okur; listeyi besleyenler
 * (arkadaşlar, üye kartı, kendi profilin, sunucu üyeleri, `profile.updated`)
 * gördükleri değeri yazar. Alanı HİÇ taşımayan nesne kaydı silmez — dar bir
 * payload bilinen süsü düşürmesin.
 */
interface DecorationState {
  byId: Record<string, string | null>;
}

export const useDecorationStore = create<DecorationState>(() => ({ byId: {} }));

type MaybeProfile = { id?: unknown; avatarDecorationId?: unknown } | null | undefined;

/** Payload'lardaki profillerin süslerini kaydeder (değişen yoksa durum aynı kalır). */
export function rememberDecorations(profiles: readonly MaybeProfile[]) {
  const current = useDecorationStore.getState().byId;
  let next: Record<string, string | null> | null = null;
  for (const profile of profiles) {
    if (!profile || typeof profile.id !== "string" || !("avatarDecorationId" in profile)) continue;
    const value = typeof profile.avatarDecorationId === "string" ? profile.avatarDecorationId : null;
    if (current[profile.id] === value) continue;
    next ??= { ...current };
    next[profile.id] = value;
  }
  if (next) useDecorationStore.setState({ byId: next });
}

export function useDecorationOf(profileId: string | undefined): string | null {
  return useDecorationStore((state) => (profileId ? (state.byId[profileId] ?? null) : null));
}
