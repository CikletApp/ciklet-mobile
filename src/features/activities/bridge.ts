import { API_BASE_URL } from "@/lib/config";

/**
 * Aktivite köprüsü — gömülü uygulama ⇄ React Native.
 *
 * Neden bir ara HTML belgesi var:
 * SDK (`CikletSDK`) `window.parent.postMessage(...)` çağırır ve gelen
 * mesajlarda `event.source !== window.parent` ise yok sayar. React Native
 * WebView'de tepe belge doğrudan aktivitenin kendisi olsaydı `window.parent
 * === window` olurdu ve el sıkışma hiç kurulmazdı.
 *
 * Bu yüzden WebView'e ÖNCE bizim host belgemiz yüklenir; aktivite onun
 * içindeki iframe'de çalışır. Host belge iki yönlü röle yapar:
 *   iframe → host → `window.ReactNativeWebView.postMessage` → RN
 *   RN → `injectJavaScript` → host → `iframe.contentWindow.postMessage`
 *
 * Host belge `baseUrl` olarak Ciklet API kökünü alır; böylece iframe'in
 * `document.referrer` değeri Ciklet origin'i olur ve SDK postMessage
 * hedefini "*" yerine gerçek origin'e sabitler (auth code sızmaz).
 */

export interface ActivityFrameParams {
  activityUrl: string;
  clientId: string;
  instanceId: string;
  /** Aktivitenin bağlı olduğu sohbet (kanal veya DM). Yoksa boş. */
  channelId: string;
  backgroundColor: string;
}

/** Aktiviteye geçirilen sorgu parametreleri — SDK bunları okur. */
export function buildActivityUrl({
  activityUrl,
  instanceId,
  channelId,
}: ActivityFrameParams): string {
  const url = new URL(activityUrl);
  url.searchParams.set("instance_id", instanceId);
  if (channelId) url.searchParams.set("channel_id", channelId);
  url.searchParams.set("frame_id", instanceId);
  url.searchParams.set("platform", "mobile");
  return url.toString();
}

export const ACTIVITY_BASE_URL = API_BASE_URL;

/**
 * Host belge. Tek işi röle yapmak — hiçbir görsel öğe içermez, aktivite
 * tüm alanı kaplar.
 */
export function buildHostDocument(params: ActivityFrameParams): string {
  const frameSrc = buildActivityUrl(params);

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="referrer" content="strict-origin" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: ${params.backgroundColor}; overflow: hidden; }
  iframe { border: 0; width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<iframe
  id="activity"
  src="${escapeAttribute(frameSrc)}"
  allow="autoplay; clipboard-write; encrypted-media; fullscreen; microphone"
  referrerpolicy="strict-origin"
></iframe>
<script>
(function () {
  var frame = document.getElementById('activity');

  function toNative(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  // iframe → RN
  window.addEventListener('message', function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    toNative({ type: 'rpc', message: event.data });
  });

  // RN → iframe. RN tarafı bu fonksiyonu injectJavaScript ile çağırır.
  window.__cikletDeliver = function (message) {
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(message, '*');
  };

  frame.addEventListener('load', function () {
    toNative({ type: 'frame-loaded' });
  });
  frame.addEventListener('error', function () {
    toNative({ type: 'frame-error' });
  });
})();
</script>
</body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * RN'den host belgeye mesaj gönderen JS parçası.
 * `injectJavaScript` senkron çalıştığı için sonuna `true;` gerekir —
 * aksi halde iOS'ta uyarı basar.
 */
export function deliverScript(message: unknown): string {
  return `window.__cikletDeliver(${JSON.stringify(message)}); true;`;
}

// ── RPC mesaj şekli (ciklet-sdk/src/utils/rpc.ts ile aynı) ──────────

export interface RPCMessage {
  cmd: string;
  nonce: string | null;
  evt: string | null;
  args?: unknown;
  data?: unknown;
}

export function isRPCMessage(value: unknown): value is RPCMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    typeof msg.cmd === "string" && (msg.nonce === null || typeof msg.nonce === "string")
  );
}

export function rpcResponse(cmd: string, nonce: string | null, data: unknown): RPCMessage {
  return { cmd, nonce, evt: null, data };
}

/**
 * Hata yanıtı — SDK `"error" in data` kontrolüyle reddediyor
 * (ciklet-sdk CikletSDK._handleMessage). Eski biçim (`evt: "ERROR",
 * data: { message }`) bu kontrolden geçmiyor ve aktivite hatayı BAŞARI
 * sanıyordu. Kodlar web host ile aynı: 1001 bilinmeyen komut, 4001 yetki,
 * 4002 geçersiz argüman, 4008 ağ, 4029 hız sınırı.
 */
export function rpcError(cmd: string, nonce: string | null, code: number, message: string): RPCMessage {
  return { cmd, nonce, evt: null, data: { error: { code, message } } };
}

