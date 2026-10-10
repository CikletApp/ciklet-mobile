/** Web ile aynı resmî hesap metinleri. */
export const OFFICIAL_FOOTER_TITLE = "Resmî bildirimler";

/** Resmî sohbetin karşılaması — her açılışta aynı (rastgele değil). */
export const OFFICIAL_INTRO =
  "Bu, Ciklet ekibinden gelen resmî bir mesajdır. Ciklet'in senden asla şifre veya hesap anahtarı istemeyeceğini unutma.";

export function isOfficialProfile(profile: unknown): boolean {
  return Boolean(
    profile &&
      typeof profile === "object" &&
      "isOfficial" in profile &&
      (profile as { isOfficial?: unknown }).isOfficial === true
  );
}
