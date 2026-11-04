import { VideoPreset, VideoPresets, ScreenSharePresets } from "livekit-client";
import { create } from "zustand";

import { useMentolPlan, type MentolPlan } from "@/api/hooks/use-settings";
import { queryClient } from "@/api/query-client";
import { effectiveStreamQuality, streamQualityOption, type StreamQuality } from "@/lib/stream-quality";
import { usePreferences } from "@/stores/preferences";

/**
 * Yayın kalitesinin görüşmede uygulanması — web `unified-control-bar`
 * ile aynı kural: Ayarlar → Ses ve Video'daki seçim, Mentol planının tavanı
 * ile (sunucu ses kanalında) Takviye seviyesinin tavanının büyüğüne kırpılır.
 * Takviye tavanı token yanıtından gelir, bağlıyken oda metadata'sıyla
 * güncellenir (features/voice/live-voice-settings); DM aramasında yok.
 */
interface CallStreamQualityState {
  boostMax: StreamQuality | null;
  setBoostMax: (value: StreamQuality | null) => void;
}

export const useCallStreamQuality = create<CallStreamQualityState>((set) => ({
  boostMax: null,
  setBoostMax: (boostMax) => set({ boostMax }),
}));

export function useEffectiveStreamQuality(): StreamQuality {
  const quality = usePreferences((s) => s.streamQuality);
  const boostMax = useCallStreamQuality((s) => s.boostMax);
  const plan = useMentolPlan().data?.plan ?? "FREE";
  return effectiveStreamQuality(quality, plan, boostMax);
}

/** Hook dışı (ör. DM aramasında görüntülüye geçiş): önbellekteki planla. */
export function currentStreamQuality(): StreamQuality {
  const plan = queryClient.getQueryData<MentolPlan>(["mentol-plan"])?.plan ?? "FREE";
  return effectiveStreamQuality(usePreferences.getState().streamQuality, plan, useCallStreamQuality.getState().boostMax);
}

/** Ekran paylaşımı ön ayarı (web `screenSharePreset`). */
export function screenSharePreset(quality: StreamQuality): VideoPreset {
  if (quality === "720p30") return ScreenSharePresets.h720fps30;
  if (quality === "1080p30") return ScreenSharePresets.h1080fps30;
  if (quality === "source") return ScreenSharePresets.original;
  const o = streamQualityOption(quality);
  return new VideoPreset(o.width, o.height, o.bitrate, o.fps);
}

/** Kamera ön ayarı: 720p kaliteleri 720p, üstü 1080p (web ile aynı). */
export function cameraPreset(quality: StreamQuality): VideoPreset {
  return quality === "720p30" || quality === "720p60" ? VideoPresets.h720 : VideoPresets.h1080;
}
