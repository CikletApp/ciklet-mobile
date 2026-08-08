import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";

import { ApiError } from "@/api/client";
import { fetchRoomToken } from "@/lib/livekit";
import { useAuth } from "@/stores/auth";

/**
 * LiveKit oda token'ı + ses oturumu kurulumu.
 *
 * Hem sesli kanal hem DM araması aynı yolu kullanır: oda adı kanal veya DM
 * kimliğidir, `/api/livekit` erişimi ikisi için de doğrular.
 *
 * Sıra önemlidir:
 *  1. Android'de RECORD_AUDIO izni — LiveKit bunu KENDİSİ İSTEMEZ. İzin
 *     verilmeden oda kurulursa bağlantı açılır ama karşı taraf bizi duymaz;
 *     sessiz ve teşhisi zor bir arıza.
 *  2. `AudioSession.startAudioSession()` — iOS ses yönlendirmesi ve arka
 *     plan sesi için, odaya bağlanmadan ÖNCE.
 *  3. Token.
 */
export function useVoiceToken(roomId: string | null | undefined) {
  const profile = useAuth((s) => s.profile);
  const [result, setResult] = useState<{
    roomId: string;
    token: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!roomId || !profile) return;

    let cancelled = false;

    (async () => {
      try {
        if (!(await ensureMicrophonePermission())) {
          throw new MicrophoneDeniedError();
        }
        await AudioSession.startAudioSession();
        const issued = await fetchRoomToken(roomId, profile.username);
        if (!cancelled) setResult({ roomId, token: issued, error: null });
      } catch (err) {
        if (cancelled) return;
        setResult({ roomId, token: null, error: describeError(err) });
        await AudioSession.stopAudioSession().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      void AudioSession.stopAudioSession().catch(() => {});
    };
  }, [roomId, profile]);

  if (result && result.roomId === roomId) {
    return { token: result.token, error: result.error };
  }
  return { token: null, error: null };
}

/** Kullanıcı mikrofon iznini reddetti — sunucu hatasından ayrı ele alınır. */
export class MicrophoneDeniedError extends Error {
  constructor() {
    super("Mikrofon izni verilmedi");
    this.name = "MicrophoneDeniedError";
  }
}

function describeError(err: unknown): string {
  if (err instanceof MicrophoneDeniedError) {
    return "Konuşabilmek için mikrofon izni gerekiyor. Ayarlar → Uygulamalar → Ciklet üzerinden verebilirsin.";
  }
  if (err instanceof ApiError) {
    return err.status === 403 ? "Bu görüşmeye katılma yetkin yok." : err.message;
  }
  return "Ses bağlantısı kurulamadı.";
}

/**
 * Android çalışma zamanı mikrofon izni.
 *
 * iOS'ta `true` döner: orada izin, sistem mikrofonu ilk kullandığında
 * `NSMicrophoneUsageDescription` ile sorulur; önden istemek mümkün değildir.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (await PermissionsAndroid.check(permission)) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: "Mikrofon izni",
    message: "Konuşabilmek için mikrofon erişimi gerekir.",
    buttonPositive: "İzin ver",
    buttonNegative: "Vazgeç",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
