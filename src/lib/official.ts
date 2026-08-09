/** Web ile aynı resmî hesap metinleri. */
export const OFFICIAL_FOOTER_TITLE = "Resmî bildirimler";

export function isOfficialProfile(profile: unknown): boolean {
  return Boolean(
    profile &&
      typeof profile === "object" &&
      "isOfficial" in profile &&
      (profile as { isOfficial?: unknown }).isOfficial === true
  );
}
