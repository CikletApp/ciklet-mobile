package expo.modules.cikletcalls

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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

    Function("setShowWhenLocked") { enabled: Boolean ->
      appContext.currentActivity?.let { IncomingCallNotifier.applyLockScreenFlags(it, enabled) }
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("Uygulama bağlamı yok.")

  companion object {
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
