import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import {
  acceptIncomingCall,
  dismissIncomingCallNotification,
  setPendingCallAction,
} from "@/features/call/incoming-call";
import { pollPendingInvites } from "@/realtime/use-call-events";
import { useAuth } from "@/stores/auth";
import { useCall } from "@/stores/call";
import { colors } from "@/theme/tokens";

/**
 * `ciklet://call/incoming?callId=&action=show|accept&directId=`
 *
 * Gelen arama sistem bildiriminden açılış (tam ekran niyeti, karta dokunma
 * ya da "Cevapla"). Ekranın kendisi boş: zil/çağrı katmanı (CallOverlay)
 * her ekranın üstünde. Burada yalnızca davet yüklenir, "Cevapla" ile
 * gelindiyse kabul edilir ve kullanıcı ilgili sohbete bırakılır.
 */
export default function IncomingCallRoute() {
  const { callId, action, directId } = useLocalSearchParams<{
    callId?: string;
    action?: string;
    directId?: string;
  }>();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    // Oturum yoksa giriş akışı devreye girer; davet o sürede düşer.
    if (status !== "signedIn") return;
    const wanted = action === "accept" ? "accept" : "show";

    if (callId) {
      const session = useCall.getState().session;
      if (session?.callId === callId && session.status === "ringing") {
        dismissIncomingCallNotification(callId);
        const room = session.directId ?? directId;
        if (wanted === "accept" && room) acceptIncomingCall(room);
      } else {
        // Davet henüz yüklenmedi (soğuk açılış): bekleyenler sorulur,
        // `ring` eylemi tüketir.
        setPendingCallAction(callId, wanted);
        pollPendingInvites();
      }
    }

    router.replace(directId ? `/chat/direct/${encodeURIComponent(directId)}` : "/(tabs)");
  }, [action, callId, directId, status]);

  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
