import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { parseRecognizedKeys } from "@/lib/recognized-games";
import { usePresenceStore } from "@/stores/presence";

/**
 * Tanınan oyun kümesinin eşitlemesi — ciklet-web `startRecognizedGamesSync`.
 *
 * Girişte yüklenir, 10 dk'da bir tazelenir (root kataloğa oyun ekleyebilir);
 * hata olursa 30 sn sonra yeniden denenir. Küme gelene dek oyun/program
 * etkinlikleri gizli kalır (`stores/presence` seçicileri). RealtimeProvider
 * oturum açıkken bir kez başlatır; dönen fonksiyon durdurur.
 */

const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 30 * 1000;

export function startRecognizedGamesSync(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (ms: number) => {
    if (!stopped) timer = setTimeout(run, ms);
  };
  function run() {
    api<unknown>(endpoints.recognizedGames)
      .then((body) => {
        if (stopped) return;
        usePresenceStore.getState().setRecognized(parseRecognizedKeys(body));
        schedule(REFRESH_MS);
      })
      .catch(() => schedule(RETRY_MS));
  }
  run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
