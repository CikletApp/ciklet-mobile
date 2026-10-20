import { type NativeModule, requireOptionalNativeModule } from "expo";

/**
 * Yerel arama modülü — iki platformda farklı yüz:
 *
 *  - Android: gelen-arama bildirimi (tam ekran / CallStyle) ve süren
 *    görüşmenin ön plan hizmeti. Expo'nun bildirim API'sinde karşılık yok.
 *    Kotlin: android/src/main/java/expo/modules/cikletcalls.
 *  - iOS: CallKit + PushKit (VoIP push) — `CikletCallKitModule`. Swift:
 *    ios/. Gelen arama sistem arama ekranında çalar, görüşme kilit ekranında
 *    ve uygulama değiştiricide sistem göstergesiyle sürer.
 *
 * Modülsüz derlemede `null` — çağıran uygulama içi zil ekranına düşer.
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
   * Yakınlık sensörü (iki platform): sesli görüşmede ahizedeyken telefon
   * yüze yaklaşınca ekran kararır. Eski derlemede yoktur — çağıran denetler.
   */
  setProximityScreenOff?(enabled: boolean): void;
}

// ── iOS: CallKit + PushKit ───────────────────────────────────────────────

/** VoIP push yükünden ya da JS'ten bildirilen gelen arama (hepsi isteğe bağlı dize). */
export interface NativeIncomingCall {
  callId: string;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  callType?: string;
  directId?: string;
  declineUrl?: string;
  /** epoch ms */
  expiresAt?: number;
}

export interface NativeActiveCall extends NativeIncomingCall {
  key: string;
  incoming: boolean;
  answered: boolean;
  connected: boolean;
}

/**
 * CallKit eylemleri (kullanıcı sistem arayüzünde bir şey yaptı):
 *  - accept: Cevapla (yük gelen aramanın bilgisini taşır)
 *  - decline: çalarken Reddet; `handled` true ise ret yerelden
 *    (`declineUrl`) gönderildi, JS yalnızca yerelde kapatır
 *  - hangup: bağlı/giden görüşme sistemden bitirildi
 *  - mute / unmute: sistemdeki sessiz düğmesi
 *  - ended: çalan arama süre dolunca ya da "bitti" push'uyla kapandı
 *  - rejected: sistem çağrıyı kabul etmedi (Rahatsız Etmeyin vb.)
 */
export type CallKitAction = "accept" | "decline" | "hangup" | "mute" | "unmute" | "ended" | "rejected";

export type CallKitActionEvent = NativeIncomingCall & { action: CallKitAction; handled?: boolean };

export type CallKitEndReason = "local" | "remote" | "elsewhere" | "declined-elsewhere" | "unanswered" | "failed";

/**
 * Telefon uygulamasının Son Aramalar listesinden (ya da Siri'den) geri arama
 * isteği (INStartCallIntent). `peerId` CallKit tanıtıcısı = profil kimliği.
 */
export interface StartCallRequest {
  peerId: string;
  name?: string;
  video: boolean;
}

export type CallKitPendingEvent =
  | { name: "onIncomingCall"; body: NativeIncomingCall }
  | { name: "onCallAction"; body: CallKitActionEvent }
  | { name: "onVoipToken"; body: { token: string | null } }
  | { name: "onStartCallRequest"; body: StartCallRequest };

type CikletCallKitEvents = {
  onVoipToken: (event: { token: string | null }) => void;
  onIncomingCall: (event: NativeIncomingCall) => void;
  onCallAction: (event: CallKitActionEvent) => void;
  onStartCallRequest: (event: StartCallRequest) => void;
};

export declare class CikletCallKitModule extends NativeModule<CikletCallKitEvents> {
  isSupported(): boolean;
  isCallKitSupported(): boolean;
  getApsEnvironment(): "development" | "production";
  getVoipToken(): Promise<string | null>;
  /** Dinleyiciler kurulduktan SONRA: JS yokken biriken olaylar; sonrakiler doğrudan gelir. */
  takePendingEvents(): Promise<CallKitPendingEvent[]>;
  stopListening(): Promise<void>;
  getActiveCalls(): Promise<NativeActiveCall[]>;
  /** Aynı callId zaten bildirildiyse (VoIP push) bir şey yapmaz. */
  reportIncomingCall(info: NativeIncomingCall): Promise<void>;
  /** `peerId`: CallKit tanıtıcısı (Son Aramalar'dan geri arama bununla gelir). */
  startOutgoingCall(key: string, name: string, video: boolean, peerId: string): Promise<void>;
  reportConnected(key: string): Promise<void>;
  endCall(key: string, reason: CallKitEndReason): Promise<void>;
  setMuted(key: string, muted: boolean): Promise<void>;
}

const native = requireOptionalNativeModule<CikletCallsModule & CikletCallKitModule>("CikletCalls");

export default native as CikletCallsModule | null;

/** Aynı yerel modülün iOS yüzü; tür ayrımı yalnızca çağıran tarafı korur. */
export const CikletCallKit = native as CikletCallKitModule | null;
