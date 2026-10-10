import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  AndroidAudioTypePresets,
  AudioSession,
  type AppleAudioCategoryOption,
  type AppleAudioConfiguration,
  type AudioEngineConfigurationState,
} from "@livekit/react-native";
import { create } from "zustand";

/**
 * Çağrı ses yönü — ahize / hoparlör / kulaklık.
 *
 * Sesli DM araması ahizeden, görüntülü arama ve sesli kanal hoparlörden
 * başlar; kablolu ya da Bluetooth kulaklık takılıysa o kazanır.
 *
 * Neden ayrı modül:
 *  - Android: AudioSwitch'in varsayılan sırası hoparlörü ahizeden önce
 *    koyuyor; tercih sırası `startAudioSession`'dan ÖNCE verilmeli, sonra
 *    yok sayılıyor.
 *  - iOS: `videoChat` modu sessizce `defaultToSpeaker` demek; o moddayken
 *    `overrideOutputAudioPort(.none)` yine hoparlöre düşer. Ahize için mod
 *    `voiceChat`'e çekilmeli. LiveKit motor her açıldığında kategoriyi
 *    yeniden yazdığı için tercih `appleConfigFor` geri çağrısında yaşar
 *    (bkz. lib/livekit.ts).
 *  - SDK cihaz değişimini JS'e bildirmiyor; Android'de liste yoklanır.
 */

export type BuiltInRoute = "earpiece" | "speaker";
export type ExternalRoute = "bluetooth" | "headset";
export type AudioRoute = BuiltInRoute | ExternalRoute;

interface AudioRouteState {
  /** Dahili çıkış tercihi (kulaklık yokken kullanılacak olan). */
  preferred: BuiltInRoute;
  /** Etkin harici cihaz (yalnızca Android'de tespit edilir). */
  external: ExternalRoute | null;
  /** Android'in bildirdiği çıkışlar; iOS'ta boş kalır. */
  outputs: string[];
}

const useAudioRouteStore = create<AudioRouteState>(() => ({
  preferred: "speaker",
  external: null,
  outputs: [],
}));

/**
 * Açık ses oturumları (yığın): sesli kanaldayken DM araması gelebilir. En
 * üstteki oturumun tercihi geçerli; o kapanınca alttakinin tercihi geri
 * yüklenir. Boşsa iOS geri çağrısı SDK varsayılanına döner.
 */
const sessions: { id: number; preferred: BuiltInRoute }[] = [];
let nextSessionId = 1;
let activeSessions = 0;

export function getPreferredRoute(): BuiltInRoute {
  return useAudioRouteStore.getState().preferred;
}

/** Başka bir ses oturumu hâlâ açık mı — yerel oturum yalnızca sonuncusu kapanınca durur. */
export function hasActiveAudioSessions() {
  return activeSessions > 0;
}

/**
 * Oturum başlamadan önce tercih edilen yönü uygular. Bluetooth ve kablolu
 * kulaklık listenin başında — bağlıysa çağrı otomatik onlardan başlar.
 * Dönen kimlik `releaseAudioRoute`'a verilir.
 */
export async function prepareAudioRoute(defaultRoute: BuiltInRoute): Promise<number> {
  const id = nextSessionId++;
  sessions.push({ id, preferred: defaultRoute });
  activeSessions = sessions.length;
  useAudioRouteStore.setState({ preferred: defaultRoute, external: null, outputs: [] });
  await configureFor(defaultRoute);
  return id;
}

async function configureFor(defaultRoute: BuiltInRoute) {
  await AudioSession.configureAudio({
    android: {
      preferredOutputList:
        defaultRoute === "earpiece"
          ? ["bluetooth", "headset", "earpiece", "speaker"]
          : ["bluetooth", "headset", "speaker", "earpiece"],
      audioTypeOptions: AndroidAudioTypePresets.communication,
    },
    ios: { defaultOutput: defaultRoute },
  }).catch(() => {});
}

/**
 * `prepareAudioRoute`'un karşılığı; oturum kapanırken çağrılır. Üstteki
 * oturum kapanıp altta biri kaldıysa (DM araması bitti, sesli kanal sürüyor)
 * onun tercihi ve yönü geri yüklenir.
 */
export function releaseAudioRoute(id: number) {
  const index = sessions.findIndex((session) => session.id === id);
  if (index === -1) return;
  const wasTop = index === sessions.length - 1;
  sessions.splice(index, 1);
  activeSessions = sessions.length;
  if (sessions.length === 0) {
    useAudioRouteStore.setState({ external: null, outputs: [] });
    return;
  }
  if (!wasTop) return;
  const { preferred } = sessions[sessions.length - 1];
  useAudioRouteStore.setState({ preferred });
  void configureFor(preferred).then(() => {
    if (useAudioRouteStore.getState().external) return;
    void setAudioRoute(preferred);
  });
}

/** Kullanıcının seçimi o anki (üstteki) oturuma yazılır. */
function rememberPreferred(route: BuiltInRoute) {
  const top = sessions[sessions.length - 1];
  if (top) top.preferred = route;
}

/**
 * iOS ses kategorisi — LiveKit motoru her açılışta bunu sorar
 * (`setupIOSAudioManagement`). Kayıt dışı dallar SDK varsayılanlarının
 * aynısı (AudioManager.ts), yalnızca çağrı sürerken tercih korunur.
 */
export function appleConfigFor(state: AudioEngineConfigurationState): AppleAudioConfiguration {
  if (state.isRecordingEnabled || (state.isPlayoutEnabled && activeSessions > 0)) {
    return callAppleConfig(getPreferredRoute());
  }
  if (state.isPlayoutEnabled) {
    return { audioCategory: "playback", audioCategoryOptions: ["mixWithOthers"], audioMode: "spokenAudio" };
  }
  return { audioCategory: "soloAmbient", audioCategoryOptions: [], audioMode: "default" };
}

