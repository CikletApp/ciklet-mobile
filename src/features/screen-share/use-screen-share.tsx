import { useCallback, useRef, useState, type ReactNode } from "react";
import { findNodeHandle, NativeModules, Platform, View } from "react-native";
import { useLocalParticipant, useLocalParticipantPermissions } from "@livekit/react-native";
import { ScreenCapturePickerView } from "@livekit/react-native-webrtc";
import { ScreenSharePresets, Track } from "livekit-client";

import { showToast } from "@/components/ui";

/** `TrackSource.SCREEN_SHARE` (livekit_models.proto); @livekit/protocol doğrudan bağımlılık değil. */
const PROTO_SCREEN_SHARE = 3;

/**
 * Kendi ekranını paylaşma — LiveKit `Track.Source.ScreenShare`.
 *
 * ANDROID: `setScreenShareEnabled(true)` react-native-webrtc'nin
 * `getDisplayMedia`'sını çağırır; sistem MediaProjection izin penceresi
 * açılır, onaylanınca kütüphanenin `mediaProjection` türündeki ön plan
 * hizmeti kalıcı bildirimle başlar (izinler/bildirim metni:
 * plugins/with-screen-share.js). Sistem sesi paylaşılmaz: react-native-webrtc
 * AudioPlaybackCapture'ı desteklemiyor, yalnızca görüntü gider.
 *
 * iOS: ekran ReplayKit Broadcast Upload Extension'dan gelir. Uygulama
 * görünmez `ScreenCapturePickerView`'e dokunmuş gibi yapıp sistem yayın
 * seçicisini açar ve iz hemen yayınlanır; kareler kullanıcı "Yayını
 * Başlat"a basınca akar. Yayın Denetim Merkezi'nden durdurulunca eklenti
 * soketi kapatır, iz biter ve LiveKit onu kendiliğinden kaldırır.
 *
 * Döndürülen `picker` iOS'ta ağaçta olmak ZORUNDA (seçici o görünümden
 * açılıyor); Android'de `null`.
 *
 * Paylaşan kendi ekran izini HİÇBİR yerde çizmez — yansıma döngüsü
 * (ekranın ekranda sonsuz tekrarı) olur; bkz. {@link ScreenShareSelfCard}.
 */
export function useScreenShare(): {
  /** Bu odada ekran paylaşma izni var mı (yayın izni + kaynak kısıtı). */
  canShare: boolean;
  sharing: boolean;
  busy: boolean;
  toggle: () => Promise<void>;
  stop: () => Promise<void>;
  picker: ReactNode;
} {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const permissions = useLocalParticipantPermissions();
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef(null);

  // `canPublishSources` boşsa her kaynak serbest (LiveKit kuralı).
  const sources = permissions?.canPublishSources ?? [];
  const canShare =
    permissions?.canPublish === true && (sources.length === 0 || sources.some((source) => Number(source) === PROTO_SCREEN_SHARE));

  const start = useCallback(async () => {
    if (Platform.OS === "ios") {
      const tag = findNodeHandle(pickerRef.current);
      const manager = NativeModules.ScreenCapturePickerViewManager as { show?: (tag: number) => void } | undefined;
      if (tag == null || !manager?.show) {
        showToast("Ekran paylaşımı bu cihazda açılamadı.");
        return;
      }
      manager.show(tag);
    }
    await localParticipant.setScreenShareEnabled(
      true,
      { audio: false },
      { screenShareEncoding: ScreenSharePresets.h1080fps15.encoding }
    );
  }, [localParticipant]);

  const stop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch {
      // İz zaten bitmiş olabilir (yayın sistemden durduruldu).
    } finally {
      setBusy(false);
    }
  }, [busy, localParticipant]);

  const toggle = useCallback(async () => {
    if (busy) return;
    if (isScreenShareEnabled) {
      await stop();
      return;
    }
    if (!canShare) {
      showToast("Bu kanalda ekran paylaşma iznin yok.");
      return;
    }
    setBusy(true);
    try {
      await start();
    } catch (error) {
      // Kullanıcı sistem izin penceresinde "İptal"e bastı: sessizce geç.
      const name = (error as { name?: string; message?: string } | undefined)?.name ?? "";
      const message = (error as { message?: string } | undefined)?.message ?? "";
      if (name !== "NotAllowedError" && !message.includes("NotAllowedError")) {
        showToast("Ekran paylaşımı başlatılamadı.");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, isScreenShareEnabled, canShare, start, stop]);

  const picker =
    Platform.OS === "ios" ? (
      // Görünmez: seçici kendi düğmesine programla "dokunularak" açılıyor.
      <View pointerEvents="none" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>
        <ScreenCapturePickerView ref={pickerRef} />
      </View>
    ) : null;

  return { canShare, sharing: isScreenShareEnabled, busy, toggle, stop, picker };
}

/** Kendi ekran izi mi — çizilmemeli (yansıma döngüsü). */
export function isOwnScreenShare(ref: { participant: { isLocal: boolean }; source: Track.Source }) {
  return ref.participant.isLocal && ref.source === Track.Source.ScreenShare;
}