// ── FETCH_EXTERNAL güvenlik sınırı ──────────────────────────────────
//
// Aktivite iframe'i CORS yüzünden okuyamadığı sayfaları (YouTube arama
// sonuçları) kullanıcının KENDİ bağlantısından çekmek istiyor; sunucudan
// kazındığında Google tek IP'yi otomatik sorgu sayıp engelliyordu. Yerel
// katman CORS'a tabi değil — ama bu, onaylı her aktiviteye telefonu vekil
// olarak kullandırmak demek olurdu. Bu yüzden:
//   • aktivite başına ana bilgisayar İZİN LİSTESİ (tam eşleşme, yalnız https),
//   • çerez/kimlik yok, yalnız GET, 10 sn zaman aşımı, 4 MB tavan,
//   • aktivite başına hız sınırı (bkz. ActivityScreen).

/** Yanıt gövdesi tavanı (karakter). */
export const FETCH_EXTERNAL_MAX_BODY = 4 * 1024 * 1024;
export const FETCH_EXTERNAL_TIMEOUT_MS = 10_000;
/** Dakikada en çok bu kadar istek. */
export const FETCH_EXTERNAL_RATE_LIMIT = 30;

/**
 * İzin kuralı — web host (ciklet-web c13ff2fc) ile aynı anlam: https origin
 * + "/" ile biten yol öneki; aday adresin origin'i AYNI olmalı ve yolu
 * önekle BAŞLAMALI.
 */
export interface FetchAllowRule {
  origin: string;
  pathPrefix: string;
}

/** Katalogdaki `fetchAllowlist` girdisi ("https://www.youtube.com/results/") → kural. */
export function parseAllowEntry(entry: unknown): FetchAllowRule | null {
  if (typeof entry !== "string") return null;
  try {
    const url = new URL(entry);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const pathPrefix = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return { origin: url.origin.toLowerCase(), pathPrefix };
  } catch {
    return null;
  }
}

/** Yalnızca ana bilgisayar adı verilen eski biçim: tüm yollar serbest. */
function hostRule(host: string): FetchAllowRule {
  return { origin: `https://${host.toLowerCase()}`, pathPrefix: "/" };
}

/** Birinci parti Birlikte İzle'nin ihtiyacı: YouTube arama sayfası ve küçük resimler. */
const WATCH_TOGETHER_RULES: readonly FetchAllowRule[] = [hostRule("www.youtube.com"), hostRule("i.ytimg.com")];

/**
 * Derleme anı eşlemesi: `{"<clientId>": ["host", …]}` (EXPO_PUBLIC_ACTIVITY_FETCH_ALLOWLIST).
 * Client ID ortam başına üretildiği için (admin paneli) koda gömülemiyor;
 * .env / eas.json profilinden gelir.
 */
function configuredAllowlist(): Record<string, string[]> {
  const raw = process.env.EXPO_PUBLIC_ACTIVITY_FETCH_ALLOWLIST;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string[]> = {};
    for (const [clientId, hosts] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(hosts)) out[clientId] = hosts.filter((h): h is string => typeof h === "string").map((h) => h.toLowerCase());
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Aktivitenin dış istek kuralları — üç kaynak, öncelik sırasıyla:
 *  1. Katalog yanıtındaki `fetchAllowlist` (GET /api/activities; sunucuda
 *     ACTIVITY_FETCH_ALLOWLIST ile client ID başına yapılandırılır — web
 *     host'la AYNI alan, iki platform aynı şeye izin verir),
 *  2. Derleme anı eşlemesi (client ID → ana bilgisayarlar; yerel geliştirme),
 *  3. Birinci parti yedek: kayıtlı adresin yolu "watch-together" içeriyorsa.
 * Hiçbiri eşleşmezse aktivite hiçbir adrese erişemez.
 */
export function fetchAllowlistFor(activity: {
  id: string;
  url: string;
  fetchAllowlist?: string[] | null;
}): readonly FetchAllowRule[] {
  if (Array.isArray(activity.fetchAllowlist) && activity.fetchAllowlist.length > 0) {
    return activity.fetchAllowlist.map(parseAllowEntry).filter((rule): rule is FetchAllowRule => rule !== null);
  }
  const configured = configuredAllowlist()[activity.id];
  if (configured?.length) return configured.map(hostRule);
  try {
    const path = new URL(activity.url).pathname.toLowerCase();
    if (path.includes("watch-together")) return WATCH_TOGETHER_RULES;
  } catch {
    /* geçersiz adres: izin yok */
  }
  return [];
}

const IPV4_RE = /^(d{1,3}.){3}d{1,3}$/;

/**
 * İstek adresini doğrular: https, kimlik bilgisi yok, origin bir kuralla
 * birebir aynı ve yol o kuralın önekiyle başlıyor; ana bilgisayar bir IP ya
 * da yerel ad değil. Geçersizse null.
 */
export function validateExternalFetchUrl(raw: unknown, rules: readonly FetchAllowRule[]): URL | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (
    !host ||
    IPV4_RE.test(host) ||
    host.includes(":") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return null;
  }
  const origin = url.origin.toLowerCase();
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const allowed = rules.some((rule) => rule.origin === origin && path.startsWith(rule.pathPrefix));
  return allowed ? url : null;
}

export function rpcDispatch(evt: string, data: unknown): RPCMessage {
  return { cmd: "DISPATCH", nonce: null, evt, data };
}