function callAppleConfig(route: BuiltInRoute): AppleAudioConfiguration {
  const options: AppleAudioCategoryOption[] = ["allowBluetooth", "allowBluetoothA2DP", "allowAirPlay"];
  if (route === "speaker") options.push("defaultToSpeaker");
  return {
    audioCategory: "playAndRecord",
    audioCategoryOptions: options,
    audioMode: route === "speaker" ? "videoChat" : "voiceChat",
  };
}

/** Çıkışı değiştirir; başarısızsa durum değişmez (düğme yalan söylemesin). */
export async function setAudioRoute(route: AudioRoute) {
  if (Platform.OS === "ios") {
    if (route === "bluetooth" || route === "headset") {
      showSystemRoutePicker();
      return;
    }
    const before = getPreferredRoute();
    // Tercih önce yazılır: arada motor yeniden açılırsa geri çağrı yeni
    // yönü okusun.
    useAudioRouteStore.setState({ preferred: route });
    try {
      // Mod değişimi şart: videoChat altında `.none` hoparlöre düşer.
      await AudioSession.setAppleAudioConfiguration(callAppleConfig(route));
      await AudioSession.selectAudioOutput(route === "speaker" ? "force_speaker" : "default");
      rememberPreferred(route);
    } catch {
      useAudioRouteStore.setState({ preferred: before });
    }
    return;
  }

  try {
    await AudioSession.selectAudioOutput(route);
    if (route === "bluetooth" || route === "headset") {
      useAudioRouteStore.setState({ external: route });
    } else {
      useAudioRouteStore.setState({ preferred: route, external: null });
      rememberPreferred(route);
    }
  } catch {
    /* Seçim başarısız — mevcut durumu koru. */
  }
}

/** iOS: AirPods / AirPlay gibi diğer cihazlar için sistem seçicisi. */
export function showSystemRoutePicker() {
  void AudioSession.showAudioRoutePicker().catch(() => {});
}

const POLL_MS = 1500;

/**
 * Bağlı oturumda ses yönü. Android'de çıkış listesi yoklanır: yeni takılan
 * kulaklık seçilir (telefon uygulamaları gibi), çıkarılınca dahili tercihe
 * dönülür.
 */
export function useAudioRoute() {
  const preferred = useAudioRouteStore((s) => s.preferred);
  const external = useAudioRouteStore((s) => s.external);
  const outputs = useAudioRouteStore((s) => s.outputs);
  const previous = useRef<string[]>([]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;
    // Aynı oturumda yeniden takılınca (ör. "Tekrar dene") bilinen liste
    // "yeni takıldı" sayılmasın — kullanıcının hoparlör seçimi ezilmez.
    previous.current = useAudioRouteStore.getState().outputs;
    let emptyPolls = 0;

    const poll = async () => {
      let list: string[];
      try {
        list = (await AudioSession.getAudioOutputs()) ?? [];
      } catch {
        return;
      }
      if (cancelled) return;

      const before = previous.current;
      previous.current = list;
      const state = useAudioRouteStore.getState();
      if (!sameList(list, state.outputs)) useAudioRouteStore.setState({ outputs: list });

      // Oturum henüz kurulmadı (native start ana iş parçacığında sırada).
      // Hâlâ boşsa hızlı stop→start yarışında start yutulmuştur; yeniden
      // başlat (AudioSwitch varsa native taraf no-op).
      if (list.length === 0) {
        emptyPolls += 1;
        if (emptyPolls === 2 && activeSessions > 0) {
          void AudioSession.startAudioSession().catch(() => {});
        }
        return;
      }
      emptyPolls = 0;

      const arrived = (["bluetooth", "headset"] as const).find(
        (id) => list.includes(id) && !before.includes(id)
      );
      if (arrived) {
        await AudioSession.selectAudioOutput(arrived).catch(() => {});
        useAudioRouteStore.setState({ external: arrived });
        return;
      }

      if (state.external && !list.includes(state.external)) {
        useAudioRouteStore.setState({ external: null });
        if (list.includes(state.preferred)) {
          await AudioSession.selectAudioOutput(state.preferred).catch(() => {});
        }
      }
    };

    const first = setTimeout(() => void poll(), 300);
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      previous.current = [];
    };
  }, []);

  // Emülatör gibi ahizesi olmayan cihazda tercih edilen çıkış yoksa
  // düğme gerçekte çalanı göstersin.
  const builtIn: BuiltInRoute =
    Platform.OS === "android" && outputs.length > 0 && !outputs.includes(preferred)
      ? preferred === "earpiece"
        ? "speaker"
        : "earpiece"
      : preferred;

  const route: AudioRoute = external ?? builtIn;

  /** Kulaklık yokken ahize ↔ hoparlör geçişi. */
  const toggle = useCallback(() => {
    const target: BuiltInRoute = builtIn === "speaker" ? "earpiece" : "speaker";
    if (Platform.OS === "android" && outputs.length > 0 && !outputs.includes(target)) return;
    void setAudioRoute(target);
  }, [builtIn, outputs]);

  /** Android'de harici cihaz bağlıyken seçilebilecek çıkışlar. */
  const choices: AudioRoute[] =
    Platform.OS === "android" && (outputs.includes("bluetooth") || outputs.includes("headset"))
      ? (["earpiece", "speaker", "bluetooth", "headset"] as const).filter((id) => outputs.includes(id))
      : [];

  return { route, toggle, choices, select: setAudioRoute };
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
