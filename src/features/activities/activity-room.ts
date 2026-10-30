import { ServerEvent } from "@/realtime/events";
import { onGatewayEvent, onGatewayOpen, sendGatewayEvent } from "@/realtime/gateway";
import { useActivitySession, type ActivityDescriptor } from "@/stores/activity";
import { roomFromFrame } from "./card-state";

/**
 * Sohbetlerin aktivite odası durumu — web `chat-page` "katılınabilir aktivite
 * tespiti".
 *
 * Davet kartı görününce sohbetin odası `activity.get` ile sorulur; bu aynı
 * zamanda bağlantıyı odaya sokar, sonraki `activity.update` yayınları gelir.
 * Katılımcılar ve odadaki aktif aktivite store'a yazılır: kart avatar/sayı
 * satırını buradan çizer, başlatma akışı (launch.ts) aynı sohbette zaten
 * süren bir oturuma yeni kart basmadan katılır.
 *
 * Oda üyeliği bağlantıyla düşer; yeniden bağlanınca izlenen sohbetler
 * yeniden sorulur.
 */

const watched = new Map<string, number>();
let attached = false;

function parseDescriptor(value: unknown): ActivityDescriptor | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.url !== "string" || !raw.url) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : raw.url,
    name: typeof raw.name === "string" ? raw.name : "Aktivite",
    url: raw.url,
    icon: typeof raw.icon === "string" ? raw.icon : "gamepad",
    color: typeof raw.color === "string" ? raw.color : undefined,
  };
}

function onRoomFrame(frame: Record<string, unknown>) {
  if (typeof frame.chatId !== "string") return;
  // Oda görüntüsü (uygulama, canlı üyeler, başlangıç) davet kartlarının tek
  // gerçeği — web chat-page ile aynı (card-state).
  useActivitySession.getState().setRoom(frame.chatId, roomFromFrame(frame), parseDescriptor(frame.activity));
}

function attach() {
  if (attached) return;
  attached = true;
  onGatewayEvent(ServerEvent.ACTIVITY_UPDATE, onRoomFrame);
  onGatewayEvent(ServerEvent.ACTIVITY_CURRENT_STATE, onRoomFrame);
  onGatewayEvent(ServerEvent.ACTIVITY_ENDED, (frame) => {
    if (typeof frame.chatId === "string") useActivitySession.getState().clearRoom(frame.chatId);
  });
  onGatewayOpen(() => {
    for (const chatId of watched.keys()) sendGatewayEvent({ event_type: "activity.get", chat_id: chatId });
  });
}

/** Sohbetin aktivite odasını izle; dönen fonksiyon izlemeyi bırakır. */
export function watchActivityRoom(chatId: string): () => void {
  attach();
  const count = watched.get(chatId) ?? 0;
  watched.set(chatId, count + 1);
  if (count === 0) sendGatewayEvent({ event_type: "activity.get", chat_id: chatId });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (watched.get(chatId) ?? 1) - 1;
    if (next > 0) watched.set(chatId, next);
    else watched.delete(chatId);
  };
}
