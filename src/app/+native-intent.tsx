import { isConnectionReturnUrl } from "@/lib/connection-providers";

/**
 * Sistemden gelen derin bağlantıların yönlendirmesi (expo-router).
 *
 * Hesap bağlama dönüşü (`ciklet://me?steam=linked`, web
 * /oauth/desktop-return) sistem tarayıcısı oturumunu kapatır; sonucu
 * Bağlantılar ekranı `openAuthSessionAsync`'in döndürdüğü adresten okur.
 * Uygulama açıkken router'ın ayrıca "Sen" sekmesine atlamasın diye yol
 * yutulur; uygulama bu bağlantıyla soğuk açıldıysa Bağlantılar'a gidilir.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isConnectionReturnUrl(path)) return initial ? "/profile/connections" : "";
  return path;
}
