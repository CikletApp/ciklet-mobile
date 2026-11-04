/**
 * Sunucu listesi (şerit) sürüm seçimi — TEK YER (web `rail-version.ts` ile aynı fikir).
 *
 *   "v2" (varsayılan): features/server-rail-v2 (Discord yapısı, iyimser
 *                      sürükle-bırak, klasör bandı, basılı tutma menüsü)
 *   "v1"             : app/(tabs)/servers.tsx içindeki ServersScreenV1
 *
 * Geri dönmek için derlemede `EXPO_PUBLIC_SERVER_RAIL=v1`.
 */
export const SERVER_RAIL_VERSION: "v1" | "v2" = process.env.EXPO_PUBLIC_SERVER_RAIL === "v1" ? "v1" : "v2";
