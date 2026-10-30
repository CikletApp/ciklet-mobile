import { useEffect, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";

import { ApiError } from "@/api/client";
import { fetchRoomToken, NO_VOICE_MODERATION, type ChannelVoiceSettings, type VoiceModerationState } from "@/lib/livekit";
import { CHANNEL_FULL_CODE } from "@/lib/voice-settings";
import { useAuth } from "@/stores/auth";
import {
  hasActiveAudioSessions,
  prepareAudioRoute,
  releaseAudioRoute,
  type BuiltInRoute,
} from "./audio-route";

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
 *  2. Çıkış tercihi (`prepareAudioRoute`: ahize/hoparlör), ardından
 *     `AudioSession.startAudioSession()` — iOS ses yönlendirmesi ve arka
 *     plan sesi için, odaya bağlanmadan ÖNCE.
 *  3. Token.
 */
export function useVoiceToken(
  roomId: string | null | undefined,
  {
    needsCamera = false,
    defaultRoute = "speaker",
    callKitManaged = false,
  }: {
    needsCamera?: boolean;
    defaultRoute?: BuiltInRoute;
    /**
     * iOS DM araması CallKit'te: ses oturumunu sistem etkinleştirir
     * (`didActivate` → WebRTC). Kendimiz `setActive` çağırmak CallKit'in
     * oturumuyla çakışır; açma/kapama ona bırakılır.
     */
    callKitManaged?: boolean;
  } = {}
) {
  const profile = useAuth((s) => s.profile);
  const [result, setResult] = useState<{
    roomId: string;
    token: string | null;
    moderation: VoiceModerationState;
    voice: ChannelVoiceSettings | null;
    afk: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!roomId || !profile) return;

    let cancelled = false;
    let routeId: number | null = null;
    // Sesli kanaldayken DM araması gibi iç içe oturumlarda yerel ses
    // oturumu yalnızca SON oturum kapanınca durur.
    const stopIfLast = () => {
      if (callKitManaged) return;
      if (!hasActiveAudioSessions()) void AudioSession.stopAudioSession().catch(() => {});
    };

    (async () => {
      try {
        if (!(await ensureMicrophonePermission())) {
          throw new MicrophoneDeniedError();
        }
        if (needsCamera && !(await ensureCameraPermission())) {
          throw new CameraDeniedError();
        }
        if (cancelled) return;
        // Çıkış tercihi oturum açılmadan verilmeli; Android sonradan yok sayar.
        const id = await prepareAudioRoute(defaultRoute);
        // Hazırlık sürerken ekran kapandıysa temizlik bu kaydı göremedi.
        if (cancelled) {
          releaseAudioRoute(id);
          return;
        }
        routeId = id;
        if (!callKitManaged) await AudioSession.startAudioSession();
        const issued = await fetchRoomToken(roomId, profile.username);
        if (!cancelled) {
          setResult({ roomId, token: issued.token, moderation: issued.moderation, voice: issued.voice, afk: issued.afk, error: null });
        }
      } catch (err) {
        if (cancelled) return;
        setResult({ roomId, token: null, moderation: NO_VOICE_MODERATION, voice: null, afk: false, error: describeError(err) });
        if (routeId !== null) releaseAudioRoute(routeId);
        routeId = null;
        stopIfLast();
      }
    })();

    return () => {
      cancelled = true;
      if (routeId !== null) releaseAudioRoute(routeId);
      routeId = null;
      stopIfLast();
    };
  }, [roomId, profile, needsCamera, defaultRoute, callKitManaged]);

  if (result && result.roomId === roomId) {
    return { token: result.token, moderation: result.moderation, voice: result.voice, afk: result.afk, error: result.error };
  }
  return { token: null, moderation: NO_VOICE_MODERATION, voice: null, afk: false, error: null };
}

/** Kullanıcı mikrofon iznini reddetti — sunucu hatasından ayrı ele alınır. */
export class MicrophoneDeniedError extends Error {
  constructor() {
    super("Mikrofon izni verilmedi");
    this.name = "MicrophoneDeniedError";
  }
}

export class CameraDeniedError extends Error {
  constructor() {
    super("Kamera izni verilmedi");
    this.name = "CameraDeniedError";
  }
}

function describeError(err: unknown): string {
  if (err instanceof MicrophoneDeniedError) {
    return "Konuşabilmek için mikrofon izni gerekiyor. Ayarlar → Uygulamalar → Ciklet üzerinden verebilirsin.";
  }
  if (err instanceof CameraDeniedError) {
    return "Görüntülü görüşme için kamera izni gerekiyor. Ayarlar → Uygulamalar → Ciklet üzerinden verebilirsin.";
  }
  if (err instanceof ApiError) {
    // Kullanıcı sınırı dolu (web api/livekit `channel_full`): sunucunun metni.
    if (err.code === CHANNEL_FULL_CODE) return err.message;
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

/** Android çalışma zamanı kamera izni; LiveKit bunu uygulama adına istemez. */
export async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(permission)) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: "Kamera izni",
    message: "Görüntülü görüşmeler için kamera erişimi gerekir.",
    buttonPositive: "İzin ver",
    buttonNegative: "Vazgeç",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
