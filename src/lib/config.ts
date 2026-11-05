import { DEFAULT_API_BASE_URL } from "@ciklet/embedded-activities-sdk/types";
import * as SecureStore from "expo-secure-store";

import {
  hostOfOrigin,
  sanitizeStoredConfig,
  swapHost,
  type DiscoveredConfig,
} from "./domain-discovery-verify";

/**
 * Çalışma zamanı yapılandırması.
 *
 * Değerler `EXPO_PUBLIC_*` ortam değişkenlerinden gelir; bunlar derleme
 * anında paketin içine gömülür (yani SIR TAŞIYAMAZLAR — yalnızca adresler).
 * Geliştirmede `.env` dosyası, üretimde `eas.json` profillerindeki `env`
 * bloğu kullanılır.
 */

/** Sondaki eğik çizgi, `${base}${path}` birleştirmesinde çift `//` üretir. */
function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function clean(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * API kökü. Geliştirmede telefonun erişebildiği adres olmalı —
 * `localhost` cihazın kendisini işaret eder, geliştirme makineni değil.
 *
 * NOT: `process.env.EXPO_PUBLIC_*` erişimleri Metro tarafından derleme anında
 * sabitle değiştirilir; dinamik indeksleme (`process.env[key]`) çalışmaz.
 */
export const BUILD_API_BASE_URL = normalizeBase(
  clean(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_BASE_URL
);

/**
 * Alan adı keşfi (lib/domain-discovery): site imzalı
 * `/.well-known/ciklet.json` ile yeni kökü bildirirse doğrulanmış kayıt
 * güvenli depoya yazılır ve BİR SONRAKİ açılışta buradan okunur — oturum
 * ortasında kök değişmez (açık soket, önbellek, çerez adı aynı kökte kalır).
 * Kapatmak: `EXPO_PUBLIC_DOMAIN_DISCOVERY=0` (derleme bayrağı).
 */
export const DOMAIN_DISCOVERY_ENABLED = clean(process.env.EXPO_PUBLIC_DOMAIN_DISCOVERY) !== "0";
export const DOMAIN_CONFIG_STORAGE_KEY = "ciklet.domainConfig";

function readStoredDomainConfig(): DiscoveredConfig | null {
  // Yalnızca derlemedeki kök gerçek bir https alanıysa (geliştirmedeki LAN
  // adresi keşifle ezilmesin).
  if (!DOMAIN_DISCOVERY_ENABLED || !BUILD_API_BASE_URL.startsWith("https://")) return null;
  try {
    const raw = SecureStore.getItem(DOMAIN_CONFIG_STORAGE_KEY);
    return raw ? sanitizeStoredConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Bu açılışta etkin keşif kaydı (yoksa derlemedeki adresler). */
export const ACTIVE_DOMAIN_CONFIG = readStoredDomainConfig();

export const API_BASE_URL = ACTIVE_DOMAIN_CONFIG?.site ?? BUILD_API_BASE_URL;

/** Site kökü (`https://ciklet.xyz`) — davet, paylaşım, yardım bağlantıları buradan. */
export function siteOrigin(): string {
  return API_BASE_URL;
}

/** Site alan adı (`ciklet.xyz`) — metinde gösterilen adresler için. */
export function siteHost(): string {
  return hostOfOrigin(API_BASE_URL);
}

/** Derlemedeki adres site ile aynı alandaysa keşfedilen alana taşınır. */
function onActiveSite(url: string): string {
  if (!ACTIVE_DOMAIN_CONFIG) return url;
  return swapHost(url, hostOfOrigin(BUILD_API_BASE_URL), hostOfOrigin(ACTIVE_DOMAIN_CONFIG.site));
}

/**
 * Sunucunun verdiği görsel adresini <Image>'ın açabileceği hale getirir.
 *
 * Rich presence kapakları göreli yol olarak gelir
 * (`/api/presence/covers/<sha256>`; web aynı kökenden çözer). Mobilde
 * kök olmadığı için API adresine eklenir. Mutlak adresler olduğu gibi kalır;
 * `//` ile başlayan protokol-göreli adres yol sayılmaz.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return `${API_BASE_URL}${url}`;
  return url;
}

/**
 * LiveKit sinyal adresi — **YOL EKLENMEZ**.
 *
 * `livekit-client` sunucu adresine `/rtc` yolunu KENDİSİ ekliyor
 * (`appendUrlPath(urlObj, 'rtc')`). Buraya `/rtc` yazıldığında istek
 * `wss://ciklet.xyz/rtc/rtc` adresine gidiyor, nginx onu `livekit:7880`
 * üzerinde bulunmayan bir yola iletiyor ve **bağlantı hiç kurulmuyordu** —
 * hem DM aramaları hem sesli kanallar bu yüzden çalışmıyordu.
 *
 * Doğru değer köktür: `wss://ciklet.xyz`. Üretimde nginx'in `/rtc`
 * location'ı istemcinin eklediği yolu yakalayıp SFU'ya iletir; medya ayrı
 * portlardan (UDP 7882 / TCP 7881) doğrudan akar.
 */
export const LIVEKIT_URL = onActiveSite(
  clean(process.env.EXPO_PUBLIC_LIVEKIT_URL) ?? BUILD_API_BASE_URL.replace(/^http/, "ws")
);

/**
 * Gerçek zamanlı ağ geçidi (ADR-0012). Üretimde nginx `/gateway/ws`'i
 * Rust sürecine iletiyor; yerelde nginx yok ve ağ geçidi doğrudan
 * `:4000/ws`'de dinliyor, bu yüzden `.env` ayrıca yazar.
 */
export const BUILD_GATEWAY_URL =
  clean(process.env.EXPO_PUBLIC_GATEWAY_URL) ?? `${BUILD_API_BASE_URL.replace(/^http/, "ws")}/gateway/ws`;

export const GATEWAY_URL = ACTIVE_DOMAIN_CONFIG?.gateway ?? onActiveSite(BUILD_GATEWAY_URL);

/** Tek bir HTTP isteğinin üst sınırı. Askıda kalan istek arayüzü kilitler. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Token'ın son kullanma tarihine bu kadar kala yenileme tetiklenir.
 * Sunucu 30 günlük token veriyor; 3 günlük pencere, uygulamayı seyrek açan
 * kullanıcının bile oturumunu düşürmeden yenilemesine yeter.
 */
export const SESSION_REFRESH_LEEWAY_MS = 3 * 24 * 60 * 60 * 1000;

/** Soket canlılık sinyali aralığı — sunucudaki presence zamanlayıcısıyla uyumlu. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

if (__DEV__ && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
  console.warn(
    "[config] API_BASE_URL yerel geri döngü adresi içeriyor — fiziksel cihazdan erişilemez. " +
      ".env dosyasında EXPO_PUBLIC_API_URL'i geliştirme makinenin LAN IP'siyle değiştir."
  );
}
