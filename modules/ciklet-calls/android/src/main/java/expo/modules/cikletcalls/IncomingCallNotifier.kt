package expo.modules.cikletcalls

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Shader
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import java.net.HttpURLConnection
import java.net.URL

/** JS'ten gelen gelen-arama bilgisi (bkz. modules/ciklet-calls/index.ts). */
data class IncomingCall(
  val callId: String,
  val callerName: String,
  val callerAvatarUrl: String?,
  val video: Boolean,
  val directId: String?,
  /** Davetin sunucu tarafındaki son geçerlilik anı (epoch ms). */
  val expiresAt: Long?,
  /** Tek kullanımlık ret adresi; süreç ölüyken "Reddet" bunu POST eder. */
  val declineUrl: String?,
)

/**
 * Gelen arama bildirimi — WhatsApp/Telegram ile aynı sistem mekanizması:
 *
 *  - `CallStyle` + `CATEGORY_CALL`: Cevapla/Reddet düğmeleri, kilit ekranında
 *    tam içerik.
 *  - `fullScreenIntent`: ekran kapalı/kilitliyken uygulama ZİL EKRANIYLA
 *    açılır; ekran açıkken üstte "heads-up" olarak düşer (sistem kuralı).
 *  - Kanal `ciklet-calls-v2` (JS ile aynı kimlik, zil sesi + zil ses
 *    özniteliği) ve `FLAG_INSISTENT`: zil bildirim düşene kadar döner.
 *  - `setTimeoutAfter`: davet süresi dolunca bildirim kendiliğinden gider.
 *
 * Aynı anda tek çağrı olabildiği için (stores/call.ts) tek bildirim kimliği
 * kullanılır; yenisi eskisini ezer.
 */
object IncomingCallNotifier {
  const val TAG = "CikletCalls"
  const val CHANNEL_ID = "ciklet-calls-v2"
  private const val NOTIFICATION_TAG = "ciklet-incoming-call"
  private const val NOTIFICATION_ID = 0x0CA11
  private const val SCHEME = "ciklet"
  private const val HOST = "call"
  private const val DEFAULT_TIMEOUT_MS = 45_000L

  private val VIBRATION = longArrayOf(0, 600, 400, 600, 400, 600, 400, 600)

  fun show(context: Context, call: IncomingCall) {
    ensureChannel(context)

    val showIntent = activityIntent(context, call, "show", 1)
    val answerIntent = activityIntent(context, call, "accept", 2)
    val declineIntent = PendingIntent.getBroadcast(
      context,
      3,
      Intent(context, CallActionReceiver::class.java)
        .setAction("expo.modules.cikletcalls.DECLINE")
        .putExtra(CallActionReceiver.EXTRA_CALL_ID, call.callId)
        .putExtra(CallActionReceiver.EXTRA_DECLINE_URL, call.declineUrl),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val caller = Person.Builder()
      .setName(call.callerName.ifBlank { "Ciklet" })
      .setImportant(true)
      .apply { loadAvatar(call.callerAvatarUrl)?.let { setIcon(it) } }
      .build()

    val now = System.currentTimeMillis()
    val timeout = (call.expiresAt?.let { it - now } ?: DEFAULT_TIMEOUT_MS).coerceIn(10_000L, 90_000L)

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(call.callerName)
      .setContentText(if (call.video) "Görüntülü arıyor…" else "Sesli arıyor…")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(false)
      .setShowWhen(false)
      .setContentIntent(showIntent)
      .setFullScreenIntent(showIntent, true)
      .setTimeoutAfter(timeout)
      // Android 8 öncesi kanal yok; ses ve titreşim bildirimin kendisinde.
      .setSound(ringtoneUri(context), AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
      .setVibrate(VIBRATION)
      .setStyle(
        NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent)
          .setIsVideo(call.video),
      )

    val notification = builder.build()
    notification.flags = notification.flags or Notification.FLAG_INSISTENT

    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_TAG, NOTIFICATION_ID, notification)
    } catch (error: SecurityException) {
      // POST_NOTIFICATIONS verilmemiş: sessizce geç, uygulama içi zil çalışır.
      Log.w(TAG, "notification permission missing: ${error.message}")
    }
  }

  fun dismiss(context: Context, @Suppress("UNUSED_PARAMETER") callId: String?) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, NOTIFICATION_ID)
  }

  /** `ciklet://call/...` ile mi açıldı? Kilit ekranı üstünde gösterme kararı buna bağlı. */
  fun isCallIntent(intent: Intent?): Boolean {
    val data = intent?.data ?: return false
    return data.scheme == SCHEME && data.host == HOST
  }

  /**
   * Kilit ekranı üstünde göster + ekranı aç. Yalnızca çağrı akışında açılır
   * ve çağrı bitince kapatılır; sürekli açık kalsaydı kilitliyken dokunulan
   * HER bildirim uygulamayı kilit çözmeden gösterirdi.
   */
  fun applyLockScreenFlags(activity: Activity, enabled: Boolean) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(enabled)
        activity.setTurnScreenOn(enabled)
      } else {
        @Suppress("DEPRECATION")
        val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        if (enabled) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
      }
    }
  }

  private fun activityIntent(context: Context, call: IncomingCall, action: String, requestCode: Int): PendingIntent {
    val uri = Uri.Builder()
      .scheme(SCHEME)
      .authority(HOST)
      .appendPath("incoming")
      .appendQueryParameter("callId", call.callId)
      .appendQueryParameter("action", action)
      .apply { call.directId?.let { appendQueryParameter("directId", it) } }
      .build()
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Kanal JS tarafında kuruluyor; süreç ölüyken ilk push kanaldan önce gelebilir. */
  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Aramalar", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(
        ringtoneUri(context),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = VIBRATION
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  /** assets/sounds/ringtone.wav → res/raw/ringtone (expo-notifications eklentisi kopyalar). */
  private fun ringtoneUri(context: Context): Uri {
    val id = context.resources.getIdentifier("ringtone", "raw", context.packageName)
    return if (id != 0) {
      Uri.parse("android.resource://${context.packageName}/$id")
    } else {
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    }
  }

  private fun smallIcon(context: Context): Int {
    val custom = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (custom != 0) custom else context.applicationInfo.icon
  }

  /** Arayanın avatarı — 3 sn'de gelmezse vazgeçilir; bildirim avatarsız düşer. */
  private fun loadAvatar(url: String?): IconCompat? {
    if (url.isNullOrBlank() || !url.startsWith("http", ignoreCase = true)) return null
    return try {
      val connection = URL(url).openConnection() as HttpURLConnection
      connection.connectTimeout = 3000
      connection.readTimeout = 3000
      connection.instanceFollowRedirects = true
      val bitmap = connection.inputStream.use { BitmapFactory.decodeStream(it) }
      connection.disconnect()
      bitmap?.let { IconCompat.createWithBitmap(circleCrop(it, 192)) }
    } catch (error: Exception) {
      Log.w(TAG, "avatar load failed: ${error.message}")
      null
    }
  }

  private fun circleCrop(source: Bitmap, size: Int): Bitmap {
    val scaled = Bitmap.createScaledBitmap(source, size, size, true)
    val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
    }
    Canvas(output).drawCircle(size / 2f, size / 2f, size / 2f, paint)
    return output
  }
}
