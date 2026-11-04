/**
 * Canlı altyazı — mobil konuşma tanıyıcısı (expo-speech-recognition, MIT).
 * Web karşılığı: ciklet-web src/lib/live-captions/web-speech.ts (aynı arayüz).
 *
 * Yalnızca KULLANICININ KENDİ mikrofonunu dinler. Cihaz üstü tanıma varsa
 * (`requiresOnDeviceRecognition`; iOS 13+ çoğu dil, Android 13+ Google
 * Asistan dil paketleri) o kullanılır; yoksa platformun tanıma hizmeti —
 * ses kullanıcının cihazından Apple/Google'a gider, Ciklet sunucularına
 * hiç gitmez (arayüz bunu söyler).
 *
 * Arama sürerken mikrofonu WebRTC (LiveKit) de kullanıyor: iOS'ta ses
 * oturumu playAndRecord + voiceChat + mixWithOthers verilir ki görüşme
 * kesilmesin. Eşzamanlı yakalamanın gerçek cihazdaki davranışı EAS
 * derlemesinde doğrulanmalı.
 */
import { Platform } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export type CaptionerError = "unsupported" | "denied" | "error";

export function nativeSpeechSupported(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export interface CaptionerOptions {
  lang: string;
  onResult: (text: string, final: boolean) => void;
  onError: (error: CaptionerError) => void;
  onMode?: (onDevice: boolean) => void;
}

const MAX_RESTARTS = 12;
const RESTART_WINDOW_MS = 60_000;

type Subscription = { remove: () => void };

export class NativeSpeechCaptioner {
  private active = false;
  private subscriptions: Subscription[] = [];
  private restarts: number[] = [];
  private onDevice = false;

  constructor(private readonly options: CaptionerOptions) {}

  async start(): Promise<void> {
    if (!nativeSpeechSupported()) {
      this.options.onError("unsupported");
      return;
    }
    this.active = true;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        this.active = false;
        this.options.onError("denied");
        return;
      }
    } catch {
      this.active = false;
      this.options.onError("denied");
      return;
    }
    if (!this.active) return;

    try {
      this.onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      if (this.onDevice && Platform.OS === "android") {
        // Android: dil paketi cihazda kurulu değilse cihaz üstü istek hata verir.
        const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
        const base = this.options.lang.toLowerCase();
        this.onDevice = installedLocales.some((tag) => tag.toLowerCase() === base);
      }
    } catch {
      this.onDevice = false;
    }
    if (!this.active) return;
    this.options.onMode?.(this.onDevice);

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("result", (event) => {
        const text = event.results[0]?.transcript ?? "";
        if (text) this.options.onResult(text, event.isFinal);
      }),
      ExpoSpeechRecognitionModule.addListener("error", (event) => {
        const error = event.error;
        if (error === "no-speech" || error === "aborted" || error === "speech-timeout") return;
        this.stop();
        this.options.onError(
          error === "not-allowed" || error === "service-not-allowed"
            ? "denied"
            : error === "language-not-supported"
              ? "unsupported"
              : "error",
        );
      }),
      ExpoSpeechRecognitionModule.addListener("end", () => {
        if (!this.active) return;
        const now = Date.now();
        this.restarts = this.restarts.filter((t) => now - t < RESTART_WINDOW_MS);
        if (this.restarts.length >= MAX_RESTARTS) {
          this.stop();
          this.options.onError("error");
          return;
        }
        this.restarts.push(now);
        this.begin();
      }),
    );
    this.begin();
  }

  private begin(): void {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: this.options.lang,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: this.onDevice,
        addsPunctuation: true,
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth", "mixWithOthers"],
          mode: "voiceChat",
        },
      });
    } catch {
      this.stop();
      this.options.onError("error");
    }
  }

  stop(): void {
    const wasActive = this.active;
    this.active = false;
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    if (wasActive) {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* zaten durmuş */
      }
    }
  }
}
