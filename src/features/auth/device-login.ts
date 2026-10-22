import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode as decodeJpeg } from "jpeg-js";

import { ApiError, api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { decodeRingCode, formatCode } from "@/lib/ring-code";

/**
 * Telefonla giriş — masaüstündeki Ciklet Halkası'nı okuyup bu oturumla
 * onaylama. Akışın sunucu tarafı ciklet-web `lib/device-login`.
 *
 * ── Neden fotoğraf çekip JS'te çözüyoruz ──────────────────────────────
 * Halka kodu bize özel bir biçim; `expo-camera`'nın yerleşik barkod
 * okuyucusu onu tanımaz ve ham kare akışı vermez. Bu yüzden döngü:
 * fotoğraf çek → 360 px'e küçült → JPEG'i JS'te aç → `decodeRingCode`.
 * Küçük görüntüde çözüm ~100 ms; döngü ~0,7 sn'de bir, kullanıcı için
 * "kameraya tuttum, okundu" hissi yeterince hızlı. Çözücü döndürülmüş ve
 * hafif eğik koda dayanıklı (ciklet-web tests/unit/ring-code.test.ts).
 */

const SCAN_WIDTH = 360;

export interface InspectedRequest {
  device: {
    deviceName: string;
    osInfo: string;
    country: string | null;
    countryName: string | null;
    ipMasked: string;
  };
  createdAt: string;
  expiresAt: string;
}

/** Fotoğraf URI'sinden kodu çözer; kod yoksa null. */
export async function decodeRingFromPhoto(uri: string): Promise<string | null> {
  const context = ImageManipulator.manipulate(uri).resize({ width: SCAN_WIDTH });
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
    if (!saved.base64) return null;
    const bytes = base64ToBytes(saved.base64);
    const img = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 64 });
    const result = decodeRingCode({ data: img.data, width: img.width, height: img.height });
    return result ? formatCode(result) : null;
  } finally {
    rendered.release();
    context.release();
  }
}

function base64ToBytes(b64: string): Uint8Array {
  // Hermes `atob` sağlıyor; Buffer yok. Büyük görüntü değil (~40 KB).
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type InspectOutcome = { ok: true; request: InspectedRequest } | { ok: false; reason: "gone" | "error" };

export async function inspectDeviceLogin(code: string): Promise<InspectOutcome> {
  try {
    const request = await api<InspectedRequest>(endpoints.deviceLogin.inspect, { method: "POST", body: { code } });
    return { ok: true, request };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return { ok: false, reason: "gone" };
    return { ok: false, reason: "error" };
  }
}

export async function approveDeviceLogin(code: string): Promise<"ok" | "gone" | "error"> {
  try {
    await api(endpoints.deviceLogin.approve, { method: "POST", body: { code } });
    return "ok";
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return "gone";
    return "error";
  }
}

export async function rejectDeviceLogin(code: string): Promise<void> {
  await api(endpoints.deviceLogin.reject, { method: "POST", body: { code } }).catch(() => {});
}
