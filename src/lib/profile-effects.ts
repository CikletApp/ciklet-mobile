/**
 * Profil efektleri kataloğu — ciklet-web `src/lib/store-catalog.ts`
 * `PROFILE_EFFECTS` ile BİREBİR (kimlik, ad, katman, hareket, parçacıklar).
 * Web'e yeni efekt eklenince buraya da eklenmeli; sunucu `profileEffectId`
 * olarak bu kimlikleri döner. Çizim: `features/profile/profile-effect.tsx`
 * (web `components/store/profile-effect.tsx` + globals.css `.profile-fx-*`).
 *
 * Saf modül (RN içe aktarmaz) — scripts/verify-uploads.mjs doğrular.
 */

export type ProfileEffectTier = "free" | "mentol" | "store";
/** fall: yukarıdan yağar · rise: aşağıdan yükselir · twinkle: yerinde parlar. */
export type ProfileEffectMotion = "fall" | "rise" | "twinkle";

export interface ProfileEffect {
  id: string;
  name: string;
  tier: ProfileEffectTier;
  motion: ProfileEffectMotion;
  particles: readonly string[];
  /** Parçacık yerine özel çizim. */
  art?: "turkiye";
}

export const PROFILE_EFFECTS: readonly ProfileEffect[] = [
  // Ücretsiz.
  { id: "fx_bubbles", name: "Baloncuk", tier: "free", motion: "rise", particles: ["🫧", "○", "◦"] },
  { id: "fx_leaves", name: "Yapraklar", tier: "free", motion: "fall", particles: ["🍃", "🍂", "🍁"] },
  // Al Bayrak: dalgalanan kırmızı ipek, parlayan ay-yıldız, beyaz yıldızlar.
  { id: "fx_turkiye", name: "Al Bayrak", tier: "free", motion: "twinkle", particles: ["✦"], art: "turkiye" },
  // Mentol (Plus+).
  { id: "fx_mint", name: "Mentol", tier: "mentol", motion: "rise", particles: ["🌿", "💚", "✦"] },
  { id: "fx_sparkle", name: "Işıltı", tier: "mentol", motion: "twinkle", particles: ["✨", "✦", "⋆"] },
  { id: "fx_sakura", name: "Sakura", tier: "mentol", motion: "fall", particles: ["🌸", "🌸", "·"] },
  { id: "fx_fireflies", name: "Ateş Böcekleri", tier: "mentol", motion: "twinkle", particles: ["•", "·", "✧"] },
  // Mağaza.
  { id: "fx_confetti", name: "Konfeti", tier: "store", motion: "fall", particles: ["🎉", "🎊", "✨"] },
  { id: "fx_snow", name: "Kar", tier: "store", motion: "fall", particles: ["❄️", "❄", "·"] },
  { id: "fx_hearts", name: "Kalpler", tier: "store", motion: "rise", particles: ["💖", "💕", "💗"] },
  { id: "fx_stars", name: "Yıldızlar", tier: "store", motion: "twinkle", particles: ["⭐", "🌟", "✦"] },
];

export function findProfileEffect(id: string | null | undefined): ProfileEffect | null {
  if (!id) return null;
  return PROFILE_EFFECTS.find((effect) => effect.id === id) ?? null;
}

/** Yatay yuvalar (% sol) — web `SLOTS`; konumlar her açılışta aynı. */
export const EFFECT_SLOTS = [8, 22, 37, 51, 64, 78, 91] as const;
/** Parlayan efektte dikey konumlar (% üst) — web `TWINKLE_TOPS`. */
export const TWINKLE_TOPS = [18, 62, 34, 76, 22, 55, 40] as const;

export interface EffectParticle {
  glyph: string;
  /** % sol */
  left: number;
  /** Yalnızca twinkle: % üst. */
  top: number | null;
  delayMs: number;
  durationMs: number;
}

/** Web'deki `animationDelay` / `animationDuration` formülünün aynısı. */
export function effectParticles(effect: ProfileEffect): EffectParticle[] {
  return EFFECT_SLOTS.map((left, i) => ({
    glyph: effect.particles[i % effect.particles.length] ?? "✦",
    left,
    top: effect.motion === "twinkle" ? TWINKLE_TOPS[i] : null,
    delayMs: Math.round(((i * 0.61) % 4.2) * 1000),
    durationMs: Math.round((3.6 + (i % 3) * 0.5) * 1000),
  }));
}

/**
 * Bir hareket karesi (t ∈ [0,1]) — web keyframe'lerinin karşılığı.
 * `travel`: afiş yüksekliği; çeviri piksel cinsinden.
 *  - fall : -%20 → +%520 parçacık boyu; burada üstten alta afiş boyu kadar.
 *  - rise : alttan üste; ease-out, 0.8 → 1.1 ölçek.
 *  - twinkle: 0.6 ↔ 1.15 ölçek, 0.15 ↔ 1 opaklık (ease-in-out, ileri-geri).
 * Worklet içinde de çalışabilmesi için yalın aritmetik.
 */
export function effectFrame(
  motion: ProfileEffectMotion,
  t: number,
  travel: number
): { translateY: number; opacity: number; scale: number; rotate: number } {
  "worklet";
  if (motion === "twinkle") {
    // 0 → 1 → 0 (ileri-geri), yumuşak.
    const wave = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
    return { translateY: 0, opacity: 0.15 + wave * 0.85, scale: 0.6 + wave * 0.55, rotate: 0 };
  }
  const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
  if (motion === "fall") {
    return { translateY: -20 + t * (travel + 40), opacity: fade, scale: 1, rotate: t * 200 };
  }
  const eased = 1 - (1 - t) * (1 - t);
  return { translateY: travel + 10 - eased * (travel + 30), opacity: fade, scale: 0.8 + eased * 0.3, rotate: 0 };
}
