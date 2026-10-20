import { useEffect } from "react";
import { useConnectionState, useLocalParticipant } from "@livekit/react-native";
import { ConnectionState } from "livekit-client";

import { callKit, isCurrentCallKitCall, onCallKitAction, syncCallKitMuted } from "./callkit";

/**
 * iOS: sistem arama ekranındaki "Sessiz" düğmesi ↔ LiveKit mikrofonu.
 *
 * LiveKit odasının İÇİNDE takılı olmalı (yerel katılımcıyı okur). Tek doğruluk
 * kaynağı yine LiveKit'in `isMicrophoneEnabled`'ı (bkz. CallControls):
 * uygulamadan susturunca sisteme bildirilir, sistemden susturunca mikrofon
 * kapatılır; yerel taraf aynı değeri ikinci kez istemez, döngü olmaz.
 * Android'de ve modülsüz derlemede hiçbir şey çizmez.
 */
export function CallKitMuteSync() {
  if (!callKit) return null;
  return <MuteSync />;
}

function MuteSync() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const connected = useConnectionState() === ConnectionState.Connected;

  useEffect(() => {
    // Bağlanmadan önce mikrofon henüz yayınlanmadığı için "kapalı" görünür;
    // sistem bir an "sessiz" göstermesin.
    if (connected) syncCallKitMuted(!isMicrophoneEnabled);
  }, [connected, isMicrophoneEnabled]);

  useEffect(
    () =>
      onCallKitAction(({ action, callId }) => {
        if ((action !== "mute" && action !== "unmute") || !isCurrentCallKitCall(callId)) return;
        void localParticipant?.setMicrophoneEnabled(action === "unmute").catch(() => undefined);
      }),
    [localParticipant]
  );

  return null;
}
