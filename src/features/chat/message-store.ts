import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { MessagesPage } from "@ciklet/embedded-activities-sdk/types";

import type { ChatMessagePayload } from "@/realtime/events";
import { dropExpired } from "./message-expiry";
import type { MessageCache } from "./reaction-cache";

/**
 * Son sohbetlerin son mesajları CİHAZDA.
 *
 * Genel sorgu önbelleği mesaj geçmişini bilinçli olarak diske yazmıyor
 * (bkz. api/query-client: sayfalar hızla büyür). Ama soğuk açılışta ya da
 * bellekten düşmüş bir sohbete girildiğinde ekran boş başlayıp ağı
 * bekliyordu. Burada yalnızca EN YENİ sayfanın ilk {@link MESSAGES_PER_CHAT}
 * mesajı, en son kullanılan {@link MAX_CHATS} sohbet için saklanır (birkaç
 * yüz KB). Sohbet açılınca bu kopya anında gösterilir; tazelik
 * `message-sync` eşitlemesiyle gelir (eksikler eklenir, büyük boşlukta
 * geçmiş baştan çekilir). Çıkışta silinir (`clearStoredMessages`).
 */

const STORAGE_KEY = "ciklet.messages.v1";
const MAX_CHATS = 40;
const MESSAGES_PER_CHAT = 50;
const WRITE_DELAY_MS = 2_000;

interface StoredChat {
  savedAt: number;
  page: MessagesPage<ChatMessagePayload>;
}

let chats = new Map<string, StoredChat>();
let loaded = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatching: (() => void) | null = null;

function scheduleWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const payload = JSON.stringify([...chats.entries()]);
    void AsyncStorage.setItem(STORAGE_KEY, payload).catch(() => {});
  }, WRITE_DELAY_MS);
}

/** Önbellekteki en yeni sayfanın kısaltılmış kopyası; imleç korunur. */
function snapshot(data: MessageCache | undefined): MessagesPage<ChatMessagePayload> | null {
  const first = data?.pages?.[0];
  if (!first?.items?.length) return null;
  // Süresi geçmiş (kaybolan) mesaj diske yazılmaz.
  const live = dropExpired(first.items, Date.now());
  if (live.length === 0) return null;
  if (live === first.items && live.length <= MESSAGES_PER_CHAT) return first;
  // Kesilen kopyanın imleci kesim noktasından devam etmeli; mesaj kimliği
  // imleç olarak kullanılıyor (en eski görünen mesajdan geriye). Süzme
  // yalnızca baştan/ortadan düşürür; son tutulan mesajın kimliği geçerli imleç.
  const items = live.slice(0, MESSAGES_PER_CHAT);
  const truncated = items.length < first.items.length;
  return { items, nextCursor: truncated ? items[items.length - 1]?.id ?? null : first.nextCursor ?? null };
}

function remember(chatId: string, data: MessageCache | undefined) {
  const page = snapshot(data);
  if (!page) return;
  chats.delete(chatId);
  chats.set(chatId, { savedAt: Date.now(), page });
  while (chats.size > MAX_CHATS) {
    const oldest = chats.keys().next().value;
    if (oldest === undefined) break;
    chats.delete(oldest);
  }
  scheduleWrite();
}

/** `useChatMessages` için ilk veri: varsa cihazdaki kopya. */
export function storedMessages(
  chatId: string
): InfiniteData<MessagesPage<ChatMessagePayload>, string | undefined> | undefined {
  const stored = chats.get(chatId);
  if (!stored) return undefined;
  // Diskte beklerken süresi dolan mesajlar ekrana hiç gelmez.
  const items = dropExpired(stored.page.items, Date.now());
  if (items.length === 0) return undefined;
  const page = items === stored.page.items ? stored.page : { ...stored.page, items };
  return { pages: [page], pageParams: [undefined] };
}

export function storedAt(chatId: string): number | undefined {
  return chats.get(chatId)?.savedAt;
}

/**
 * Diskten yükler ve sohbet önbelleklerini izlemeye başlar. Kök düzende bir
 * kez çağrılır; dönen fonksiyon izlemeyi durdurur.
 */
export function startMessageStore(queryClient: QueryClient): () => void {
  if (!loaded) {
    loaded = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const entries = JSON.parse(raw) as [string, StoredChat][];
        if (!Array.isArray(entries)) return;
        // Yüklenene kadar biriken yeni kayıtlar diskten gelenlerin önüne geçsin.
        const fresh = chats;
        chats = new Map(entries.filter(([id, value]) => typeof id === "string" && value?.page?.items));
        for (const [id, value] of fresh) {
          chats.delete(id);
          chats.set(id, value);
        }
      })
      .catch(() => {});
  }
  stopWatching?.();
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    const key = event.query.queryKey as readonly unknown[];
    if (key[0] !== "messages" || typeof key[1] !== "string") return;
    remember(key[1], event.query.state.data as MessageCache | undefined);
  });
  stopWatching = unsubscribe;
  return () => {
    unsubscribe();
    if (stopWatching === unsubscribe) stopWatching = null;
  };
}

/** Çıkış: bir sonraki hesap bir öncekinin mesajlarını görmesin. */
export async function clearStoredMessages() {
  chats = new Map();
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
