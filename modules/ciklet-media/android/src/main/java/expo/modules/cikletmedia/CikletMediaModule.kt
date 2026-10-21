package expo.modules.cikletmedia

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * "Şu an dinlediği" — telefonda çalan medyayı (Spotify, YouTube Music,
 * YouTube…) JS'e bildirir; JS bunu masaüstüyle aynı rich presence biçimine
 * çevirip ağ geçidine yollar (src/features/presence/media-activity.ts).
 *
 * Yol: kullanıcı "Bildirim erişimi" verir (CikletMediaListenerService) →
 * MediaSessionManager.getActiveSessions ile etkin oturumlar alınır → her
 * oturumun MediaController.Callback'i dinlenir. Bildirim içerikleri hiç
 * okunmaz.
 *
 * Olay: `onMediaChange` → `{ media: {...} | null }`. Yalnızca ÇALAN oturum
 * bildirilir; duraklatılınca / kapanınca `media: null`. Aynı içerik (parça +
 * konum kovası) tekrar gönderilmez.
 *
 * İş parçacığı: oturum listesi ve geri çağrılar ana iş parçacığında
 * (handler); JS'ten gelen start/stop/getCurrent da `Queues.MAIN`'de koşar,
 * böylece `tracked` listesine tek bir iş parçacığı dokunur.
 */
class CikletMediaModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var manager: MediaSessionManager? = null
  private var sessionsListener: MediaSessionManager.OnActiveSessionsChangedListener? = null
  private val tracked = mutableListOf<Pair<MediaController, MediaController.Callback>>()
  private var running = false
  private var lastKey: String? = null

  /** Son kodlanan kapak — aynı parça için her olayda yeniden JPEG'e çevrilmesin. */
  private var artworkKey: String? = null
  private var artworkData: String? = null

  /** Paket → (etiket, kategori). Etiket sorgusu ucuz değil; oturum boyunca sabit. */
  private val appInfoCache = mutableMapOf<String, Pair<String?, String?>>()

  private val publishRunnable = Runnable { publish() }

  private val context: Context?
    get() = appContext.reactContext?.applicationContext

  override fun definition() = ModuleDefinition {
    Name("CikletMedia")

    Events("onMediaChange")

    OnDestroy {
      handler.post { stopTracking() }
    }

    Function("isSupported") { true }

    /** Kullanıcı Ayarlar → Bildirim erişimi'nde Ciklet'i açtı mı? */
    Function("isPermissionGranted") {
      context?.let { hasAccess(it) } ?: false
    }

    Function("openPermissionSettings") {
      openSettings()
    }

    /** İzin yoksa false; varsa dinlemeye başlar (zaten başlamışsa durumu yeniden yollar). */
    AsyncFunction("start") {
      startTracking()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      stopTracking()
    }.runOnQueue(Queues.MAIN)

    /** Şu an çalan medya (olay beklemeden); yoksa null. */
    AsyncFunction("getCurrent") {
      val ctx = context
      if (ctx == null || !running) null else currentPayload(ctx)
    }.runOnQueue(Queues.MAIN)
  }

  // ── İzin ──────────────────────────────────────────────────────────────

  private fun listenerComponent(ctx: Context) =
    ComponentName(ctx, CikletMediaListenerService::class.java)

  /**
   * NotificationManagerCompat.getEnabledListenerPackages ile aynı kaynak;
   * androidx bağımlılığı eklememek için doğrudan okunuyor.
   */
  private fun hasAccess(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners")
      ?: return false
    val mine = listenerComponent(ctx)
    return flat.split(":").any { entry ->
      entry.isNotBlank() && ComponentName.unflattenFromString(entry) == mine
    }
  }

  private fun openSettings() {
    val activity = appContext.currentActivity
    val starter: Context = activity ?: context ?: return
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      starter.startActivity(intent)
    } catch (ignored: Exception) {
      // Bazı üretici ROM'larında ekran yok: uygulama ayrıntılarına düş.
      try {
        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(android.net.Uri.parse("package:${starter.packageName}"))
        if (activity == null) fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        starter.startActivity(fallback)
      } catch (ignored: Exception) {
      }
    }
  }

  // ── Takip ─────────────────────────────────────────────────────────────

  private fun startTracking(): Boolean {
    val ctx = context ?: return false
    if (!hasAccess(ctx)) {
      stopTracking()
      return false
    }
    if (running) {
      // Ön plana dönüş: JS bağlantısı yenilenmiş olabilir, durum yeniden gitsin.
      lastKey = null
      schedulePublish(0)
      return true
    }
    val mgr = ctx.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager
      ?: return false
    val component = listenerComponent(ctx)
    val listener = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
      track(controllers ?: emptyList())
    }
    try {
      mgr.addOnActiveSessionsChangedListener(listener, component, handler)
      manager = mgr
      sessionsListener = listener
      running = true
      track(mgr.getActiveSessions(component))
    } catch (ignored: SecurityException) {
      // İzin tam bu anda geri alındı.
      try {
        mgr.removeOnActiveSessionsChangedListener(listener)
      } catch (ignored: Exception) {
      }
      untrackAll()
      manager = null
      sessionsListener = null
      running = false
      return false
    }
    return true
  }

  private fun stopTracking() {
    handler.removeCallbacks(publishRunnable)
    untrackAll()
    val listener = sessionsListener
    if (listener != null) {
      try {
        manager?.removeOnActiveSessionsChangedListener(listener)
      } catch (ignored: Exception) {
      }
    }
    sessionsListener = null
    manager = null
    running = false
    lastKey = null
    artworkKey = null
    artworkData = null
  }

  private fun track(controllers: List<MediaController>) {
    untrackAll()
    val own = context?.packageName
    for (controller in controllers) {
      // Ciklet'in kendi oturumu (sesli mesaj, görüşme) etkinlik değildir.
      if (controller.packageName == own) continue
      val callback = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) {
          schedulePublish()
        }

        override fun onPlaybackStateChanged(state: PlaybackState?) {
          schedulePublish()
        }

        override fun onSessionDestroyed() {
          schedulePublish()
        }
      }
      try {
        controller.registerCallback(callback, handler)
        tracked.add(controller to callback)
      } catch (ignored: Exception) {
      }
    }
    schedulePublish()
  }

  private fun untrackAll() {
    for ((controller, callback) in tracked) {
      try {
        controller.unregisterCallback(callback)
      } catch (ignored: Exception) {
      }
    }
    tracked.clear()
  }

  /**
   * Geri çağrılar kümeler hâlinde gelir (parça değişiminde metadata + durum +
   * konum ayrı ayrı); kısa bir bekleme bunları tek olaya indirir.
   */
  private fun schedulePublish(delayMs: Long = 400) {
    handler.removeCallbacks(publishRunnable)
    handler.postDelayed(publishRunnable, delayMs)
  }

  private fun publish() {
    if (!running) return
    val ctx = context ?: return
    val payload = currentPayload(ctx)
    val key = payload?.let {
      // Başlangıç anı 2 sn kovaya yuvarlanır: konum her durum olayında
      // milisaniye kayar, ama gerçek bir sarma (seek) anahtarı değiştirir.
      val position = (it["positionMs"] as? Double ?: 0.0).toLong()
      val startBucket = (System.currentTimeMillis() - position) / 2000
      listOf(
        it["packageName"], it["title"], it["artist"], it["durationMs"],
        startBucket, it["artworkBase64"]?.hashCode(),
      ).joinToString("|")
    } ?: "null"
    if (key == lastKey) return
    lastKey = key
    sendEvent("onMediaChange", mapOf("media" to payload))
  }

  // ── Yük ──────────────────────────────────────────────────────────────

  private fun isActive(state: PlaybackState?): Boolean = when (state?.state) {
    PlaybackState.STATE_PLAYING,
    PlaybackState.STATE_BUFFERING,
    PlaybackState.STATE_SKIPPING_TO_NEXT,
    PlaybackState.STATE_SKIPPING_TO_PREVIOUS,
    PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM,
    PlaybackState.STATE_CONNECTING -> true
    else -> false
  }

  private fun text(metadata: MediaMetadata, vararg keys: String): String? {
    for (key in keys) {
      val value = metadata.getString(key)?.trim()
      if (!value.isNullOrEmpty()) return value
    }
    return null
  }

  private fun currentPayload(ctx: Context): Map<String, Any?>? {
    // Liste sistemin öncelik sırasında (en son etkin oturum önce).
    val controller = tracked
      .map { it.first }
      .firstOrNull { isActive(it.playbackState) && it.metadata != null }
      ?: return null
    val metadata = controller.metadata ?: return null
    val state = controller.playbackState ?: return null

    val title = text(metadata, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
      ?: return null
    val artist = text(
      metadata,
      MediaMetadata.METADATA_KEY_ARTIST,
      MediaMetadata.METADATA_KEY_ALBUM_ARTIST,
      MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE,
    )
    val album = text(metadata, MediaMetadata.METADATA_KEY_ALBUM)
    val duration = metadata.getLong(MediaMetadata.METADATA_KEY_DURATION).coerceAtLeast(0)

    var position = state.position.coerceAtLeast(0)
    if (state.state == PlaybackState.STATE_PLAYING && state.lastPositionUpdateTime > 0) {
      val elapsed = SystemClock.elapsedRealtime() - state.lastPositionUpdateTime
      position += (elapsed * state.playbackSpeed).toLong().coerceAtLeast(0)
    }
    if (duration > 0) position = min(position, duration)

    val packageName = controller.packageName
    val (appName, category) = appInfo(ctx, packageName)

    return mapOf(
      "packageName" to packageName,
      "appName" to appName,
      "appCategory" to category,
      "title" to title,
      "artist" to artist,
      "album" to album,
      "durationMs" to duration.toDouble(),
      "positionMs" to position.toDouble(),
      "playing" to true,
      "artworkBase64" to artwork(packageName, title, artist, metadata),
    )
  }

  private fun appInfo(ctx: Context, packageName: String): Pair<String?, String?> =
    appInfoCache.getOrPut(packageName) {
      try {
        val pm = ctx.packageManager
        val info = pm.getApplicationInfo(packageName, 0)
        val label = pm.getApplicationLabel(info).toString().trim().ifEmpty { null }
        val category = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          when (info.category) {
            ApplicationInfo.CATEGORY_AUDIO -> "audio"
            ApplicationInfo.CATEGORY_VIDEO -> "video"
            ApplicationInfo.CATEGORY_GAME -> "game"
            else -> null
          }
        } else {
          null
        }
        label to category
      } catch (ignored: PackageManager.NameNotFoundException) {
        // Paket görünürlüğü dışında (bkz. AndroidManifest <queries>): JS adı paketten türetir.
        null to null
      }
    }

  /** Kapak: en çok 256 px, JPEG, base64 (önek yok). Yoksa ya da kodlanamazsa null. */
  private fun artwork(packageName: String, title: String, artist: String?, metadata: MediaMetadata): String? {
    val bitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
      ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_ART)
      ?: metadata.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
      ?: return null
    val key = "$packageName|$title|$artist|${bitmap.generationId}|${bitmap.width}x${bitmap.height}"
    if (key == artworkKey) return artworkData
    val encoded = encode(bitmap)
    artworkKey = key
    artworkData = encoded
    return encoded
  }

  private fun encode(source: Bitmap): String? = try {
    // Donanım bitmap'i doğrudan ölçeklenemeyebilir; yazılım kopyası alınır.
    val bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && source.config == Bitmap.Config.HARDWARE) {
      source.copy(Bitmap.Config.ARGB_8888, false)
    } else {
      source
    }
    val longest = max(bitmap.width, bitmap.height)
    val scale = if (longest > MAX_ARTWORK_PX) MAX_ARTWORK_PX.toFloat() / longest else 1f
    val scaled = if (scale < 1f) {
      Bitmap.createScaledBitmap(
        bitmap,
        max(1, (bitmap.width * scale).roundToInt()),
        max(1, (bitmap.height * scale).roundToInt()),
        true,
      )
    } else {
      bitmap
    }
    val out = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, 82, out)
    // Kaynak bitmap medya oturumuna ait: yalnızca kendi kopyalarımız bırakılır.
    if (scaled !== bitmap && scaled !== source) scaled.recycle()
    if (bitmap !== source) bitmap.recycle()
    Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  } catch (ignored: Throwable) {
    null
  }

  private companion object {
    const val MAX_ARTWORK_PX = 256
  }
}
