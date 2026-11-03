/**
 * Aktivite WebView'ı için saf adres denetimleri (içe aktarma yok — birim
 * testi `node --test tests/activity-url-guard.test.mjs` ile çalışır).
 *
 * WebView'ın üst çerçevesinde YALNIZCA bizim host belgemiz durur (baseUrl =
 * Ciklet API kökü); aktivite onun içindeki iframe'de kendi kökeninde
 * (`*.cikletimsi.site` vekil alt alan adı ya da kayıtlı adres) çalışır.
 * Üst çerçeveyi başka bir sayfaya götüren her gezinme (ör. `_blank` /
 * `_top` bağlantısı, YouTube bitiş ekranı) sistem tarayıcısında açılır —
 * Discord da böyle yapıyor. Böylece dış bir sayfa RN köprüsüne (AUTHORIZE
 * vb.) hiçbir zaman ulaşamaz.
 */

/** Ana bilgisayar bir IP adresi ya da yerel/özel ad mı? (URL.hostname, küçük harf) */
export function isBlockedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  // IPv6 değişmezi ("[::1]") — URL.hostname köşeli parantezle verir.
  if (host.includes(":") || host.startsWith("[")) return true;
  // IPv4 değişmezi. WHATWG URL "2130706433", "0x7f.1", "127.1" gibi biçimleri
  // zaten noktalı ondalığa çevirir; yine de son etiketi sayısal olan her adı
  // IP sayıyoruz (alan adının üst düzeyi hiçbir zaman tamamen sayısal değil).
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  const lastLabel = host.slice(host.lastIndexOf(".") + 1);
  if (/^(0x[0-9a-f]*|\d+)$/.test(lastLabel)) return true;
  // Tek etiketli adlar (intranet, "router") ve yerel üst düzeyler.
  if (!host.includes(".")) return true;
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".arpa")
  );
}

/** Adresin kökeni (yalnızca http/https); geçersizse null. */
export function originOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

function normalizedPath(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/**
 * Adres host belgenin kendisi mi? `source={{ html, baseUrl }}` ile yüklenen
 * belgenin adresi platforma göre baseUrl ya da `about:blank` olur.
 */
export function isHostDocumentUrl(raw: string | null | undefined, baseUrl: string): boolean {
  if (!raw || raw === "about:blank") return true;
  try {
    const url = new URL(raw);
    const base = new URL(baseUrl);
    return (
      url.origin.toLowerCase() === base.origin.toLowerCase() &&
      normalizedPath(url.pathname) === normalizedPath(base.pathname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export type NavigationDecision = "allow" | "external" | "block";

/** Alt çerçevelerde (aktivite, onun gömdüğü YouTube oynatıcısı vb.) serbest şemalar. */
const SUBFRAME_SCHEMES = new Set(["https:", "http:", "about:", "blob:", "data:"]);

/**
 * `onShouldStartLoadWithRequest` kararı.
 *  - iOS her çerçeve için çağırır ve `isTopFrame` verir.
 *  - Android `isTopFrame` vermez; http(s) gezinmelerinde yalnızca ana çerçeve
 *    için, alt çerçevelerde yalnızca http dışı şemalar için çağırır.
 * Üst çerçeve: yalnızca host belge kalır; http(s) başka bir adres sistem
 * tarayıcısında açılır, gerisi engellenir.
 */
export function navigationDecision(
  request: { url: string; isTopFrame?: boolean },
  baseUrl: string
): NavigationDecision {
  const raw = request.url ?? "";
  let protocol = "";
  try {
    protocol = new URL(raw).protocol;
  } catch {
    return "block";
  }

  if (request.isTopFrame === false) {
    return SUBFRAME_SCHEMES.has(protocol) ? "allow" : "block";
  }

  if (isHostDocumentUrl(raw, baseUrl) || raw === "about:srcdoc") return "allow";
  if (protocol === "https:" || protocol === "http:") return "external";
  // Android: alt çerçevedeki http dışı şemalar da buraya düşer (isTopFrame yok).
  if (request.isTopFrame === undefined && (protocol === "about:" || protocol === "blob:" || protocol === "data:")) {
    return "allow";
  }
  return "block";
}

/** Sistem tarayıcısında açılabilecek bir adres mi (yalnızca http/https)? */
export function externalOpenableUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
