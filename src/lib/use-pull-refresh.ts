import { useCallback, useState } from "react";

/**
 * Aşağı çekip yenileme durumu — YALNIZCA kullanıcının çekmesine bağlı.
 *
 * `RefreshControl refreshing={query.isRefetching}` kullanılıyordu. Arka plan
 * yeniden çekmeleri (ekrana dönüş, odak, gerçek zamanlı geçersiz kılma) da
 * `isRefetching`'i açtığı için iOS listenin üstüne yenileme boşluğu ekliyor;
 * ekran görünmezken bu durum değişince boşluk kalıcı oluyordu ("sohbetten
 * dönünce listenin üstünde kocaman boşluk"). Sunucular sekmesi bunu zaten
 * yerel durumla çözmüştü; burası onun ortak hâli.
 */
export function usePullRefresh(run: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await run();
    } finally {
      setRefreshing(false);
    }
  }, [run]);
  return { refreshing, onRefresh };
}
