package expo.modules.cikletdownloads

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Ek indirme — dosyayı hiçbir seçici göstermeden "İndirilenler/Ciklet"e yazar.
 *
 * Android 10 (API 29) ile gelen MediaStore.Downloads koleksiyonu, uygulamanın
 * kendi eklediği dosyalar için İZİN İSTEMİYOR. Sistem klasör seçicisi (SAF)
 * ise İndirilenler'in kökünü gizlilik gerekçesiyle seçtirmiyordu; kullanıcı
 * ilk indirmede alt klasör oluşturmak zorunda kalıyordu.
 *
 * Daha eski sürümlerde (API 24–28) bu yol yok; JS tarafı klasör seçiciye düşer.
 */
class CikletDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CikletDownloads")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    }

    AsyncFunction("saveToDownloads") { sourceUri: String, fileName: String, mimeType: String? ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw CodedException("MediaStore.Downloads bu Android sürümünde yok.")
      }
      val context = appContext.reactContext ?: throw CodedException("Uygulama bağlamı yok.")
      val resolver = context.contentResolver

      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        if (!mimeType.isNullOrBlank()) put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/Ciklet")
        // Yazma bitene kadar galeride/dosyalarda yarım dosya görünmesin.
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val target = resolver.insert(collection, values)
        ?: throw CodedException("İndirilenler'e kayıt açılamadı.")

      try {
        val source = Uri.parse(sourceUri)
        val input = if (source.scheme == "file" || source.scheme == null) {
          File(source.path ?: sourceUri).inputStream()
        } else {
          resolver.openInputStream(source) ?: throw CodedException("Kaynak dosya açılamadı.")
        }
        input.use { from ->
          val output = resolver.openOutputStream(target) ?: throw CodedException("Hedef dosya açılamadı.")
          output.use { to -> from.copyTo(to) }
        }
        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(target, values, null, null)
      } catch (error: Exception) {
        // Yarım kalan kayıt İndirilenler'de boş bir dosya olarak kalmasın.
        resolver.delete(target, null, null)
        throw error
      }

      target.toString()
    }
  }
}
