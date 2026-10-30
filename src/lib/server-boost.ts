/**
 * Server Boost (Sunucu Takviyesi) — ciklet-web `src/lib/server-boost.ts`
 * kopyası (ortak paket yok). Seviye eşikleri, ayrıcalık tablosu ve metinler
 * web ile BİREBİR aynı olmalı: biri değişirse diğeri de değişir.
 *
 * Yalnızca arayüzün ihtiyaç duyduğu saf kısım: fiyat, ek süre geçişi ve
 * slot durumu gibi sunucu kuralları burada yok (uçlar zaten denetliyor).
 *
 * Discord kuralları: 2 takviye → Seviye 1, 7 → Seviye 2, 14 → Seviye 3;
 * uygulanan takviye 7 gün dolmadan taşınamaz; seviye düşerken 3 gün
 * korunur; seviye kaybında mevcut içerik silinmez, yalnızca yenisi eklenemez.
 */

/** Yayın kalitesi tavanı (web lib/stream-quality `StreamQuality`). */
export type BoostStreamQuality = "720p30" | "720p60" | "1080p30" | "1080p60" | "source";

export type PremiumTier = 0 | 1 | 2 | 3;

export const PREMIUM_TIERS: readonly PremiumTier[] = [0, 1, 2, 3] as const;

/** Seviye için gereken etkin takviye sayısı (Discord: 2 / 7 / 14). */
export const BOOST_TIER_THRESHOLDS: Record<PremiumTier, number> = { 0: 0, 1: 2, 2: 7, 3: 14 };

/** Takviyenin pembe vurgu rengi (web `text-[#ff73fa]`). */
export const BOOST_PINK = "#ff73fa";

/** Yönetilen rolün rengi (Discord "Server Booster", pembe). */
export const BOOSTER_ROLE_COLOR = "#f47fff";

/**
 * Mağaza ürünü (web lib/iap/products `BOOST_IAP_PRODUCTS`): Mentol'den ayrı
 * abonelik grubu. Bir mağaza aboneliği = bir takviye slotu.
 */
export const BOOST_IAP_PRODUCT_ID = "server_boost_monthly";

export interface ServerPerks {
  emojiSlots: number;
  stickerSlots: number;
  soundboardSlots: number;
  /** Ses kanalı bit hızı tavanı (bps). */
  maxBitrate: number;
  /** Bu sunucuya mesaj eki yükleme sınırı (MB). */
  uploadMb: number;
  /** Sunucudaki ses kanallarında yayın kalitesi tavanı. */
  streamQuality: BoostStreamQuality;
  animatedIcon: boolean;
  inviteSplash: boolean;
  banner: boolean;
  animatedBanner: boolean;
  vanityUrl: boolean;
  roleIcons: boolean;
}

/** Seviye başına ayrıcalıklar — web ile aynı tablo. */
export const SERVER_PERKS: Record<PremiumTier, ServerPerks> = {
  0: {
    emojiSlots: 50,
    stickerSlots: 5,
    soundboardSlots: 8,
    maxBitrate: 96_000,
    uploadMb: 8,
    streamQuality: "720p30",
    animatedIcon: false,
    inviteSplash: false,
    banner: false,
    animatedBanner: false,
    vanityUrl: false,
    roleIcons: false,
  },
  1: {
    emojiSlots: 100,
    stickerSlots: 15,
    soundboardSlots: 24,
    maxBitrate: 128_000,
    uploadMb: 8,
    streamQuality: "720p60",
    animatedIcon: true,
    inviteSplash: true,
    banner: false,
    animatedBanner: false,
    vanityUrl: false,
    roleIcons: false,
  },
  2: {
    emojiSlots: 150,
    stickerSlots: 30,
    soundboardSlots: 36,
    maxBitrate: 256_000,
    uploadMb: 64,
    streamQuality: "1080p60",
    animatedIcon: true,
    inviteSplash: true,
    banner: true,
    animatedBanner: false,
    vanityUrl: false,
    roleIcons: true,
  },
  3: {
    emojiSlots: 250,
    stickerSlots: 60,
    soundboardSlots: 48,
    maxBitrate: 384_000,
    uploadMb: 128,
    streamQuality: "1080p60",
    animatedIcon: true,
    inviteSplash: true,
    banner: true,
    animatedBanner: true,
    vanityUrl: true,
    roleIcons: true,
  },
};

