import { useCallback, useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";

import { ApiError } from "@/api/client";
import { fetchRoomToken } from "@/lib/livekit";
import { ClientEvent, ServerEvent } from "@/realtime/events";
import { getSocket, peekSocket } from "@/realtime/socket";
import { useAuth } from "@/stores/auth";
import { useVoice, type ActiveVoice, type VoiceParticipant } from "@/stores/voice";

/**
 * Ses oturumu — LiveKit odası + Ciklet soket senkronizasyonu.
 *
 * İKİ AYRI SİSTEM birlikte çalışır ve ikisi de gereklidir:
 *  - LiveKit  : gerçek ses akışı (token `GET /api/livekit`ten alınır;
 *               sunucu kanal üyeliğini/DM taraflığını orada doğrular).
 *  - Socket.IO: "kim bu kanalda" listesi. Ciklet katılımcı listesini
 *               LiveKit'ten değil kendi soketinden yayınlar; bu yüzden
 *               `join_voice_channel` göndermezsek diğer kullanıcılar bizi
 *               kanalda GÖRMEZ (ses gelse bile).
 *
 * `AudioSession` iOS'ta ses yönlendirmesini (hoparlör/kulaklık) ve arka
 * planda ses iznini yönetir; odaya bağlanmadan ÖNCE başlatılmalıdır.
 */

interface VoiceSessionState {
  token: string | null;
  status: "idle" | "connecting" | "connected" | "error";
  error: string | null;
}

/** Kullanıcı mikrofon iznini reddetti — sunucu hatasından ayrı ele alınır. */
class MicrophoneDeniedError extends Error {
  constructor() {
    super("Mikrofon izni verilmedi");
    this.name = "MicrophoneDeniedError";
  }
}

/**
 * Android çalışma zamanı mikrofon izni.
 *
 * iOS'ta `true` döner: orada izin, sistem mikrofonu ilk kullandığında
 * `NSMicrophoneUsageDescription` ile sorulur; önden istemek mümkün değildir.
 */
async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (await PermissionsAndroid.check(permission)) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: "Mikrofon izni",
    message: "Sesli kanallarda konuşabilmek için mikrofon erişimi gerekir.",
    buttonPositive: "İzin ver",
    buttonNegative: "Vazgeç",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVoiceSession(session: ActiveVoice | null) {
  const profile = useAuth((s) => s.profile);
  const joinStore = useVoice((s) => s.join);
  const leaveStore = useVoice((s) => s.leave);
  const setParticipants = useVoice((s) => s.setParticipants);

  const [state, setState] = useState<VoiceSessionState>({
    token: null,
    status: "idle",
    error: null,
  });

  // ── Token al + ses oturumunu başlat ───────────────────────────────
  useEffect(() => {
    if (!session || !profile) return;

    let cancelled = false;
    setState({ token: null, status: "connecting", error: null });

    (async () => {
      try {
        // Android'de mikrofon izni ÇALIŞMA ZAMANINDA istenmeli. LiveKit
        // bunu kendisi yapmaz; izin verilmeden oda kurulursa bağlantı açılır
        // ama kimse bizi duymaz — sessiz ve teşhisi zor bir arıza.
        // iOS'ta izin, mikrofon ilk kullanıldığında sistem tarafından sorulur
        // (NSMicrophoneUsageDescription app.json'da tanımlı).
        if (!(await ensureMicrophonePermission())) {
          throw new MicrophoneDeniedError();
        }

        await AudioSession.startAudioSession();
        const token = await fetchRoomToken(session.roomId, profile.username);
        if (cancelled) return;
        setState({ token, status: "connected", error: null });
        joinStore(session);
      } catch (err) {
        if (cancelled) return;
        setState({
          token: null,
          status: "error",
          error:
            err instanceof MicrophoneDeniedError
              ? "Sesli kanala katılmak için mikrofon izni gerekiyor. Ayarlar → Uygulamalar → Ciklet üzerinden verebilirsin."
              : err instanceof ApiError
                ? err.status === 403
                  ? "Bu kanala katılma yetkin yok."
                  : err.message
                : "Ses bağlantısı kurulamadı.",
        });
        await AudioSession.stopAudioSession().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession().catch(() => {});
    };
  }, [session, profile, joinStore]);

  // ── Soket: kanala katıl / ayrıl + katılımcı listesi ───────────────
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void getSocket().then((socket) => {
      if (!socket || cancelled) return;

      const onUpdate = (payload: {
        channelId: string;
        participants: VoiceParticipant[];
      }) => {
        if (payload.channelId !== session.roomId) return;
        setParticipants(payload.participants ?? []);
      };

      socket.on(ServerEvent.VOICE_CHANNEL_UPDATE, onUpdate);
      socket.emit(ClientEvent.JOIN_VOICE_CHANNEL, {
        channelId: session.roomId,
        callType: "audio",
      });

      detach = () => socket.off(ServerEvent.VOICE_CHANNEL_UPDATE, onUpdate);
    });

    return () => {
      cancelled = true;
      detach?.();
      peekSocket()?.emit(ClientEvent.LEAVE_VOICE_CHANNEL, {
        channelId: session.roomId,
      });
    };
  }, [session, setParticipants]);

  const leave = useCallback(() => {
    peekSocket()?.emit(ClientEvent.LEAVE_VOICE_CHANNEL, {
      channelId: session?.roomId,
    });
    void AudioSession.stopAudioSession().catch(() => {});
    leaveStore();
    setState({ token: null, status: "idle", error: null });
  }, [session, leaveStore]);

  return { ...state, leave };
}
