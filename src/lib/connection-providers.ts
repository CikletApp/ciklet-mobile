import type { ConnectionType } from "@/api/types";

/**
 * Bağlantı sağlayıcıları — ciklet-web `lib/connections/providers.ts` ile
 * aynı sıra, ad ve renk. `soon`: henüz doğrulanamıyor ("Yakında").
 * `mobile`: mobilden sistem tarayıcısıyla bağlanabilir (web
 * lib/connections/mobile-handoff); Kick şimdilik web/masaüstünden.
 */
export type ProviderFlow = "openid" | "oauth" | "soon";

export interface ConnectionProvider {
  id: ConnectionType;
  label: string;
  flow: ProviderFlow;
  color: string;
  mobile: boolean;
}

export const CONNECTION_PROVIDERS: readonly ConnectionProvider[] = [
  { id: "steam", label: "Steam", flow: "openid", color: "#66c0f4", mobile: true },
  { id: "epic", label: "Epic Games", flow: "oauth", color: "#2a2a2a", mobile: true },
  { id: "battlenet", label: "Battle.net", flow: "oauth", color: "#148eff", mobile: true },
  { id: "riot", label: "Riot Games", flow: "soon", color: "#d32936", mobile: false },
  { id: "playstation", label: "PlayStation", flow: "soon", color: "#003791", mobile: false },
  { id: "xbox", label: "Xbox", flow: "soon", color: "#107c10", mobile: false },
  { id: "twitch", label: "Twitch", flow: "oauth", color: "#9146ff", mobile: true },
  { id: "kick", label: "Kick", flow: "oauth", color: "#53fc18", mobile: false },
  { id: "youtube", label: "YouTube", flow: "oauth", color: "#ff0000", mobile: true },
  { id: "spotify", label: "Spotify", flow: "oauth", color: "#1db954", mobile: true },
  { id: "discord", label: "Discord", flow: "oauth", color: "#5865f2", mobile: true },
  { id: "github", label: "GitHub", flow: "oauth", color: "#181717", mobile: true },
  { id: "x", label: "X", flow: "oauth", color: "#000000", mobile: true },
  { id: "reddit", label: "Reddit", flow: "oauth", color: "#ff4500", mobile: true },
  { id: "instagram", label: "Instagram", flow: "soon", color: "#d62976", mobile: false },
  { id: "facebook", label: "Facebook", flow: "soon", color: "#1877f2", mobile: false },
];

export function providerLabel(id: string): string {
  return CONNECTION_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

export const CONNECTION_RESULTS = ["linked", "denied", "invalid", "failed", "unconfigured", "taken"] as const;
export type ConnectionResult = (typeof CONNECTION_RESULTS)[number];

/**
 * Dönüş adresindeki `?<sağlayıcı>=<sonuç>` çiftleri (web lib/connections/
 * link-result `readConnectionResults`). Tanınmayan her şey yok sayılır.
 */
export function readConnectionResults(url: string): { provider: string; label: string; result: ConnectionResult }[] {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    try {
      params.set(decodeURIComponent(k), decodeURIComponent(v));
    } catch {
      /* bozuk çift */
    }
  }
  const out: { provider: string; label: string; result: ConnectionResult }[] = [];
  for (const p of CONNECTION_PROVIDERS) {
    if (p.flow === "soon") continue;
    const result = params.get(p.id);
    if (result && (CONNECTION_RESULTS as readonly string[]).includes(result)) {
      out.push({ provider: p.id, label: p.label, result: result as ConnectionResult });
    }
  }
  return out;
}

/** `ciklet://me?steam=linked` gibi bağlama dönüşü mü (web /oauth/desktop-return). */
export function isConnectionReturnUrl(url: string): boolean {
  return /^(ciklet:\/\/\/?|\/)me(\?|$)/.test(url) && readConnectionResults(url).length > 0;
}
