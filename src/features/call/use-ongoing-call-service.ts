import { useEffect, useRef } from "react";

import { nativeIncomingCalls } from "./incoming-call";

/**
 * Süren görüşme için Android ön plan hizmeti (modules/ciklet-calls
 * OngoingCallService). Kullanıcı görüşmedeyken başka uygulamaya geçince
 * Android mikrofonu/kamerayı kesip süreci öldürüyordu; görüşme düşüyordu.
 * Hizmet, görüşme sahnesi takılıyken açık kalır; bildirimdeki "Bitir"
 * `onHangUp`'ı çağırır. iOS'ta karşılığı arka plan ses kipi (app.json
 * UIBackgroundModes: audio, voip) — orada bir şey yapılmaz.
 */
export function useOngoingCallService({
  title,
  video,
  callId,
  onHangUp,
}: {
  title: string;
  video: boolean;
  callId: string;
  onHangUp: () => void;
}): void {
  const hangUp = useRef(onHangUp);
  useEffect(() => {
    hangUp.current = onHangUp;
  }, [onHangUp]);

  useEffect(() => {
    const native = nativeIncomingCalls;
    if (!native || typeof native.startOngoingCall !== "function") return;
    try {
      native.startOngoingCall(title, video, callId);
    } catch {
      // Eski derleme (modülde işlev yok) ya da izin: görüşme yine sürer.
      return;
    }
    const subscription = native.addListener("onCallAction", ({ action }) => {
      if (action === "hangup") hangUp.current();
    });
    return () => {
      subscription.remove();
      try {
        native.stopOngoingCall();
      } catch {
        /* hizmet zaten durmuş */
      }
    };
  }, [title, video, callId]);
}