export function normalizePremiumTier(value: unknown): PremiumTier {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

/**
 * Seviyenin Discord tablosundaki ayrıcalıkları — YALNIZCA tanıtım (takviye
 * ekranındaki seviye tablosu). Kilitler ve sayaçlar bunu KULLANMAZ: etkin
 * sınır sunucudan gelir (`effectiveServerPerks`), çünkü root'taki "Takviye
 * sınırlarını uygula" kapalıyken sınırlar eski davranışın altına inmez.
 */
export function serverPerks(tier: unknown): ServerPerks {
  return SERVER_PERKS[normalizePremiumTier(tier)];
}

/**
 * Server Boost öncesi davranış (web lib/server-boost LEGACY_PERK_FLOOR ile
 * aynı). Yalnızca sunucu yanıtı gelene kadarki yedek; asıl karar sunucuda.
 */
export const LEGACY_PERK_FLOOR: ServerPerks = {
  emojiSlots: 50,
  stickerSlots: 15,
  soundboardSlots: 24,
  maxBitrate: 96_000,
  uploadMb: 8,
  streamQuality: "720p30",
  animatedIcon: true,
  inviteSplash: true,
  banner: true,
  animatedBanner: true,
  vanityUrl: true,
  roleIcons: true,
};

/**
 * ETKİN ayrıcalıklar — sunucunun döndürdüğü `premiumPerks` (GET
 * /api/servers/{id}) ya da `perks` (GET /api/servers/{id}/boosts). İstemci
 * seviyeden sınır TÜRETMEZ; yanıt yokken eski taban.
 */
export function effectiveServerPerks(server: { premiumPerks?: ServerPerks | null } | null | undefined): ServerPerks {
  return server?.premiumPerks ?? LEGACY_PERK_FLOOR;
}

/** Etkin takviye sayısının karşılık geldiği seviye. */
export function tierForBoostCount(count: number): PremiumTier {
  if (count >= BOOST_TIER_THRESHOLDS[3]) return 3;
  if (count >= BOOST_TIER_THRESHOLDS[2]) return 2;
  if (count >= BOOST_TIER_THRESHOLDS[1]) return 1;
  return 0;
}

export type BoolPerk = Exclude<keyof ServerPerks, "emojiSlots" | "stickerSlots" | "soundboardSlots" | "maxBitrate" | "uploadMb" | "streamQuality">;

/** Ayrıcalığı sağlayan en düşük seviye ("Seviye 2 gerekir" metni için). */
export function requiredTier(perk: BoolPerk): PremiumTier {
  return PREMIUM_TIERS.find((tier) => SERVER_PERKS[tier][perk]) ?? 3;
}

/** Ayrıcalık kapısının ret metni — web ve mobil aynı. */
export function perkLockedMessage(perk: BoolPerk): string {
  return `Bu özellik için sunucunun Takviye Seviye ${requiredTier(perk)} olması gerekir.`;
}

/** Sınır doluyken ret metni. */
export function slotsFullMessage(kind: "emoji" | "çıkartma" | "ses", max: number): string {
  return `En fazla ${max} ${kind} eklenebilir. Daha fazlası için sunucuyu takviye et.`;
}

/** İlerleme çubuğu: sonraki seviyeye kalan takviye; seviye 3'te null. */
export function boostProgress(count: number): { tier: PremiumTier; next: PremiumTier | null; needed: number; ratio: number } {
  const tier = tierForBoostCount(count);
  if (tier === 3) return { tier, next: null, needed: 0, ratio: 1 };
  const next = (tier + 1) as PremiumTier;
  const from = BOOST_TIER_THRESHOLDS[tier];
  const to = BOOST_TIER_THRESHOLDS[next];
  return { tier, next, needed: to - count, ratio: Math.max(0, Math.min(1, (count - from) / (to - from))) };
}

// ── Takviyeci rozeti ────────────────────────────────────────────────────

/** Rozetin değiştiği aylar (Discord ile aynı basamaklar). */
export const BOOSTER_TENURE_MONTHS = [1, 2, 3, 6, 9, 12, 15, 18, 24] as const;

/** İki tarih arasındaki tam ay sayısı (takvim ayı; gün henüz dolmadıysa bir eksik). */
export function fullMonthsBetween(since: Date, now: Date): number {
  let months = (now.getUTCFullYear() - since.getUTCFullYear()) * 12 + (now.getUTCMonth() - since.getUTCMonth());
  if (now.getUTCDate() < since.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** Takviyeci rozetinin basamağı: 1 ay dolmadan 0, sonra ulaşılan en büyük basamak. */
export function boosterTenureMonths(since: Date | null, now: Date): number | null {
  if (!since) return null;
  const months = fullMonthsBetween(since, now);
  let reached = 0;
  for (const step of BOOSTER_TENURE_MONTHS) if (months >= step) reached = step;
  return reached;
}

/** "Sunucu Takviyecisi · 3 ay" — rozet açıklaması. */
export function boosterTenureLabel(months: number): string {
  if (months <= 0) return "Sunucu Takviyecisi";
  return months >= 12 && months % 12 === 0
    ? `Sunucu Takviyecisi · ${months / 12} yıl`
    : `Sunucu Takviyecisi · ${months} ay`;
}

// ── Hareketli görsel kapısı ─────────────────────────────────────────────

/** Yüklemenin MIME türü hareketli görsel mi (hareketli ikon/afiş kapısı). */
export function isAnimatedImageType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  const type = contentType.toLowerCase().split(";")[0].trim();
  return type === "image/gif" || type === "image/apng";
}

// ── Arayüz tablosu ──────────────────────────────────────────────────────

/** Ayrıcalık tablosu satırları — web ve mobil aynı metinler. */
export function perkRows(tier: PremiumTier): string[] {
  const p = SERVER_PERKS[tier];
  const rows = [
    `${p.emojiSlots} emoji yuvası`,
    `${p.stickerSlots} çıkartma yuvası`,
    `${p.soundboardSlots} ses tablosu yuvası`,
    `${p.maxBitrate / 1000} kbps ses kalitesi`,
  ];
  if (p.uploadMb > SERVER_PERKS[0].uploadMb) rows.push(`Tüm üyelere ${p.uploadMb} MB yükleme sınırı`);
  if (p.streamQuality !== SERVER_PERKS[0].streamQuality) rows.push(p.streamQuality === "720p60" ? "720p 60 fps yayın" : "1080p 60 fps yayın");
  if (p.animatedIcon) rows.push("Hareketli sunucu simgesi");
  if (p.inviteSplash) rows.push("Davet arka planı");
  if (p.banner) rows.push("Sunucu afişi");
  if (p.roleIcons) rows.push("Rol simgeleri");
  if (p.animatedBanner) rows.push("Hareketli sunucu afişi");
  if (p.vanityUrl) rows.push("Özel davet adresi");
  return rows;
}

/** Uçların "seviye gerekir" ret kodu (403). */
export const PREMIUM_TIER_REQUIRED_CODE = "premium_tier_required";
/** Yönetilen "Server Booster" rolü elle verilemez/silinemez (403/409). */
export const MANAGED_ROLE_CODE = "managed_role";
