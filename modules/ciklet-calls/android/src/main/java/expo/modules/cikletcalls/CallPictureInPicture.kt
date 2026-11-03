package expo.modules.cikletcalls

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.util.Rational
import androidx.annotation.RequiresApi
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import java.lang.ref.WeakReference

/**
 * Görüntülü görüşmenin resim içinde resim (PiP) penceresi — yalnızca Android.
 *
 * Görüşme ekranı açıkken JS `setAutoPictureInPicture(true, w, h)` çağırır;
 * kullanıcı uygulamadan çıkınca (Ana ekran / son uygulamalar) etkinlik
 * küçük pencereye geçer ve görüşme orada sürer (WhatsApp, Discord, Meet gibi):
 *  - Android 12+ (API 31): `setAutoEnterEnabled` — sistem geçişi kendisi
 *    yapar, animasyon kesintisiz.
 *  - Android 8–11 (API 26–30): `onUserLeaveHint` (Expo `OnUserLeavesActivity`)
 *    anında `enterPictureInPictureMode`.
 * Manifestte ana etkinliğe `android:supportsPictureInPicture="true"`
 * eklentiyle yazılır (plugins/with-call-pip.js); yoksa çağrılar sessizce
 * etkisiz kalır.
 *
 * Kip değişimi JS'e `onPictureInPictureChange` olayıyla bildirilir — PiP'te
 * pencere küçük olduğundan arayüz yalnızca ana görüntüyü çizer.
 */
internal object CallPictureInPicture {
  private const val TAG = "CikletCallPip"
  /** Android'in kabul ettiği en geniş / en dar oran (PictureInPictureParams). */
  private const val MAX_RATIO = 2.39

  @Volatile private var enabled = false
  @Volatile private var aspectWidth = 9
  @Volatile private var aspectHeight = 16
  @Volatile private var lastReported: Boolean? = null

  var listener: ((Boolean) -> Unit)? = null

  /** Zayıf başvuru: yeniden yaratılan etkinlik bellekte tutulmasın. */
  private var observed: WeakReference<OnPictureInPictureModeChangedProvider>? = null
  private val modeListener = Consumer<PictureInPictureModeChangedInfo> { info ->
    report(info.isInPictureInPictureMode)
  }

  fun isSupported(activity: Activity?): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity == null) return false
    return activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
  }

  fun isActive(activity: Activity?): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity == null) return false
    return activity.isInPictureInPictureMode
  }

  /** Etkinlik değiştiyse (yeniden yaratıldı) kip dinleyicisini yeni etkinliğe taşır. */
  fun observe(activity: Activity?) {
    val provider = activity as? OnPictureInPictureModeChangedProvider ?: return
    if (observed?.get() === provider) return
    observed?.get()?.removeOnPictureInPictureModeChangedListener(modeListener)
    provider.addOnPictureInPictureModeChangedListener(modeListener)
    observed = WeakReference(provider)
  }

  fun release() {
    observed?.get()?.removeOnPictureInPictureModeChangedListener(modeListener)
    observed = null
    listener = null
    lastReported = null
  }

  fun configure(activity: Activity?, enable: Boolean, width: Int, height: Int) {
    enabled = enable
    if (width > 0 && height > 0) {
      aspectWidth = width
      aspectHeight = height
    }
    observe(activity)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isSupported(activity) || activity == null) return
    // API 31+: sistem otomatik geçer. Daha eskide parametreler yine de
    // ayarlanır (oran), geçişi OnUserLeavesActivity yapar.
    try {
      activity.setPictureInPictureParams(params(enable))
    } catch (error: IllegalStateException) {
      // Manifestte supportsPictureInPicture yok (eski derleme).
      Log.w(TAG, "PiP parametreleri ayarlanamadı: ${error.message}")
    }
  }

  /** API 26–30: kullanıcı uygulamadan çıkarken çağrılır. */
  fun onUserLeave(activity: Activity?) {
    if (!enabled || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
    enter(activity)
  }

  fun enter(activity: Activity?): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isSupported(activity) || activity == null) return false
    if (activity.isInPictureInPictureMode) return false
    return try {
      activity.enterPictureInPictureMode(params(enabled))
    } catch (error: IllegalStateException) {
      Log.w(TAG, "PiP açılamadı: ${error.message}")
      false
    }
  }

  /** Dinleyicisi olmayan sürümler için: duraklama/sürdürmede kip yeniden okunur. */
  fun sync(activity: Activity?) {
    if (activity == null) return
    report(isActive(activity))
  }

  private fun report(active: Boolean) {
    if (lastReported == active) return
    lastReported = active
    listener?.invoke(active)
  }

  private fun ratio(): Rational {
    var w = aspectWidth.toDouble()
    var h = aspectHeight.toDouble()
    if (w / h > MAX_RATIO) w = h * MAX_RATIO
    if (h / w > MAX_RATIO) h = w * MAX_RATIO
    // Rational tam sayı ister; 1000 ölçeği yeterince hassas.
    return Rational((w * 1000).toInt().coerceAtLeast(1), (h * 1000).toInt().coerceAtLeast(1))
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun params(autoEnter: Boolean): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(ratio())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter)
      // Görüntü akışı için kesintisiz yeniden boyutlandırma kapalı (Google önerisi: video).
      builder.setSeamlessResizeEnabled(false)
    }
    return builder.build()
  }
}
