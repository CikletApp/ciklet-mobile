import { Platform } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Cihazın ağ durumu (NetInfo) — gönderim kuyruğu ve medya otomatik
 * indirme kararları buna bakar.
 *
 * `online`: bağlı ve internet erişimi "yok" diye kesinleşmemiş. NetInfo
 * erişilebilirliği bilmediğinde (`null`) bağlı sayılır; yanlış "çevrimdışı"
 * kuyruğu gereksiz bekletir, yanlış "çevrimiçi" en kötü bir ağ hatası verir.
 */

export type NetworkKind = "wifi" | "cellular" | "none" | "unknown";

let kind: NetworkKind = "unknown";
let online = true;
const listeners = new Set<(online: boolean, kind: NetworkKind) => void>();

function apply(state: NetInfoState) {
  const nextOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
  const nextKind: NetworkKind = !nextOnline
    ? "none"
    : state.type === "wifi" || state.type === "ethernet"
      ? "wifi"
      : state.type === "cellular"
        ? "cellular"
        : "unknown";
  const changed = nextOnline !== online || nextKind !== kind;
  online = nextOnline;
  kind = nextKind;
  if (changed) for (const listener of listeners) listener(online, kind);
}

let started = false;
function start() {
  if (started || Platform.OS === "web") return;
  started = true;
  try {
    NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply).catch(() => {});
  } catch {
    /* yerel modül yok (eski derleme): hep çevrimiçi sayılır */
  }
}

export function isOnline(): boolean {
  start();
  return online;
}

export function networkKind(): NetworkKind {
  start();
  return kind;
}

/** Ağ durumu değişince çağrılır; dönen fonksiyon aboneliği kaldırır. */
export function onNetworkChange(listener: (online: boolean, kind: NetworkKind) => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
