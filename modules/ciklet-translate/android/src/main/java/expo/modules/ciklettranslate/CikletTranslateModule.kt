package expo.modules.ciklettranslate

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions
import com.google.mlkit.nl.languageid.LanguageIdentifier
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Cihaz üstü mesaj çevirisi (Android) — Google ML Kit Translation + Language ID
 * (Apache 2.0). Dil modelleri ilk kullanımda cihaza iner (~30 MB/dil); çeviri
 * ve algılama tamamen cihazda yapılır, mesaj içeriği hiçbir sunucuya gitmez.
 * JS tarafı: modules/ciklet-translate/index.ts, src/lib/translation/native.ts.
 *
 * Hata kodları JS'te TranslationError'a çevrilir:
 *  - ERR_UNAVAILABLE: dil çifti ML Kit'te yok (ör. Geleneksel Çince).
 *  - ERR_TRANSLATE: model indirilemedi / çeviri başarısız.
 */
class CikletTranslateModule : Module() {
  private val translators = mutableMapOf<String, Translator>()
  private var identifier: LanguageIdentifier? = null

  override fun definition() = ModuleDefinition {
    Name("CikletTranslate")

    Function("isSupported") { true }

    AsyncFunction("detectLanguage") { text: String, promise: Promise ->
      val client = identifier ?: LanguageIdentification.getClient(
        LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.4f).build()
      ).also { identifier = it }
      client.identifyLanguage(text)
        .addOnSuccessListener { tag -> promise.resolve(if (tag == "und") null else tag) }
        .addOnFailureListener { error -> promise.reject("ERR_DETECT", error.message, error) }
    }

    AsyncFunction("translate") { text: String, source: String, target: String, promise: Promise ->
      val from = TranslateLanguage.fromLanguageTag(source)
      val to = TranslateLanguage.fromLanguageTag(target)
      if (from == null || to == null) {
        promise.reject("ERR_UNAVAILABLE", "Dil çifti desteklenmiyor: $source → $target", null)
        return@AsyncFunction
      }
      val key = "$from>$to"
      val translator = synchronized(translators) {
        translators.getOrPut(key) {
          Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(from).setTargetLanguage(to).build())
        }
      }
      translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
        .continueWithTask { task ->
          if (!task.isSuccessful) throw task.exception ?: Exception("model indirilemedi")
          translator.translate(text)
        }
        .addOnSuccessListener { result -> promise.resolve(result) }
        .addOnFailureListener { error -> promise.reject("ERR_TRANSLATE", error.message, error) }
    }

    OnDestroy {
      synchronized(translators) {
        translators.values.forEach { it.close() }
        translators.clear()
      }
      identifier?.close()
      identifier = null
    }
  }
}
