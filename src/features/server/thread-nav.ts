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
  const href = {
    pathname: "/chat/channel/[channelId]",
    params: { channelId: thread.id, serverId, parentId, threadName: thread.name },
  } as const;
  if (replace) router.replace(href);
  else router.push(href);
}
