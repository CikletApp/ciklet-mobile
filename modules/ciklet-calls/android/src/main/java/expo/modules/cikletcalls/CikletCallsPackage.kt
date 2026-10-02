package expo.modules.cikletcalls

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/**
 * Etkinlik yaşam döngüsü dinleyicisi — kilit ekranı bayrakları `onCreate`
 * anında uygulanır.
 *
 * Tam ekran niyeti etkinliği başlattığında sistem "kilit üstünde göster /
 * ekranı aç" kararını pencere gösterilmeden verir. Bayraklar modülün
 * onResume kancasında uygulandığında yarış oluşuyor ve ekran bazen kapalı
 * kalıyordu; burada etkinlik yaratılır yaratılmaz uygulanır. Yalnızca
 * `ciklet://call/...` ile açılışta: bildirime dokunarak açılan sohbet kilit
 * çözülmeden GÖRÜNMEMELİ.
 */
class CikletCallsPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
    return listOf(CallActivityLifecycleListener())
  }
}

class CallActivityLifecycleListener : ReactActivityLifecycleListener {
  private var activityRef: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    activityRef = WeakReference(activity)
    if (IncomingCallNotifier.isCallIntent(activity.intent)) {
      IncomingCallNotifier.applyLockScreenFlags(activity, true)
    }
  }

  override fun onResume(activity: Activity) {
    activityRef = WeakReference(activity)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    if (IncomingCallNotifier.isCallIntent(intent)) {
      activityRef?.get()?.let { IncomingCallNotifier.applyLockScreenFlags(it, true) }
    }
    // Tüketilmedi: expo-router / dev-client bağlantıyı işlemeye devam eder.
    return false
  }
}
