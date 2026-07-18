import { registerGlobals } from "@livekit/react-native";
import type { LiveKitTokenResponse } from "@ciklet/embedded-activities-sdk/types";

import { API_BASE_URL } from "@/lib/config";
import { api } from "@/api/client";

/**
 * LiveKit köprüsü.
 *
 * - registerGlobals() WebRTC API'lerini RN ortamına kaydeder; uygulama
 *   girişinde (root layout) bir kez çağrılır.
 * - Sinyal adresi web istemcisiyle aynıdır: wss://ciklet.xyz/rtc (nginx
 *   /rtc yolu LiveKit'e proxy'ler; medya UDP 7882 / TCP 7881'den doğrudan
 *   akar). Yerel geliştirmede EXPO_PUBLIC_LIVEKIT_URL ile ezilir.
 */

let globalsRegistered = false;

export function setupLiveKit() {
  if (globalsRegistered) return;
  registerGlobals();
  globalsRegistered = true;
}

export const LIVEKIT_URL =
  process.env.EXPO_PUBLIC_LIVEKIT_URL ??
  API_BASE_URL.replace(/^http/, "ws") + "/rtc";

/**
 * Oda token'ı — mevcut GET /api/livekit ucu; sunucu, kanal üyeliğini veya
 * DM katılımcılığını doğruladıktan sonra token üretir.
 */
export async function fetchRoomToken(room: string, username: string) {
  const res = await api<LiveKitTokenResponse>(
    `/api/livekit?room=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`
  );
  return res.token;
}
