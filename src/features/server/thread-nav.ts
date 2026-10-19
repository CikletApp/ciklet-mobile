import { router } from "expo-router";

/**
 * Alt başlık açma — alt başlık bir kanal satırı olduğu için kanal sohbeti
 * rotası kullanılır; üst kanal ve ad parametreyle taşınır (kanal listesi
 * ucu alt başlıkları döndürmüyor, başlık bunlardan çizilir).
 * `replace`: form ekranının (yeni forum gönderisi) yerine açar.
 */
export function openThread(
  serverId: string,
  parentId: string,
  thread: { id: string; name: string },
  { replace = false }: { replace?: boolean } = {}
) {
  const href = `/chat/channel/${thread.id}?serverId=${serverId}&parentId=${parentId}&threadName=${encodeURIComponent(thread.name)}`;
  if (replace) router.replace(href);
  else router.push(href);
}
