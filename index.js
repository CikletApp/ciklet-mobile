/**
 * Uygulama girişi.
 *
 * Arka plan bildirim görevi (lib/notification-task) BURADA içe aktarılır:
 * uygulama kapalıyken gelen veri-only push için Expo yalnızca JS paketini
 * yükleyip görevi çağırır; expo-router'ın rota dosyaları (_layout dahil)
 * render edilmeden yüklenmediği için oradaki `defineTask` çalışmıyordu
 * ("No task registered for key expo-task-manager"). Giriş dosyası her
 * koşulda değerlendirilir.
 */
import "@/lib/notification-task";
import "expo-router/entry";
