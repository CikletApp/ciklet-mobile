import { registerGlobals } from "@livekit/react-native";
import type { LiveKitTokenResponse } from "@ciklet/embedded-activities-sdk/types";

import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";

/**
 * LiveKit köprüsü.
 *
 * `registerGlobals()` WebRTC API'lerini RN ortamına kaydeder; uygulama
 * girişinde (kök düzen modülü yüklenirken) bir kez çağrılır.
 *
 * Sinyal adresi web istemcisiyle aynıdır: nginx `/rtc` yolunu SFU'ya
 * proxy'ler, medya UDP 7882 / TCP 7881'den doğrudan akar. Adres
 * `lib/config.ts` içinde türetilir — burada tekrarlanmaz.
 */

let globalsRegistered = false;

export function setupLiveKit() {
  if (globalsRegistered) return;
  registerGlobals();
  globalsRegistered = true;
}

export { LIVEKIT_URL } from "@/lib/config";

/**
 * Oda token'ı. Sunucu, kanal üyeliğini veya DM katılımcılığını doğruladıktan
 * sonra token üretir — istemcinin oda adına güvenilmez.
 */
export async function fetchRoomToken(room: string, username: string) {
  const res = await api<LiveKitTokenResponse>(
    endpoints.livekitToken(room, username)
  );
  return res.token;
}
