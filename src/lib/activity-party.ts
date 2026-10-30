/**
 * Discord uyumlu etkinlik grubu ve düğmeleri — SAF modül.
 * ciklet-web `lib/activity-party.ts` ile AYNI kurallar (web ve mobil aynı
 * görünmeli; bir tarafta değişirse diğerinde de değişir).
 *
 *  - `partySize` [şu an, en çok]: ikisi de tam sayı, 1 ≤ şu an ≤ en çok ≤
 *    1.000.000. Durum satırının sonuna "(2/4)" olarak eklenir (Discord gibi).
 *  - `buttons`: en çok 2; etiket kırpılır, 1–32 kod noktası; adres yalnızca
 *    `https:` ve en çok 512 karakter. Gövde başka istemciden de gelebilir,
 *    bu yüzden çizmeden önce burada yeniden denetlenir.
 *
 * Katılma sırrı (`secrets.join`) ve grup kimliği hiçbir zaman mobile gelmez;
 * "Katıl" düğmesi yalnızca masaüstünde (oyun bilgisayarda çalışıyor).
 */

export const MAX_PARTY_SIZE = 1_000_000;
export const MAX_ACTIVITY_BUTTONS = 2;
export const MAX_BUTTON_LABEL = 32;
export const MAX_BUTTON_URL = 512;

export interface ActivityButton {
  label: string;
  url: string;
}

export interface PartySource {
  partySize?: unknown;
}

export interface ButtonSource {
  buttons?: unknown;
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_PARTY_SIZE;

/** Geçerli grup boyutu [şu an, en çok]; geçersizse null. */
export function partySize(activity: PartySource | null | undefined): [number, number] | null {
  const size = activity?.partySize;
  if (!Array.isArray(size) || size.length !== 2) return null;
  const [current, max] = size;
  if (!isCount(current) || !isCount(max) || current > max) return null;
  return [current, max];
}

/** "(2/4)"; grup boyutu yoksa ya da geçersizse null. */
export function partySizeLabel(activity: PartySource | null | undefined): string | null {
  const size = partySize(activity);
  return size ? `(${size[0]}/${size[1]})` : null;
}

/**
 * Durum satırı + grup: "Rekabetçi (2/4)", durum yoksa yalnızca "(2/4)",
 * grup yoksa durumun kendisi (boşsa null).
 */
export function stateWithParty(activity: (PartySource & { state?: string | null }) | null | undefined): string | null {
  const state = typeof activity?.state === "string" ? activity.state.trim() : "";
  const party = partySizeLabel(activity);
  if (state && party) return `${state} ${party}`;
  return state || party || null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > MAX_BUTTON_URL) return false;
  // Kullanıcı bilgisi, boşluk ya da ters bölü taşıyan adres reddedilir.
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value);
  if (!match) return false;
  return !/[\\@\s]/.test(match[1]) && !/\s/.test(value);
}

/** Çizilebilir düğmeler (en çok 2); geçersiz olanlar düşer. */
export function activityButtons(activity: ButtonSource | null | undefined): ActivityButton[] {
  const raw = activity?.buttons;
  if (!Array.isArray(raw)) return [];
  const out: ActivityButton[] = [];
  for (const item of raw) {
    if (out.length >= MAX_ACTIVITY_BUTTONS) break;
    if (!item || typeof item !== "object") continue;
    const { label, url } = item as Record<string, unknown>;
    if (typeof label !== "string") continue;
    const trimmed = label.trim();
    const length = Array.from(trimmed).length;
    if (length < 1 || length > MAX_BUTTON_LABEL) continue;
    if (!isHttpsUrl(url)) continue;
    out.push({ label: trimmed, url });
  }
  return out;
}
