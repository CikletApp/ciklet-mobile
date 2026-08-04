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
  html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
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

export function rpcError(cmd: string, nonce: string | null, message: string): RPCMessage {
  return { cmd, nonce, evt: "ERROR", data: { message } };
}

export function rpcDispatch(evt: string, data: unknown): RPCMessage {
  return { cmd: "DISPATCH", nonce: null, evt, data };
}
