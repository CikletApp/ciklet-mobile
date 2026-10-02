package expo.modules.cikletcalls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL

/**
 * Gelen arama bildirimindeki "Reddet" eylemi.
 *
 * Uygulama süreci ÖLÜYKEN de çalışır: bildirimi düşürür, zili keser ve
 * sunucuya (push'un taşıdığı tek kullanımlık `declineUrl` ile) reddi iletir.
 * Süreç yaşıyorsa JS tarafına da olay gönderilir; asıl ret isteğini o atar
 * (oturum çerezi yalnızca JS'te), `declineUrl` yoksa sunucu süre sonunda
 * daveti kendisi düşürür.
 */
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return
    val declineUrl = intent.getStringExtra(EXTRA_DECLINE_URL)

    IncomingCallNotifier.dismiss(context, callId)

    val listener = CikletCallsModule.actionListener
    if (listener != null) {
      listener("decline", callId)
      return
    }

    if (declineUrl.isNullOrBlank()) return
    val pending = goAsync()
    Thread {
      try {
        val connection = URL(declineUrl).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write("{}".toByteArray()) }
        val code = connection.responseCode
        if (code >= 400) Log.w(TAG, "decline url responded $code")
        connection.disconnect()
      } catch (error: Exception) {
        Log.w(TAG, "decline url failed: ${error.message}")
      } finally {
        pending.finish()
      }
    }.start()
  }

  companion object {
    const val TAG = "CikletCalls"
    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_DECLINE_URL = "declineUrl"
  }
}
