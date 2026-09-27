import { requireOptionalNativeModule } from "expo";

/**
 * Yerel indirme modülü (yalnızca Android). iOS'ta ya da modülsüz derlemede
 * `null` — çağıran klasör seçiciye düşer.
 */
interface CikletDownloadsModule {
  isSupported(): boolean;
  /** Dosyayı "İndirilenler/Ciklet"e kopyalar; MediaStore adresini döner. */
  saveToDownloads(sourceUri: string, fileName: string, mimeType: string | null): Promise<string>;
}

export default requireOptionalNativeModule<CikletDownloadsModule>("CikletDownloads");
