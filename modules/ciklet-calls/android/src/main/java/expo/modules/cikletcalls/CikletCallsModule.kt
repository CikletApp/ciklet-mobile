package expo.modules.cikletcalls

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * Gelen arama bildirimi (yalnızca Android). JS tarafı: modules/ciklet-calls/index.ts.
 *
 * Uygulama ön plandayken zil ekranını JS çizer; bu modül uygulama ARKA
 * PLANDA ya da KAPALIYKEN devreye girer (arka plan bildirim görevi
 * lib/notification-task.ts çağırır). "Cevapla" ve tam ekran açılış
 * `ciklet://call/incoming?...` derin bağlantısıyla uygulamayı açar;
 * "Reddet" CallActionReceiver'a düşer.
 */
class CikletCallsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CikletCalls")

    Events("onCallAction")

    OnCreate {
      actionListener = { action, callId ->
        sendEvent("onCallAction", mapOf("action" to action, "callId" to callId))
      }
    }

    OnDestroy {
      actionListener = null
      releaseProximityLock()
    }

    // Uygulama zaten açıkken bildirimden geldi (singleTask → onNewIntent).
    OnNewIntent { intent ->
      if (IncomingCallNotifier.isCallIntent(intent)) {
        appContext.currentActivity?.let { IncomingCallNotifier.applyLockScreenFlags(it, true) }
      }
    }

    // Soğuk açılış: etkinlik tam ekran niyetiyle yaratıldı.
    OnActivityEntersForeground {
      val activity = appContext.currentActivity
      if (activity != null && IncomingCallNotifier.isCallIntent(activity.intent)) {
        IncomingCallNotifier.applyLockScreenFlags(activity, true)
      }
    }

    Function("isSupported") { true }

    /** Android 14+: mağazadan kurulan "arama uygulaması olmayan" uygulamalarda kullanıcı onayı gerekir. */
    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= 34) {
        context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: true
      } else {
        true
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    AsyncFunction("showIncomingCall") { options: IncomingCallOptions ->
      if (options.callId.isBlank()) throw CodedException("callId gerekli.")
      IncomingCallNotifier.show(
        context,
        IncomingCall(
          callId = options.callId,
          callerName = options.callerName,
          callerAvatarUrl = options.callerAvatarUrl,
          video = options.video,
          directId = options.directId,
          expiresAt = options.expiresAt?.toLong(),
          declineUrl = options.declineUrl,
        ),
      )
    }

    Function("dismissIncomingCall") { callId: String? ->
      IncomingCallNotifier.dismiss(context, callId)
      appContext.currentActivity?.let { IncomingCallNotifier.applyLockScreenFlags(it, false) }
    }

    /** Süren görüşme ön plan hizmeti — arka planda ses/görüntü kesilmesin. */
    Function("startOngoingCall") { title: String, video: Boolean, callId: String ->
      OngoingCallService.start(context, title, video, callId)
    }

    Function("stopOngoingCall") {
      OngoingCallService.stop(context)
    }

    Function("setShowWhenLocked") { enabled: Boolean ->
      appContext.currentActivity?.let { IncomingCallNotifier.applyLockScreenFlags(it, enabled) }
    }

    /**
     * Yakınlık sensörü: sesli görüşmede ses ahizedeyken telefon kulağa
     * yaklaşınca ekran kararır (yanağın dokunuşu düğmeye basmasın). Telefon
     * uygulamalarının kullandığı PROXIMITY_SCREEN_OFF_WAKE_LOCK — ekranı
     * sistem kapatır/açar, sensörü uygulama okumaz.
     */
    Function("setProximityScreenOff") { enabled: Boolean ->
      if (enabled) acquireProximityLock() else releaseProximityLock()
    }
  }

  private var proximityLock: PowerManager.WakeLock? = null

  @Synchronized
  private fun acquireProximityLock() {
    if (proximityLock?.isHeld == true) return
    val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    if (!power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
    val lock = power.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "ciklet:call-proximity")
    lock.setReferenceCounted(false)
    // Üst sınır emniyet için: JS kapatmayı unutsa (süreç çökmesi vb.) kilit
    // sonsuza dek ekranı karartmaya hazır kalmasın.
    lock.acquire(PROXIMITY_MAX_MS)
    proximityLock = lock
  }

  @Synchronized
  private fun releaseProximityLock() {
    val lock = proximityLock ?: return
    proximityLock = null
    if (lock.isHeld) {
      // Telefon hâlâ kulaktaysa ekran ancak uzaklaşınca açılır — kulaktan
      // indirmeden yanlış dokunuş olmasın.
      lock.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("Uygulama bağlamı yok.")

  companion object {
    /** Yakınlık kilidinin en uzun ömrü (4 saat) — görüşmeden uzun. */
    private const val PROXIMITY_MAX_MS = 4L * 60 * 60 * 1000

    /** Reddet yayını → canlı JS'e olay (süreç yaşıyorsa). */
    @Volatile
    var actionListener: ((action: String, callId: String) -> Unit)? = null
  }
}

class IncomingCallOptions : Record {
  @Field val callId: String = ""
  @Field val callerName: String = ""
  @Field val callerAvatarUrl: String? = null
  @Field val video: Boolean = false
  @Field val directId: String? = null
  @Field val expiresAt: Double? = null
  @Field val declineUrl: String? = null
}
