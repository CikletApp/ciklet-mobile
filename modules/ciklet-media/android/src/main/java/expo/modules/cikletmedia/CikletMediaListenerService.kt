package expo.modules.cikletmedia

import android.service.notification.NotificationListenerService

/**
 * Boş bildirim dinleyicisi — yalnızca bir "anahtar".
 *
 * Android başka uygulamaların medya oturumlarını (Spotify, YouTube Music…)
 * `MediaSessionManager.getActiveSessions(component)` ile yalnızca kullanıcının
 * "Bildirim erişimi" verdiği bir NotificationListenerService bileşenine
 * açıyor. Snapchat'in "şu an dinlediğin" özelliği de aynı yolu kullanır.
 *
 * Bilerek hiçbir geri çağrı ezilmez: bildirim içerikleri okunmaz, saklanmaz,
 * ağa gönderilmez. Medya takibinin kendisi CikletMediaModule'de.
 */
class CikletMediaListenerService : NotificationListenerService()
