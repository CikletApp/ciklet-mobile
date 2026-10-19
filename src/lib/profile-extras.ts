import type { ConnectionType, GamesVisibility } from "@/api/types";

/**
 * Üye kartı ve profil ayarlarının saf verileri — ciklet-web
 * `lib/profile-connections.ts`, `lib/profile-games.ts` ve
 * `lib/store-catalog.ts` dosyalarının istemcide gereken parçaları.
 * Doğrulamanın asıl sahibi sunucu; buradaki desenler yalnızca anlık geri
 * bildirim için.
 */

// ── Bağlantılar ─────────────────────────────────────────────────────

export interface ConnectionMeta {
  id: ConnectionType;
  label: string;
  pattern: RegExp;
  placeholder: string;
}

export const CONNECTION_TYPES: readonly ConnectionMeta[] = [
  { id: "steam", label: "Steam", pattern: /^[A-Za-z0-9_\-.]{2,32}$/, placeholder: "steam kullanıcı adı" },
  { id: "epic", label: "Epic Games", pattern: /^[A-Za-z0-9 _\-.]{3,32}$/, placeholder: "Epic adı" },
  { id: "xbox", label: "Xbox", pattern: /^[A-Za-z0-9 #_\-.]{3,24}$/, placeholder: "oyuncu etiketi" },
  { id: "playstation", label: "PlayStation", pattern: /^[A-Za-z0-9_\-.]{3,16}$/, placeholder: "PSN kimliği" },
  { id: "riot", label: "Riot Games", pattern: /^[^#\s]{3,16}#[A-Za-z0-9]{3,5}$/, placeholder: "Ad#TAG" },
  { id: "twitch", label: "Twitch", pattern: /^[A-Za-z0-9_]{4,25}$/, placeholder: "twitch kullanıcı adı" },
  { id: "youtube", label: "YouTube", pattern: /^@?[A-Za-z0-9_\-.]{3,30}$/, placeholder: "@kanal" },
  { id: "instagram", label: "Instagram", pattern: /^[A-Za-z0-9_.]{1,30}$/, placeholder: "kullanıcı adı" },
  { id: "x", label: "X", pattern: /^@?[A-Za-z0-9_]{1,15}$/, placeholder: "@kullanıcı" },
  { id: "github", label: "GitHub", pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/, placeholder: "kullanıcı adı" },
  { id: "spotify", label: "Spotify", pattern: /^[A-Za-z0-9_\-.]{1,64}$/, placeholder: "kullanıcı kimliği" },
];

export function connectionMeta(type: string): ConnectionMeta | null {
  return CONNECTION_TYPES.find((c) => c.id === type) ?? null;
}

/** Kırpılmış ve desene uyan kullanıcı adı; geçersizse `null`. */
export function normalizeHandle(type: string, raw: string): string | null {
  const meta = connectionMeta(type);
  if (!meta) return null;
  const handle = raw.trim().replace(/\s+/g, " ");
  return meta.pattern.test(handle) ? handle : null;
}

// ── Oyun koleksiyonu ────────────────────────────────────────────────

export const GAMES_VISIBILITY_OPTIONS: { value: GamesVisibility; label: string; desc: string }[] = [
  { value: "EVERYONE", label: "Herkes", desc: "Profilini açan herkes görür" },
  { value: "FRIENDS", label: "Sadece Arkadaşlar", desc: "Yalnızca arkadaşların görür" },
  { value: "NOBODY", label: "Hiç Kimse", desc: "Koleksiyon gizli kalır" },
];

/** "12 sa 30 dk" / "45 dk" / "1 dk'dan az" (web ile aynı). */
export function playtimeLabel(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "1 dk'dan az";
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 100) return `${h} sa`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** Etkinlik sekmesindeki geçmiş zaman fiili. */
export const ACTIVITY_VERB: Record<string, string> = {
  PLAYING: "oynadı",
  LISTENING: "dinledi",
  WATCHING: "izledi",
  STREAMING: "yayın yaptı",
  WORKING: "kullandı",
  CREATING: "kullandı",
  COMPETING: "yarıştı",
};

export function sessionDurationLabel(startedAt: string, lastSeenAt: string): string {
  const mins = Math.max(1, Math.round((new Date(lastSeenAt).getTime() - new Date(startedAt).getTime()) / 60000));
  if (mins < 60) return `${mins} dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

// ── Mağaza kozmetikleri ─────────────────────────────────────────────

/**
 * İsim plakası: web'de üye satırının arkasındaki yatay gradyan. Mobilde
 * aynı renkler soldan sağa sönen bir SVG gradyanla çizilir.
 */
export interface Nameplate {
  id: string;
  /** Başlangıç rengi ve opaklığı; sağa doğru saydamlaşır. */
  color: string;
  opacity: number;
}

export const NAMEPLATES: readonly Nameplate[] = [
  { id: "np_dusk", color: "#ff7a59", opacity: 0.28 },
  { id: "np_matrix", color: "#00e676", opacity: 0.26 },
  { id: "np_galaxy", color: "#7c4dff", opacity: 0.32 },
  { id: "np_gold", color: "#ffd700", opacity: 0.3 },
  { id: "np_ice", color: "#56ccf2", opacity: 0.3 },
];

export function findNameplate(id: string | null | undefined): Nameplate | null {
  if (!id) return null;
  return NAMEPLATES.find((n) => n.id === id) ?? null;
}

/** Profil efekti: afişin üstünde süzülen emoji parçacıkları. */
export const PROFILE_EFFECTS: Readonly<Record<string, string[]>> = {
  // Ücretsiz ve Mentol seti (web lib/store-catalog PROFILE_EFFECTS).
  fx_bubbles: ["🫧", "○", "◦"],
  fx_leaves: ["🍃", "🍂", "🍁"],
  // Al Bayrak: parçacık yerine özel çizim (features/profile/profile-effect).
  fx_turkiye: ["✦"],
  fx_mint: ["🌿", "💚", "✦"],
  fx_sparkle: ["✨", "✦", "⋆"],
  fx_sakura: ["🌸", "🌸", "·"],
  fx_fireflies: ["•", "·", "✧"],
  fx_confetti: ["🎉", "🎊", "✨"],
  fx_snow: ["❄️", "❄", "·"],
  fx_hearts: ["💖", "💕", "💗"],
  fx_stars: ["⭐", "🌟", "✦"],
};

export const STORE_KIND_LABEL = {
  decoration: "Avatar Süsleri",
  nameplate: "İsim Plakaları",
  effect: "Profil Efektleri",
} as const;

/** "39,90 ₺" */
export function formatPriceTry(value: number): string {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);
  } catch {
    return `${value.toFixed(2)} TL`;
  }
}
