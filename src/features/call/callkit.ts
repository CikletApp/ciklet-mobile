import { Platform } from "react-native";

import {
  CikletCallKit,
  type CallKitActionEvent,
  type CallKitEndReason,
  type CikletCallKitModule,
  type NativeIncomingCall,
} from "../../../modules/ciklet-calls";
import { displayNameOf } from "@/lib/format";
import { useCall, type CallSession } from "@/stores/call";

/**
 * iOS CallKit köprüsü (modules/ciklet-calls/ios).
 *
 * WhatsApp gibi: gelen arama sistem arama ekranında çalar (kilit ekranında
 * da, uygulama kapalıyken de — VoIP push), görüşme uygulama değiştiricide ve
 * kilit ekranında sistem göstergesiyle sürer, sistemden susturulur/bitirilir.
 *
 * Çağrı durumunun TEK kaynağı yine `useCall` deposu. Burada depo izlenir ve
 * CallKit'e yansıtılır (giden arama başladı, bağlandı, bitti); CallKit'ten
 * gelen kullanıcı eylemleri (Cevapla/Reddet/Bitir/Sessiz) use-call-events'te
 * mevcut kabul/ret akışına bağlanır. Gelen aramanın CallKit'e bildirimi
 * `ring` içinde (push yükündeki ret adresi ve avatar depoda tutulmuyor).
 *
 * Android'de ve modülsüz derlemede `callKit` null; hiçbir şey değişmez.
 */

function resolveCallKit(): CikletCallKitModule | null {
  if (Platform.OS !== "ios" || !CikletCallKit) return null;
  try {
    return typeof CikletCallKit.isCallKitSupported === "function" && CikletCallKit.isCallKitSupported()
      ? CikletCallKit
      : null;
  } catch {
    return null;
  }
}

export const callKit = resolveCallKit();

const ignore = () => {};

/** Gelen aramayı sisteme bildir (aynı callId VoIP push'la geldiyse yerel taraf yok sayar). */
export function reportIncomingToCallKit(info: NativeIncomingCall): void {
  void callKit?.reportIncomingCall(info).catch(ignore);
}

// ── Depo → CallKit ───────────────────────────────────────────────────────

/** Şu an CallKit'te temsil edilen çağrının anahtarı (gelen: callId, giden: yerel). */
let activeKey: string | null = null;
let nextEndReason: CallKitEndReason | null = null;
let outgoingCounter = 0;

/**
 * Sıradaki bitişin nedeni — karşı taraftan/başka cihazdan gelen bitişte
 * sistem "kullanıcı kapattı" yerine doğru nedeni göstersin. Bir sonraki
 * oturum kapanışında tüketilir.
 */
export function setCallKitEndReason(reason: CallKitEndReason): void {
  nextEndReason = reason;
}

/** CallKit'teki çağrının anahtarı — sessiz senkronu ve sistem eylemi eşlemesi için. */
export function currentCallKitKey(): string | null {
  return activeKey;
}

function sameCall(a: CallSession, b: CallSession): boolean {
  if (a.direction !== b.direction || a.peer.id !== b.peer.id) return false;
  // Giden aramada callId sunucudan sonradan gelir; aynı arama sayılır.
  if (a.direction === "outgoing") return !a.callId || !b.callId || a.callId === b.callId;
  return a.callId === b.callId;
}

function endActive(): void {
  const key = activeKey;
  const reason = nextEndReason ?? "local";
  activeKey = null;
  nextEndReason = null;
  if (key) void callKit?.endCall(key, reason).catch(ignore);
}

function begin(session: CallSession): void {
  // Oturumsuz bir bitiş olayının bıraktığı neden yeni çağrıya taşınmasın.
  nextEndReason = null;
  if (session.direction === "incoming") {
    // Bildirimi `ring` yaptı; burada yalnızca anahtar tutulur.
    activeKey = session.callId;
    return;
  }
  outgoingCounter += 1;
  const key = `outgoing-${Date.now()}-${outgoingCounter}`;
  activeKey = key;
  void callKit?.startOutgoingCall(key, displayNameOf(session.peer), session.kind === "video").catch(ignore);
}

/**
 * Depo izleyicisi — modül yüklenince bir kez kurulur (aşağıda). Arka plan
 * açılışında da (VoIP push, React ağacı yokken) etkin olmalı.
 */
function installCallKitSync(): void {
  if (!callKit) return;
  useCall.subscribe((state, prev) => {
    const next = state.session;
    const before = prev.session;
    if (next === before) return;

    if (!next) {
      if (before) endActive();
      return;
    }
    if (!before || !sameCall(before, next)) {
      if (before) endActive();
      begin(next);
    }
    if (next.status === "connected" && before?.status !== "connected" && activeKey) {
      void callKit?.reportConnected(activeKey).catch(ignore);
    }
  });
}

installCallKitSync();

// ── VoIP token önbelleği ─────────────────────────────────────────────────

let voipToken: string | null = null;
if (callKit) {
  void callKit.getVoipToken().then((token) => {
    voipToken ??= token;
  }, ignore);
  callKit.addListener("onVoipToken", ({ token }) => {
    voipToken = token;
  });
}

/**
 * Bu cihazın VoIP token'ı (eşzamanlı). Kabul/ret isteğine eklenir: sunucu
 * "başka yerde yanıtlandı" VoIP push'unu işlemi yapan cihaza atmasın —
 * Apple her VoIP push'ta bir çağrı bildirilmesini şart koştuğu için o push
 * burada boş yere bir an çağrı ekranı açardı.
 */
export function currentVoipToken(): string | null {
  return voipToken;
}

/** Sistemdeki sessiz düğmesini LiveKit mikrofonuyla eşitle. */
export function syncCallKitMuted(muted: boolean): void {
  if (!activeKey) return;
  void callKit?.setMuted(activeKey, muted).catch(ignore);
}

export function onCallKitAction(listener: (event: CallKitActionEvent) => void): () => void {
  if (!callKit) return ignore;
  const subscription = callKit.addListener("onCallAction", listener);
  return () => subscription.remove();
}

/** Gelen olay bu oturuma mı ait (gelen: callId; giden: yerel anahtar). */
export function isCurrentCallKitCall(key: string | undefined): boolean {
  const session = useCall.getState().session;
  if (!session || !key) return false;
  return key === activeKey || key === session.callId;
}
