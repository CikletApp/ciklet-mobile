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
 */
export const PURCHASES_ENABLED = Platform.OS !== "ios";

/** Mağaza girişinin adı: iOS'ta yalnızca sahip olunanlar listelenir. */
export const STORE_TITLE = PURCHASES_ENABLED ? "Mağaza" : "Koleksiyonum";
