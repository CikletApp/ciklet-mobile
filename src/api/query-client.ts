import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { Image } from "expo-image";

import { clearStoredMessages, startMessageStore } from "@/features/chat/message-store";
import { kvGet, kvSet, wipeLocalDb } from "@/lib/local-db";
import { clearMedia } from "@/lib/media-cache";
import { qk } from "./query-keys";

/**
 * Query istemcisi ve çevrimdışı kalıcılık.
 *
 * Mobilde uygulama açılışı ile ilk veri arasında saniyeler geçer; kalıcı
 * cache sayesinde kullanıcı önceki oturumun listesini ANINDA görür, taze
 * veri arkada gelir. Metroda/uçakta uygulama tamamen boş açılmaz.
 *
 * Neyin saklandığı bilinçlidir:
 *  - Sunucular, DM listesi, arkadaşlar, profil, okunmamış sayıları →
 *    yerel SQLite'ta anlık görüntü (`kv` tablosu). Modül yüklenirken
 *    EŞZAMANLI okunup önbelleğe tohumlanır: sohbet listesi ilk karede,
 *    ağı ve AsyncStorage geri yüklemesini beklemeden çizilir (WhatsApp).
 *    Tohumun zamanı korunur; bayat sayılır ve ekran açılınca arkada tazelenir.
 *  - Mesaj geçmişi → genel önbellekte değil, ayrı yerel depoda
 *    (features/chat/message-store: sohbet başına boşluksuz kesim, LRU).
 *  - Arama → saklanmaz.
 *  - Web'de yerel veritabanı yok; aynı anahtarlar AsyncStorage
 *    kalıcılığıyla saklanır.
 */

/**
 * React Native'de pencere odağı yok; TanStack'e uygulamanın ön/arka plan
 * durumu odak olarak bildirilir. Böylece `refetchInterval` arka planda
 * durur ve ön plana dönüşte bayat sorgular tazelenir.
 */
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (next) => setFocused(next === "active"));
  return () => subscription.remove();
});

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

/** Anlık görüntüsü yerel veritabanında tutulan sorgular (anahtarın tamamı sabit). */
const SNAPSHOT_KEYS: readonly (readonly string[])[] = [
  qk.currentProfile,
  qk.directs,
  qk.friends,
  qk.memberships,
  qk.unreadCounts,
];
const SNAPSHOT_ROOTS = new Set(SNAPSHOT_KEYS.map((key) => key[0]));
const snapshotKv = (root: string) => `query:${root}`;

/** Açılış: anlık görüntüler önbelleğe — ilk render'dan önce, eşzamanlı. */
function seedSnapshots() {
  for (const key of SNAPSHOT_KEYS) {
    const stored = kvGet<unknown>(snapshotKv(key[0]));
    if (stored?.value === undefined || stored.value === null) continue;
    queryClient.setQueryData(key, stored.value, { updatedAt: stored.updatedAt });
  }
}

const snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>();

function watchSnapshots() {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    const [root] = event.query.queryKey as [string];
    if (!SNAPSHOT_ROOTS.has(root) || event.query.queryKey.length !== 1) return;
    if (snapshotTimers.has(root)) return;
    snapshotTimers.set(
      root,
      setTimeout(() => {
        snapshotTimers.delete(root);
        const query = queryClient.getQueryCache().find({ queryKey: [root], exact: true });
        if (query?.state.status !== "success" || query.state.data === undefined) return;
        void kvSet(snapshotKv(root), query.state.data, query.state.dataUpdatedAt);
      }, 1_000)
    );
  });
}

if (Platform.OS !== "web") {
  seedSnapshots();
  watchSnapshots();
}

// Sohbetlerin mesajları cihazda (features/chat/message-store): sohbet
// açılınca diskten okunur, önbellek değiştikçe yazılır.
startMessageStore(queryClient);

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "ciklet.query-cache",
  // Yazma sıklığını sınırla: her cache değişiminde diske yazmak, hareketli
  // bir kanalda saniyede onlarca yazma demektir.
  throttleTime: 2_000,
});

/** AsyncStorage kalıcılığı yalnızca web'de (yerelde SQLite anlık görüntüleri var). */
const PERSISTED_KEYS = Platform.OS === "web" ? SNAPSHOT_ROOTS : new Set<string>();

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
 * Çıkışta diskteki her şey silinir: sorgu önbelleği, yerel mesaj
 * veritabanı, gönderim kuyruğu ve indirilen medya. Bunu yapmazsak bir
 * sonraki kullanıcı bir önceki hesabın sohbetlerini ve dosyalarını görür.
 */
export async function clearPersistedCache() {
  for (const timer of snapshotTimers.values()) clearTimeout(timer);
  snapshotTimers.clear();
  clearStoredMessages();
  queryClient.clear();
  // Kuyruk modülü burada içe aktarılmıyor (döngü); temizliği outbox-sender
  // `onLocalDataCleared` ile yapar.
  for (const listener of clearListeners) listener();
  await Promise.all([
    persister.removeClient(),
    wipeLocalDb(),
    clearMedia(),
    Image.clearDiskCache().catch(() => false),
    Image.clearMemoryCache().catch(() => false),
  ]);
}

const clearListeners = new Set<() => void>();

/** Çıkışta yerel veri silinirken çağrılır (kuyruk, görsel önbelleği…). */
export function onLocalDataCleared(listener: () => void): () => void {
  clearListeners.add(listener);
  return () => {
    clearListeners.delete(listener);
  };
}
