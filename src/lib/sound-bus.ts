import { playSound } from "@/lib/sounds";
import { useActivitySession } from "@/stores/activity";
import { useAuth } from "@/stores/auth";
import { useCall } from "@/stores/call";
import { useVoice } from "@/stores/voice";

/**
 * Ses veri yolu — durum değişimlerini seslere bağlayan tek nokta (web
 * `lib/sounds/sound-bus.ts`).
 *
 * Ses taşıma katmanına (LiveKit olayları, ekranın açık olması) değil NİYET
 * katmanına (store geçişleri) bağlı: "Ayrıl"a basıldığı an çalar, bileşen
 * hangi sırayla sökülürse sökülsün. Mikrofon düğmesinin sesi düğmenin
 * kendisinde (LiveKit durumu store'da tutulmuyor; features/voice/call-controls).
 */

let detach: (() => void) | null = null;

function subscribeActivities(): () => void {
  return useActivitySession.subscribe((state, prev) => {
    const key = state.session?.key ?? null;
    const prevKey = prev.session?.key ?? null;
    if (key === prevKey) return;
    // Aktiviteden aktiviteye geçiş: yalnızca katılma duyulur.
    if (key !== null) void playSound("activityJoin");
    else void playSound("activityLeave");
  });
}

/** Sesli kanal ve bağlı DM araması — web `useCallStore.inCall` geçişleri. */
function subscribeVoice(): () => void {
  const releaseVoice = useVoice.subscribe((state, prev) => {
    const room = state.active?.roomId ?? null;
    const prevRoom = prev.active?.roomId ?? null;
    if (room !== prevRoom) {
      // Kanaldan kanala geçiş: aradaki ayrılma sesi anlamsız, yalnızca giriş.
      if (room) void playSound("voiceJoin");
      else void playSound("voiceLeave");
      return;
    }
    if (!room || state.participants === prev.participants) return;

    // Odadaki BAŞKA biri girdi/çıktı (web: LiveKit ParticipantConnected /
    // Disconnected). Liste ancak ben odada göründükten sonra karşılaştırılır;
    // ilk dolum herkes için "girdi" sesi çaldırmasın.
    const myId = useAuth.getState().profile?.id;
    if (!myId || !prev.participants.some((p) => p.id === myId)) return;
    const before = new Set(prev.participants.map((p) => p.id));
    const after = new Set(state.participants.map((p) => p.id));
    const joined = state.participants.some((p) => p.id !== myId && !before.has(p.id));
    const left = prev.participants.some((p) => p.id !== myId && !after.has(p.id));
    if (joined) void playSound("voiceJoin");
    else if (left) void playSound("voiceLeave");
  });

  const releaseCall = useCall.subscribe((state, prev) => {
    const live = state.session?.status === "connected";
    const wasLive = prev.session?.status === "connected";
    if (live && !wasLive) void playSound("voiceJoin");
    else if (!live && wasLive) void playSound("voiceLeave");
  });

  return () => {
    releaseVoice();
    releaseCall();
  };
}

/** Uygulama ömrü boyunca bir kez bağlanır (kök düzen). */
export function attachSoundBus(): () => void {
  if (!detach) {
    const releases = [subscribeActivities(), subscribeVoice()];
    detach = () => releases.forEach((release) => release());
  }
  return () => {
    detach?.();
    detach = null;
  };
}
