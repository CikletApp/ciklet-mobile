import { Platform } from "react-native";

/**
 * Uygulamadan satın alma / hediye açık mı.
 *
 * Dijital ürünler (mağaza ürünleri, Mentol, sunucu abonelikleri) web ödeme
 * sayfasında, sistem tarayıcısında ödeniyor. App Store İnceleme Kılavuzu
 * 3.1.1 dijital ürünün uygulama içi satın alma (IAP) dışında satılmasını —
 * ve 3.1.1/3.1.3 uyarınca dışarıdaki satın almaya yönlendirmeyi, "web'de
 * satın al" bilgisini bile — reddediyor. iOS'ta bu yüzden fiyat, satın alma,
 * hediye ve kodla açma yüzeyleri hiç çizilmez; yalnızca zaten sahip olunan
 * ürünler (takma/çıkarma) ve mevcut durum gösterilir. Android'de (Play'in
 * kullanıcı tercihli faturalandırma kuralları) akış olduğu gibi kalır.
 *
 * Mentol aboneliğinin mağaza içi satışı ayrı: bkz. `IAP_ENABLED`.
 */
export const PURCHASES_ENABLED = Platform.OS !== "ios";

/** Mağaza girişinin adı: iOS'ta yalnızca sahip olunanlar listelenir. */
export const STORE_TITLE = PURCHASES_ENABLED ? "Mağaza" : "Koleksiyonum";

/**
 * Mentol aboneliği App Store / Google Play uygulama içi satın almayla
 * (expo-iap) satılıyor mu.
 *
 * Derleme anı bayrağı `EXPO_PUBLIC_IAP_ENABLED=1`. Uygulama mağazalarda
 * henüz yayında değil ve ürünler App Store Connect / Play Console'da
 * onaylanmadı; bu yüzden VARSAYILAN KAPALI: kapalıyken davranış eskisi gibi
 * (iOS'ta Mentol satın alma yüzeyi yok, Android'de web ödeme sayfası).
 * Açıkken Mentol ekranında mağaza abonelik kartı çizilir; Android'de
 * kendine Mentol alma web ödemesinden mağazaya geçer (Play ödeme politikası),
 * hediye web ödemesiyle kalır. Sunucu kimlik bilgileri yoksa kart "şu anda
 * kullanılamıyor" der (uç 503).
 */
const IAP_FLAG = process.env.EXPO_PUBLIC_IAP_ENABLED?.trim().toLowerCase();
export const IAP_ENABLED = (IAP_FLAG === "1" || IAP_FLAG === "true") && (Platform.OS === "ios" || Platform.OS === "android");
