import { DEFAULT_API_BASE_URL } from "@ciklet/embedded-activities-sdk/types";

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
export const API_BASE_URL = normalizeBase(
  clean(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_BASE_URL
);

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
export const LIVEKIT_URL =
  clean(process.env.EXPO_PUBLIC_LIVEKIT_URL) ??
  API_BASE_URL.replace(/^http/, "ws");

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
