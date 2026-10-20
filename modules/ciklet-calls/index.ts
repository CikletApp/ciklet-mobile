import { type NativeModule, requireOptionalNativeModule } from "expo";

/**
 * Yerel gelen-arama bildirimi (yalnızca Android). iOS'ta ya da modülsüz
 * derlemede `null` — çağıran yalnızca uygulama içi zil ekranına düşer.
 * iOS tarafı (ios/) yalnızca yakınlık sensörünü sağlar; gelen arama
 * işlevlerini JS Android'le sınırlar (`nativeIncomingCalls`).
 *
 * Tam ekran gelen arama için Expo'nun bildirim API'sinde karşılık yok
 * (fullScreenIntent / CallStyle); bu modül onu sağlar. Kotlin tarafı:
 * android/src/main/java/expo/modules/cikletcalls.
 */
export interface IncomingCallOptions {
  callId: string;
  callerName: string;
  /** MUTLAK adres (http/https); göreli yol ya da data: yok sayılır. */
  callerAvatarUrl?: string | null;
  video: boolean;
  directId?: string | null;
  /** Davetin son geçerlilik anı (epoch ms); bildirim o anda kendiliğinden düşer. */
  expiresAt?: number | null;
  /**
   * Tek kullanımlık ret adresi — süreç ölüyken "Reddet" buraya POST atar.
   * Sunucu henüz vermiyorsa boş bırakılır; bildirim yine düşer, davet süre
   * sonunda sunucuda kapanır.
   */
  declineUrl?: string | null;
}

export type CallActionEvent = { action: "decline" | "accept" | "show" | "hangup"; callId: string };

type CikletCallsEvents = {
  onCallAction: (event: CallActionEvent) => void;
};

declare class CikletCallsModule extends NativeModule<CikletCallsEvents> {
  isSupported(): boolean;
  /** Android 14+'ta tam ekran izni kullanıcı tarafından kapatılmış olabilir. */
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): void;
  showIncomingCall(options: IncomingCallOptions): Promise<void>;
  /** Bildirimi düşürür ve kilit ekranı bayraklarını kapatır. */
  dismissIncomingCall(callId?: string | null): void;
  setShowWhenLocked(enabled: boolean): void;
  /**
   * Süren görüşmenin ön plan hizmeti (mikrofon, görüntülüde kamera) — arka
   * plana geçince Android'in ses/görüntüyü kesip süreci öldürmesini önler.
   * Görüşme ÖN PLANDAYKEN başlatılmalı.
   */
  startOngoingCall(title: string, video: boolean, callId: string): void;
  stopOngoingCall(): void;
  /**
   * Yakınlık sensörüyle ekran karartma (Android: PROXIMITY_SCREEN_OFF_WAKE_LOCK,
   * iOS: UIDevice.isProximityMonitoringEnabled). Yalnızca sesli görüşmede,
   * ses ahizedeyken açılır. Eski derlemede işlev yok — çağıran denetler.
   */
  setProximityScreenOff?(enabled: boolean): void;
}

export default requireOptionalNativeModule<CikletCallsModule>("CikletCalls");
