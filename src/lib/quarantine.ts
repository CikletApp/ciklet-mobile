/**
 * ciklet-web `src/lib/quarantine.ts` ile AYNI — iki tarafta birlikte değişmeli.
 *
 * Karantina — saf kurallar ve metinler (istemci + sunucu; mobil
 * `src/lib/quarantine.ts` ile AYNI). Veritabanı tarafı lib/automod-quarantine.
 */

export interface QuarantineInfo {
  /** "profile": üye profili kuralı (ad düzelince kalkar); "rule": bir kuralın karantina eylemi. */
  source: "profile" | "rule";
  ruleId: string | null;
  ruleName: string | null;
  detail: string | null;
}

export function readQuarantine(raw: unknown): QuarantineInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  return {
    source: q.source === "profile" ? "profile" : "rule",
    ruleId: typeof q.ruleId === "string" ? q.ruleId : null,
    ruleName: typeof q.ruleName === "string" ? q.ruleName : null,
    detail: typeof q.detail === "string" ? q.detail : null,
  };
}

export function isQuarantined(quarantinedAt: Date | string | null | undefined): boolean {
  return Boolean(quarantinedAt);
}

export const QUARANTINE_SEND_DENIED_MESSAGE =
  "Bu sunucuda etkileşimlerin AutoMod tarafından kısıtlandı; mesaj gönderemezsin.";
export const QUARANTINE_PROFILE_DENIED_MESSAGE =
  "Görünen adın, takma adın ya da biyografin bu sunucunun kurallarına takılıyor. Düzeltene ya da bir moderatör kısıtlamayı kaldırana kadar mesaj gönderemez, tepki veremez ve sese katılamazsın.";
export const QUARANTINE_REACT_DENIED_MESSAGE = "Bu sunucuda etkileşimlerin AutoMod tarafından kısıtlandı; tepki veremezsin.";
export const QUARANTINE_VOICE_DENIED_MESSAGE = "Bu sunucuda etkileşimlerin AutoMod tarafından kısıtlandı; sese katılamazsın.";

/** Gönderim reddinin metni (kaynağa göre). */
export function quarantineSendMessage(raw: unknown): string {
  return readQuarantine(raw)?.source === "profile" ? QUARANTINE_PROFILE_DENIED_MESSAGE : QUARANTINE_SEND_DENIED_MESSAGE;
}
