import { Platform, Vibration } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { usePreferences } from "@/stores/preferences";

/**
 * Çağrı zili.
 *
 * ── Neden ses var, yalnızca titreşim değil ──────────────────────────
 * Önceki sürümde gelen arama YALNIZCA titreşiyordu ("zil sesi için ses
 * varlığı yok" notu koddaydı). Telefon masadayken ya da cepteyken titreşim
 * çoğu zaman fark edilmez; arama, sesli bildirim olmadan pratikte
 * kaçırılıyordu. Sesler `scripts/generate-call-tones.mjs` ile üretiliyor —
 * telifsiz ve kaynağı depoda.
 *
 * ── Sessiz moda saygı ───────────────────────────────────────────────
 * iOS'ta `playsInSilentMode: false`: telefonun yan anahtarı sessizdeyse zil
 * ÇALMAZ, titreşim devam eder. WhatsApp ve sistem telefon uygulaması da
 * böyle davranır; sessize alınmış bir telefonu çaldırmak kullanıcının açık
 * talimatını çiğnemek olurdu.
 *
 * ── Neden `createAudioPlayer`, `useAudioPlayer` değil ───────────────
 * Zil, React ağacındaki bir bileşene değil ÇAĞRI OTURUMUNA bağlı. Bildirim
 * üzerinden gelen bir çağrıda henüz hiçbir çağrı ekranı monte edilmemiş
 * olabilir; hook tabanlı bir çalar o anda var olmaz.
 */

/** Zil titreşimi: 1 sn beklet, 0.6 sn titret — döngüsel. */
const RING_VIBRATION = [1000, 600, 1000, 600];

type RingKind = "incoming" | "outgoing";

let player: AudioPlayer | null = null;
let activeKind: RingKind | null = null;

function release() {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {
    /* Çalar zaten serbest bırakılmışsa sorun değil. */
  }
  player = null;
}

/**
 * Zili başlatır. Aynı tür zaten çalıyorsa hiçbir şey yapmaz — `incoming_call`
 * olayı yeniden bağlanmada tekrar gelebilir ve zili baştan başlatmak sesi
 * her seferinde kesip yeniden başlatırdı.
 */
export async function startRing(kind: RingKind): Promise<void> {
  if (activeKind === kind) return;
  stopRing();
  activeKind = kind;

  const preferences = usePreferences.getState();

  // Titreşim, ses ayarından bağımsızdır: sessizdeki telefonun kullanıcıyı
  // uyarabildiği tek yol budur.
  if (kind === "incoming") Vibration.vibrate(RING_VIBRATION, true);

  if (!preferences.notificationSounds) return;

  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      // Zil çalarken müzik/podcast duraklamalı; "mixWithOthers" zili
      // arkadaki sesin altında bırakırdı.
      interruptionMode: "doNotMix",
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    });

    const source =
      kind === "incoming"
        ? require("../../../assets/audio/ringtone.wav")
        : require("../../../assets/audio/ringback.wav");

    const created = createAudioPlayer(source);
    created.loop = true;
    // Giden aramada duyulan ton kullanıcının kendi kulağına çalıyor;
    // gelen arama zili kadar yüksek olması gereksiz.
    created.volume = kind === "incoming" ? 1 : 0.55;
    created.play();

    // `await` sırasında çağrı kapanmış olabilir (arayan vazgeçti). Bu
    // durumda `stopRing()` çoktan çalıştı ve `activeKind` sıfırlandı;
    // yeni çaları hemen bırakmazsak zil, çağrı bittikten sonra çalmaya
    // devam ederdi.
    if (activeKind !== kind) {
      created.pause();
      created.remove();
      return;
    }
    player = created;
  } catch {
    // Ses açılamazsa çağrı yine de kurulmalı; titreşim uyarısı ayakta.
  }
}

/** Zili ve titreşimi durdurur. Çağrının her bitiş yolunda çağrılmalı. */
export function stopRing(): void {
  activeKind = null;
  Vibration.cancel();
  release();
}

/**
 * Ses oturumunu LiveKit'e devretmeden önce zili susturur.
 *
 * Sıra önemli: LiveKit `startAudioSession()` çağrısıyla ses oturumunu
 * konuşma moduna alıyor. Zil hâlâ çalıyorken bunu yapmak iOS'ta zilin
 * kulaklık yoluna sıkışmasına, Android'de ise zil sesinin görüşmenin
 * içine karışmasına yol açıyor.
 */
export async function handOffToCall(): Promise<void> {
  stopRing();
  if (Platform.OS === "ios") {
    // Görüşme boyunca sessiz anahtarı yok sayılır: konuşma sesi, bildirim
    // sesi değildir ve kullanıcı aramayı bilerek kabul etti.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix" }).catch(
      () => {}
    );
  }
}
