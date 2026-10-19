import { AppState } from "react-native";
import { create } from "zustand";

import { api, ApiError, peekSession } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ListenAlongResponse, SpotifyNowPlaying } from "@/api/types";
import { showToast } from "@/components/ui/toast";

/**
 * Spotify "Birlikte dinle" — web `ListenAlongSync` döngüsünün mobil kopyası.
 *
 * Ev sahibi seçiliyken ~10 sn'de bir `POST /api/spotify/listen-along`
 * gönderilir; sunucu ev sahibinin çalanını okuyup dinleyicinin Spotify'ını
 * gerekirse aynı şarkıya ve konuma getirir. Telefon yalnızca bir uzaktan
 * kumanda: ses dinleyicinin kendi Spotify cihazında çalar (telefondaki
 * Spotify uygulaması dahil).
 *
 * Döngü bir bileşene bağlı DEĞİL (modül düzeyinde zamanlayıcı): profil
 * ekranından çıkınca birlikte dinleme sürmeli. Uygulama arka plandayken JS
 * zamanlayıcıları durur; ön plana dönüşte hemen bir eşitleme adımı atılır.
 */

const SYNC_MS = 10_000;

const STOP_MESSAGES: Record<string, string> = {
  no_device: "Spotify'da açık bir cihaz yok. Spotify'ı aç, sonra tekrar dene.",
  premium_required: "Birlikte dinleme Spotify Premium gerektirir.",
  not_linked: "Önce Spotify hesabını bağla (web: Ayarlar → Profil → Bağlantılar).",
  hidden: "Bu kişi Spotify'ını artık paylaşmıyor.",
};

interface ListenAlongState {
  host: { id: string; name: string } | null;
  track: SpotifyNowPlaying | null;
  /** Ev sahibi duraklattı — beklenir, döngü sürer. */
  paused: boolean;
}

export const useListenAlong = create<ListenAlongState>(() => ({ host: null, track: null, paused: false }));

let timer: ReturnType<typeof setTimeout> | null = null;
/** Her başlatma yeni bir nesil; eski döngünün geç gelen yanıtı yok sayılır. */
let generation = 0;
/** Oturumdaki profil — `stores/auth.ts` her değişimde bildirir. */
let sessionProfileId: string | null = null;
/** Döngüyü başlatan profil; başka profilin oturumunda döngü sürmez. */
let ownerProfileId: string | null = null;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Durumu yalnızca yerelde sıfırlar; sunucuya "stop" GİTMEZ. Oturum düştüğünde
 * ya da başka profile geçildiğinde kullanılır — istek ya 401 döner ya da
 * yanlış hesabın adına gider.
 */
function resetLocal() {
  generation += 1;
  clearTimer();
  ownerProfileId = null;
  useListenAlong.setState({ host: null, track: null, paused: false });
}

/** Döngü bu oturumda sürebilir mi: oturum var ve başlatan profil hâlâ girişli. */
function sessionMatches(): boolean {
  return !!peekSession() && !!ownerProfileId && ownerProfileId === sessionProfileId;
}

/**
 * `stores/auth.ts` oturumdaki profili bildirir. Profil değiştiyse ya da
 * oturum kapandıysa (null) birlikte dinleme yerelde durur.
 */
export function setListenAlongProfile(profileId: string | null) {
  sessionProfileId = profileId;
  if (useListenAlong.getState().host && ownerProfileId !== profileId) resetLocal();
}

async function tick(gen: number) {
  const host = useListenAlong.getState().host;
  if (!host || gen !== generation) return;
  if (!sessionMatches()) {
    resetLocal();
    return;
  }
  try {
    const res = await api<ListenAlongResponse>(endpoints.spotifyListenAlong, {
      method: "POST",
      body: { hostProfileId: host.id, action: "sync" },
    });
    if (gen !== generation) return;
    if (res.state === "playing") {
      useListenAlong.setState({ track: res.track ?? null, paused: false });
    } else if (res.state === "host_paused") {
      useListenAlong.setState({ paused: true });
    } else if (STOP_MESSAGES[res.state]) {
      showToast(STOP_MESSAGES[res.state]);
      stopListenAlong();
      return;
    }
  } catch (err) {
    // Oturum düştü: döngü sürerse her 10 sn'de bir 401 üretir.
    if (err instanceof ApiError && err.isUnauthorized) {
      if (gen === generation) resetLocal();
      return;
    }
    // Geçici hata (ağ, 429): bir sonraki adımda yeniden denenir.
  }
  if (gen !== generation) return;
  clearTimer();
  timer = setTimeout(() => void tick(gen), SYNC_MS);
}

export function startListenAlong(host: { id: string; name: string }) {
  const previous = useListenAlong.getState().host;
  if (previous && previous.id !== host.id && sessionMatches()) void sendStop(previous.id);
  generation += 1;
  clearTimer();
  ownerProfileId = sessionProfileId;
  useListenAlong.setState({ host, track: null, paused: false });
  void tick(generation);
}

/**
 * Birlikte dinlemeyi bitirir. Dönen söz "stop" isteği bitince çözülür —
 * çıkış akışı token'ı düşürmeden önce bunu bekler.
 */
export function stopListenAlong(): Promise<void> {
  const host = useListenAlong.getState().host;
  const canNotify = sessionMatches();
  resetLocal();
  return host && canNotify ? sendStop(host.id) : Promise.resolve();
}

function sendStop(hostId: string): Promise<void> {
  return api(endpoints.spotifyListenAlong, {
    method: "POST",
    body: { hostProfileId: hostId, action: "stop" },
  }).then(
    () => undefined,
    () => undefined
  );
}

// Ön plana dönüşte bekleyen zamanlayıcıyı beklemeden eşitle.
AppState.addEventListener("change", (next) => {
  if (next !== "active" || !useListenAlong.getState().host) return;
  clearTimer();
  void tick(generation);
});
