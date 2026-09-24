import * as ReactNative from "react-native";

/**
 * Yerel çerez kavanozunu boşaltır.
 *
 * ── Neden ───────────────────────────────────────────────────────────────
 * Kimlik, SecureStore'daki token'dan her istekte ELLE yazılan `Cookie`
 * başlığıyla taşınıyor. Android'de React Native'in ağ katmanı WebView ile
 * AYNI CookieManager'ı kullanıyor ve kavanozda o alan adı için HERHANGİ bir
 * çerez varsa:
 *   - fetch (OkHttp BridgeInterceptor) elle verilen `Cookie` başlığını
 *     kavanozdakiyle DEĞİŞTİRİYOR — oturum çerezi sunucuya hiç ulaşmıyor;
 *   - WebSocket kavanozdakini AYRI bir `Cookie` başlığı olarak EKLİYOR ve
 *     ağ geçidi ilk başlığı okuyor.
 * Kayıttaki Turnstile sayfası (WebView) analitik çerezleri (`_ga`) bırakınca
 * sonraki her istek 401 alıyor ve kullanıcı giriş yaptığı anda çıkışa
 * düşüyordu. fetch tarafı `credentials: "omit"` ile kavanozdan tamamen
 * koparıldı; WebSocket'te o seçenek yok, bu yüzden el sıkışmadan önce ve
 * WebView kapandıktan sonra kavanoz temizlenir. Uygulama kavanoza hiçbir
 * şey için güvenmiyor.
 */
type NetworkingModule = { clearCookies: (callback: (cleared: boolean) => void) => void };

const networking = (ReactNative as unknown as { Networking?: NetworkingModule }).Networking;

export function clearNativeCookies(): Promise<void> {
  if (!networking?.clearCookies) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      networking.clearCookies(() => resolve());
    } catch {
      resolve();
    }
  });
}
