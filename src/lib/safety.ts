/**
 * ciklet-web `src/lib/safety.ts` ile AYNI — iki tarafta birlikte değişmeli.
 *
 * Güvenlik eylemleri ve uyarıları — saf kurallar (Discord "Security Actions"
 * + "Safety Alerts"; mobil `src/lib/safety.ts` ile AYNI).
 *
 *  - Davetleri duraklat (Server.invitesPausedUntil): süre dolana kadar
 *    davetle ve keşfetten katılım kapalı (sunucu sahibi ve yöneticiler
 *    davet oluşturabilir ama kimse katılamaz).
 *  - DM'leri duraklat (Server.dmsPausedUntil): bu sunucuyu paylaşan,
 *    arkadaş OLMAYAN üyeler birbirine DM açamaz/yazamaz. Moderatörler
 *    (Üyeleri At / Yasakla / Zaman Aşımı) etkilenmez.
 *  - Süre en çok 24 saat (Discord gibi); süre dolunca kendiliğinden açılır.
 *  - Güvenlik uyarıları (Server.safetyAlertsChannelId): olağan dışı katılım
 *    (baskın), DM spam'i, bahsetme baskını → kanal satırı (AUTOMOD_ALERT,
 *    metadata.safetyAlert) ve tek tıkla eylemler.
 */

export const SAFETY_PAUSE_MAX_MS = 24 * 60 * 60 * 1000;
/** Arayüz seçenekleri (saat). */
export const SAFETY_PAUSE_HOURS: readonly number[] = [1, 2, 4, 6, 12, 24];

export function isPaused(until: Date | string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const t = new Date(until).getTime();
  return Number.isFinite(t) && t > now;
}

/** İstekteki süre (saat) → bitiş zamanı; geçersiz/0 → null (duraklatma kaldırılır). */
export function pauseUntilFromHours(hours: unknown, now = Date.now()): Date | null {
  const h = typeof hours === "number" ? hours : Number(hours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return new Date(now + Math.min(SAFETY_PAUSE_MAX_MS, Math.round(h * 3600_000)));
}

export const INVITES_PAUSED_MESSAGE = "Bu sunucu şu anda yeni üye kabul etmiyor (davetler duraklatıldı).";
export const DMS_PAUSED_MESSAGE = "Bu sunucunun moderatörleri, arkadaş olmayan üyeler arasındaki DM'leri geçici olarak duraklattı.";

export type SafetyAlertKind = "join_raid" | "dm_spam" | "mention_raid";
export const SAFETY_ALERT_KINDS: readonly SafetyAlertKind[] = ["join_raid", "dm_spam", "mention_raid"];

export type SafetyAlertAction = "pause_invites" | "pause_dms" | "lockdown" | "resolve" | "false_alarm";
export const SAFETY_ALERT_ACTIONS: readonly SafetyAlertAction[] = ["pause_invites", "pause_dms", "lockdown", "resolve", "false_alarm"];

export function isSafetyAlertAction(value: unknown): value is SafetyAlertAction {
  return typeof value === "string" && (SAFETY_ALERT_ACTIONS as readonly string[]).includes(value);
}

/** Uyarı satırının metadata'sı (`metadata.safetyAlert`). */
export interface SafetyAlertMeta {
  kind: SafetyAlertKind;
  /** Olağan dışı etkinliğin sayısı (katılım, DM alıcısı, bahsetmeli mesaj). */
  count: number;
  /** Pencere (sn). */
  windowSeconds: number;
  /** DM spam'inde şüpheli üye. */
  profileId?: string | null;
  username?: string | null;
  status: "open" | "resolved" | "false_alarm";
  /** Uygulanan eylemler (sıralı, tekrarsız). */
  actions: SafetyAlertAction[];
  resolvedById?: string | null;
  resolvedByName?: string | null;
}

export function readSafetyAlert(metadata: unknown): SafetyAlertMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).safetyAlert;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (!SAFETY_ALERT_KINDS.includes(a.kind as SafetyAlertKind)) return null;
  return {
    kind: a.kind as SafetyAlertKind,
    count: typeof a.count === "number" ? a.count : 0,
    windowSeconds: typeof a.windowSeconds === "number" ? a.windowSeconds : 0,
    profileId: typeof a.profileId === "string" ? a.profileId : null,
    username: typeof a.username === "string" ? a.username : null,
    status: a.status === "resolved" || a.status === "false_alarm" ? a.status : "open",
    actions: Array.isArray(a.actions) ? (a.actions.filter(isSafetyAlertAction) as SafetyAlertAction[]) : [],
    resolvedById: typeof a.resolvedById === "string" ? a.resolvedById : null,
    resolvedByName: typeof a.resolvedByName === "string" ? a.resolvedByName : null,
  };
}

/** Uyarının kanal satırı metni (Türkçe yedek; arayüz kendi dilinde kurar). */
export function safetyAlertText(alert: Pick<SafetyAlertMeta, "kind" | "count" | "windowSeconds" | "username">): string {
  const minutes = Math.max(1, Math.round(alert.windowSeconds / 60));
  switch (alert.kind) {
    case "join_raid":
      return `Olağan dışı katılım: son ${minutes} dakikada ${alert.count} yeni üye. Bu bir baskın olabilir.`;
    case "dm_spam":
      return `Olası DM spam'i: ${alert.username ? `@${alert.username}` : "bir üye"} son ${minutes} dakikada ${alert.count} üyeye DM attı.`;
    case "mention_raid":
      return `Bahsetme baskını: son ${minutes} dakikada ${alert.count} bahsetmeli mesaj. Bahsetmeli mesajlar geçici olarak engelleniyor.`;
  }
}

// ── Eşikler ──────────────────────────────────────────────────────────────

/** Katılım uyarısı: pencere ve eşik (otomatik kilidin altında, erken uyarı). */
export const JOIN_ALERT_WINDOW_MS = 5 * 60_000;
export const JOIN_ALERT_THRESHOLD = 8;
/** DM spam'i: pencere ve farklı alıcı eşiği. */
export const DM_SPAM_WINDOW_SECONDS = 10 * 60;
export const DM_SPAM_RECIPIENTS = 8;
/** Aynı türde uyarı en fazla bu aralıkla (sunucu başına). */
export const SAFETY_ALERT_COOLDOWN_SECONDS = 30 * 60;
