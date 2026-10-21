import { type NativeModule, requireOptionalNativeModule } from "expo";

/**
 * Yerel medya oturumu modülü (yalnızca Android) — telefonda çalan müziği /
 * videoyu (Spotify, YouTube Music, YouTube…) okur. Kotlin:
 * android/src/main/java/expo/modules/cikletmedia.
 *
 * Android başka uygulamaların medya oturumlarını yalnızca "Bildirim erişimi"
 * verilmiş uygulamaya açıyor; modül bu izin için boş bir bildirim dinleyicisi
 * taşır ve bildirimleri OKUMAZ.
 *
 * iOS'ta `null`: Apple başka uygulamaların "şu an çalan" bilgisini üçüncü
 * taraf uygulamalara vermiyor (MPNowPlayingInfoCenter yalnızca kendi
 * oturumunu yazar). Modülsüz (eski) Android derlemesinde de `null`.
 */
export interface NativeMediaSession {
  /** Kaynak uygulamanın paket adı (com.spotify.music). */
  packageName: string;
  /** Sistemdeki uygulama adı; paket görünürlüğü dışındaysa null. */
  appName: string | null;
  /** ApplicationInfo.category (Android 8+): "audio" | "video" | "game" ya da null. */
  appCategory: "audio" | "video" | "game" | null;
  title: string;
  artist: string | null;
  album: string | null;
  /** 0 = bilinmiyor (canlı yayın, bazı uygulamalar). */
  durationMs: number;
  positionMs: number;
  playing: boolean;
  /** En çok 256 px JPEG, base64 (önek yok); kapak yoksa null. */
  artworkBase64: string | null;
}

export type MediaChangeEvent = { media: NativeMediaSession | null };

type CikletMediaEvents = {
  onMediaChange: (event: MediaChangeEvent) => void;
};

declare class CikletMediaModule extends NativeModule<CikletMediaEvents> {
  isSupported(): boolean;
  /** Ayarlar → Bildirim erişimi'nde Ciklet açık mı? */
  isPermissionGranted(): boolean;
  /** Sistem "Bildirim erişimi" ekranını açar. */
  openPermissionSettings(): void;
  /** İzin yoksa false döner; varsa dinlemeye başlar ve güncel durumu yollar. */
  start(): Promise<boolean>;
  stop(): Promise<void>;
  getCurrent(): Promise<NativeMediaSession | null>;
}

export default requireOptionalNativeModule<CikletMediaModule>("CikletMedia");
