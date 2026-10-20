package expo.modules.cikletcalls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Süren görüşmenin ön plan hizmeti (DM araması ve sesli kanal).
 *
 * NEDEN: Android 9+ arka plandaki uygulamanın mikrofonuna, 11+ kamerasına
 * erişimi keser; süreç de bir süre sonra önbelleğe atılıp öldürülür.
 * Kullanıcı görüşmedeyken başka uygulamaya geçince ses kesiliyor, görüşme
 * düşüyordu. `microphone` (görüntülüde ayrıca `camera`) türünde ön plan
 * hizmeti WhatsApp'taki gibi süren-arama bildirimiyle süreci ve yakalamayı
 * canlı tutar. Hizmet görüşme ÖN PLANDA başlarken açılır (Android 14 arka
 * plandan mikrofon türlü hizmet başlatmayı yasaklıyor).
 *
 * Bildirimdeki "Bitir" canlı JS'e `hangup` olayı gönderir; dokunmak
 * uygulamayı açar.
 */
class OngoingCallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_HANG_UP -> {
        CikletCallsModule.actionListener?.invoke("hangup", intent.getStringExtra(EXTRA_CALL_ID) ?: "")
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
    }

    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Görüşme"
    val video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
    val callId = intent?.getStringExtra(EXTRA_CALL_ID) ?: ""
    ensureChannel(this)

    val types = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      var t = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      if (video) t = t or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
      t
    } else {
      0
    }
    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(title, video, callId), types)
    } catch (error: Exception) {
      // Ör. Android 14'te arka plandan başlatma ya da eksik izin: görüşme
      // yine sürer, yalnızca arka planda korunmaz.
      Log.w(TAG, "ongoing call service failed: ${error.message}")
      stopSelf()
    }
    return START_NOT_STICKY
  }

  // Kullanıcı uygulamayı son uygulamalardan kaydırıp kapattı: görüşme
  // sahibi süreç gidiyor, bildirim asılı kalmasın.
  override fun onTaskRemoved(rootIntent: Intent?) {
    CikletCallsModule.actionListener?.invoke("hangup", "")
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  private fun buildNotification(title: String, video: Boolean, callId: String): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    }
    val contentIntent = open?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val hangUp = PendingIntent.getService(
      this,
      1,
      Intent(this, OngoingCallService::class.java).setAction(ACTION_HANG_UP).putExtra(EXTRA_CALL_ID, callId),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val person = Person.Builder().setName(title).setImportant(true).build()
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(IncomingCallNotifier.smallIcon(this))
      .setContentTitle(title)
      .setContentText(if (video) "Görüntülü görüşme sürüyor" else "Sesli görüşme sürüyor")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      .setWhen(System.currentTimeMillis())
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setContentIntent(contentIntent)
      .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  companion object {
    const val TAG = "CikletCalls"
    const val CHANNEL_ID = "ciklet-ongoing-call"
    const val NOTIFICATION_ID = 7341
    const val ACTION_HANG_UP = "expo.modules.cikletcalls.HANG_UP"
    const val ACTION_STOP = "expo.modules.cikletcalls.STOP_ONGOING"
    const val EXTRA_TITLE = "title"
    const val EXTRA_VIDEO = "video"
    const val EXTRA_CALL_ID = "callId"

    fun start(context: Context, title: String, video: Boolean, callId: String) {
      val intent = Intent(context, OngoingCallService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_VIDEO, video)
        .putExtra(EXTRA_CALL_ID, callId)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, OngoingCallService::class.java))
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java) ?: return
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      // Düşük önem: sessiz, titreşimsiz; yalnızca süren görüşmeyi gösterir.
      val channel = NotificationChannel(CHANNEL_ID, "Süren görüşme", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
  }
}
