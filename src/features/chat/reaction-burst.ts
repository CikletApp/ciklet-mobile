/**
 * Süper tepki patlaması olayları (web: components/chat/v2/reaction-burst).
 *
 * Canlı `message.reaction` deltası `superBurst` taşıyınca o mesajın süper
 * tepki çipi animasyon oynatır. Çip olaydan SONRA da mount olabilir (yeni
 * grup ilk kez çiziliyor) — bu yüzden son patlamalar kısa süre hatırlanır.
 */
type Listener = (messageId: string, emoji: string) => void;

const listeners = new Set<Listener>();
const recent = new Map<string, number>();
const RECENT_MS = 1500;

export function emitReactionBurst(messageId: string, emoji: string): void {
  const now = Date.now();
  recent.set(`${messageId}:${emoji}`, now);
  for (const [key, at] of recent) if (now - at > RECENT_MS) recent.delete(key);
  listeners.forEach((fn) => fn(messageId, emoji));
}

export function subscribeReactionBurst(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bu çip az önce gelen bir patlamayı kaçırdı mı (yeni mount). */
export function hadRecentBurst(messageId: string, emoji: string): boolean {
  const at = recent.get(`${messageId}:${emoji}`);
  return at !== undefined && Date.now() - at <= RECENT_MS;
}
