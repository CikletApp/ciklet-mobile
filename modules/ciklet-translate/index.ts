import { type NativeModule, requireOptionalNativeModule } from "expo";

/**
 * Cihaz üstü mesaj çevirisi — yerel modül.
 *
 *  - Android: Google ML Kit Translation + Language ID (Apache 2.0); dil
 *    modelleri ilk kullanımda cihaza iner. Kotlin: android/src/main/java/
 *    expo/modules/ciklettranslate.
 *  - iOS 18+: Apple Translation + NaturalLanguage. Swift: ios/.
 *
 * Mesaj içeriği hiçbir sunucuya gitmez. Modülsüz (eski) derlemede ve iOS
 * 18 altında `isSupported()` yanlış — menüde "Bu cihazda çeviri
 * desteklenmiyor" görünür.
 */
declare class CikletTranslateModule extends NativeModule<Record<string, never>> {
  isSupported(): boolean;
  /** BCP 47 dil kodu; emin değilse null. */
  detectLanguage(text: string): Promise<string | null>;
  /** Hata kodları: ERR_UNAVAILABLE (dil çifti yok), ERR_UNSUPPORTED, ERR_TRANSLATE. */
  translate(text: string, source: string, target: string): Promise<string>;
}

export const CikletTranslate = requireOptionalNativeModule<CikletTranslateModule>("CikletTranslate");
