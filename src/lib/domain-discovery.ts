import * as SecureStore from "expo-secure-store";

import {
  ACTIVE_DOMAIN_CONFIG,
  API_BASE_URL,
  BUILD_API_BASE_URL,
  BUILD_GATEWAY_URL,
  DOMAIN_CONFIG_STORAGE_KEY,
  DOMAIN_DISCOVERY_ENABLED,
} from "@/lib/config";
import {
  DISCOVERY_MAX_BYTES,
  DISCOVERY_PATH,
  builtinDiscoveryKeys,
  parseDiscoveryResponse,
  type DiscoveredConfig,
} from "@/lib/domain-discovery-verify";

/**
 * Alan adı keşfi — açılışta bir kez, arka planda.
 *
 * 1. Yalnızca bilinen kökten (bu açılışta etkin olan: derlemedeki ya da
 *    daha önce doğrulanmış) HTTPS ile `/.well-known/ciklet.json` çekilir;
 *    5 sn zaman aşımı, en çok 16 KB.
 * 2. Yanıt yalnızca derlemedeki anahtarla imzalıysa ve kurallara uyuyorsa
 *    (lib/domain-discovery-verify) güvenli depoya yazılır; değişiklik BİR
 *    SONRAKİ açılışta etkin olur (lib/config okur). Aksi her durumda
 *    mevcut kökte kalınır.
 * 3. Keşfedilen kök hiç yanıt vermiyorsa (ağ hatası) ve derlemedeki kök
 *    yanıt veriyorsa: derlemedeki kökün imzalı belgesi kabul edilir; o da
 *    yoksa kayıt silinir — sonraki açılış derlemedeki varsayılana döner.
 *    İkisi de yanıt vermiyorsa cihaz çevrimdışıdır, hiçbir şey değişmez.
 */

const FETCH_TIMEOUT_MS = 5_000;

type FetchOutcome =
  | { kind: "unreachable" }
  | { kind: "invalid" }
  | { kind: "valid"; config: DiscoveredConfig };

async function fetchDiscovery(origin: string): Promise<FetchOutcome> {
  if (!origin.startsWith("https://")) return { kind: "invalid" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${origin}${DISCOVERY_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return { kind: "unreachable" };
  }
  try {
    if (!res.ok) return { kind: "invalid" };
    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > DISCOVERY_MAX_BYTES) return { kind: "invalid" };
    const text = await res.text();
    const config = parseDiscoveryResponse(text, {
      keys: builtinDiscoveryKeys(),
      nowSec: Math.floor(Date.now() / 1000),
    });
    return config ? { kind: "valid", config } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  } finally {
    clearTimeout(timer);
  }
}

function sameConfig(a: DiscoveredConfig | null, b: DiscoveredConfig | null): boolean {
  if (!a || !b) return a === b;
  return a.site === b.site && a.gateway === b.gateway && a.cdn === b.cdn && a.activityProxyDomain === b.activityProxyDomain;
}

async function store(config: DiscoveredConfig): Promise<void> {
  // Derlemedeki kökü ve türetilen ağ geçidini söyleyen belge için kayıt
  // tutulmaz: varsayılan zaten o.
  if (config.site === BUILD_API_BASE_URL && (config.gateway === null || config.gateway === BUILD_GATEWAY_URL)) {
    await SecureStore.deleteItemAsync(DOMAIN_CONFIG_STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(DOMAIN_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

let started = false;

/** Açılışta bir kez çağrılır; hatayı yutar (keşif hiçbir zaman akışı bozmaz). */
export async function refreshDomainDiscovery(): Promise<void> {
  if (started || !DOMAIN_DISCOVERY_ENABLED || !BUILD_API_BASE_URL.startsWith("https://")) return;
  started = true;
  try {
    const current = await fetchDiscovery(API_BASE_URL);
    if (current.kind === "valid") {
      if (!sameConfig(current.config, ACTIVE_DOMAIN_CONFIG)) await store(current.config);
      return;
    }
    // Derlemedeki kökteyiz ve geçerli belge yok: yapılacak bir şey yok.
    if (!ACTIVE_DOMAIN_CONFIG || API_BASE_URL === BUILD_API_BASE_URL) return;
    // Keşfedilen kök cevap verdi ama belge geçersiz: o kökte kal.
    if (current.kind === "invalid") return;

    const fallback = await fetchDiscovery(BUILD_API_BASE_URL);
    if (fallback.kind === "unreachable") return;
    if (fallback.kind === "valid" && fallback.config.site !== API_BASE_URL) {
      await store(fallback.config);
      return;
    }
    if (fallback.kind === "invalid") await SecureStore.deleteItemAsync(DOMAIN_CONFIG_STORAGE_KEY);
  } catch {
    /* Keşif isteğe bağlı; sessizce geç. */
  }
}
