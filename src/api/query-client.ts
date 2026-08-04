import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

import { qk } from "./query-keys";

/**
 * Query istemcisi ve çevrimdışı kalıcılık.
 *
 * Mobilde uygulama açılışı ile ilk veri arasında saniyeler geçer; kalıcı
 * cache sayesinde kullanıcı önceki oturumun listesini ANINDA görür, taze
 * veri arkada gelir. Metroda/uçakta uygulama tamamen boş açılmaz.
 *
 * Neyin saklandığı bilinçlidir:
 *  - Sunucular, DM listesi, arkadaşlar, profil → saklanır (yavaş değişir)
 *  - Mesaj geçmişi ve arama → SAKLANMAZ. Mesajlar hızla büyür (her sohbet
 *    için sayfalar), AsyncStorage'ı şişirir ve çevrimdışı okunan eski bir
 *    sohbet, canlı akışla senkronize olmadığı için yanıltıcı olur.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Kalıcı cache'in yaşı: bundan eskisi çöp sayılır.
      gcTime: 24 * 60 * 60 * 1000,
      // Mobilde ağ dalgalanması sık; tek deneme yetersiz, sonsuz deneme
      // kullanıcıyı bekletir.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: 0 },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "ciklet.query-cache",
  // Yazma sıklığını sınırla: her cache değişiminde diske yazmak, hareketli
  // bir kanalda saniyede onlarca yazma demektir.
  throttleTime: 2_000,
});

/** Kalıcılığa alınacak sorgular — anahtarın ilk parçasına göre. */
const PERSISTED_KEYS = new Set<string>([
  qk.currentProfile[0],
  qk.directs[0],
  qk.friends[0],
  qk.memberships[0],
  qk.unreadCounts[0],
]);

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  /**
   * Şema değişince eski cache'i geçersiz kıl. Bir yanıt tipi değiştiğinde
   * bu değeri artır — aksi halde eski şekilli veri yeni koda beslenir.
   */
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const [root] = query.queryKey as [string];
      return query.state.status === "success" && PERSISTED_KEYS.has(root);
    },
  },
};

/**
 * Çıkışta diskteki cache silinir. Bunu yapmazsak bir sonraki kullanıcı,
 * uygulamayı açtığında bir önceki hesabın sohbet listesini görür.
 */
export async function clearPersistedCache() {
  queryClient.clear();
  await persister.removeClient();
}
