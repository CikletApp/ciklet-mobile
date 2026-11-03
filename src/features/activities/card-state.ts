/**
 * Etkinlik davet kartının DURUMU — web `lib/activity/invite-card-state`
 * ile BİREBİR aynı kurallar (testleri web'de:
 * tests/unit/activity-invite-card-state.test.ts). Değiştirirken ikisini
 * birlikte değiştir.
 *
 * Tek gerçek kaynak sohbetin aktivite ODASI (ağ geçidi `activity.update`
 * karesi; yalnızca canlı üyeleri taşır). Kartın kendi metni (`ad|TS:…`,
 * `ad|…sona erdi`) canlılık için okunmaz.
 *
 *  - Kart CANLI ⇔ odada en az bir canlı üye var VE odanın uygulaması
 *    kartın uygulaması. Başka bir uygulamanın oturumu (ör. Slow Roads) bir
 *    Birlikte İzle kartını asla canlı göstermez.
 *  - Canlıysa: katılımcılar ve süre odadan; düğme "Etkinliğe Katıl".
 *    Değilse: "sona erdi" metni ve "Başlat".
 *  - Uygulama başına tek oturum: aynı uygulamanın bütün kartları süren
 *    oturumu gösterir ve ona katılır.
 *  - Kartın uygulaması katalogdan: kimlik → adres → ad. Kartın eskimiş
 *    kimliği (uygulama yeniden kaydedildi) oturuma taşınmaz; taşınınca
 *    AUTHORIZE reddediliyor, aktivite "Yetkilendirme kodu alınamadı"da
 *    kalıyordu.
 */

export interface CardActivityRef {
  activityId?: string | null;
  activityUrl?: string | null;
  activityName?: string | null;
}

export interface CardRoomParticipant {
  id: string;
  username: string;
  name?: string | null;
  imageUrl?: string | null;
}

/**
 * Sohbetin BİR aktivite odasının istemcideki görüntüsü (`activity.update`).
 * Oda sohbet başına UYGULAMA başına (web ile aynı; ağ geçidi `activityId`).
 */
export interface ChatActivityRoom {
  activityId: string | null;
  activityUrl: string | null;
  startTs: number | null;
  participants: CardRoomParticipant[];
}

interface CatalogEntry {
  id: string;
  url: string;
  name: string;
}

/** "Sona erdi" metni — sunucu (web lib/activity/lifecycle) ve web kartıyla aynı. */
export const INVITE_CARD_ENDED_TEXT = "Aktivite sona erdi. Yeni bir aktiviteye başlamak ister misin?";

/** Karşılaştırma biçimi (web lib/activity-catalog `normalizeActivityUrl`). */
export function normalizeActivityUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function sameName(a: string | null | undefined, b: string): boolean {
  return Boolean(a) && a!.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");
}

/** Kartın uygulaması katalogda: kimlik → adres → ad. Bulunamazsa null. */
export function resolveCardActivity<T extends CatalogEntry>(card: CardActivityRef, catalog: readonly T[]): T | null {
  if (card.activityId) {
    const byId = catalog.find((entry) => entry.id === card.activityId);
    if (byId) return byId;
  }
  const wanted = card.activityUrl ? normalizeActivityUrl(card.activityUrl) : null;
  if (wanted) {
    const byUrl = catalog.find((entry) => normalizeActivityUrl(entry.url) === wanted);
    if (byUrl) return byUrl;
  }
  return catalog.find((entry) => sameName(card.activityName, entry.name)) ?? null;
}

export interface CardSession {
  live: boolean;
  startTs: number | null;
  participants: CardRoomParticipant[];
}

/** Sohbetin odaları — anahtar `roomKey` (uygulama kimliği; eski oda ""). */
export type ChatActivityRooms = Record<string, ChatActivityRoom>;

/** Odanın sohbet içindeki anahtarı: karedeki `activityId`, eski odada "". */
export function roomKey(frame: { activityId?: unknown }): string {
  return typeof frame.activityId === "string" ? frame.activityId : "";
}

function roomsOf(rooms: ChatActivityRoom | ChatActivityRooms | null | undefined): ChatActivityRoom[] {
  if (!rooms) return [];
  if (Array.isArray((rooms as ChatActivityRoom).participants)) return [rooms as ChatActivityRoom];
  return Object.values(rooms as ChatActivityRooms);
}

const ENDED: CardSession = { live: false, startTs: null, participants: [] };

function roomRunsApp(room: ChatActivityRoom, app: { id: string; url?: string | null }): boolean {
  if (room.activityId && room.activityId === app.id) return true;
  const roomUrl = room.activityUrl ? normalizeActivityUrl(room.activityUrl) : null;
  const appUrl = app.url ? normalizeActivityUrl(app.url) : null;
  return Boolean(roomUrl && appUrl && roomUrl === appUrl);
}

/**
 * Kartın uygulamasının bu sohbetteki oturumu; yoksa bitmiş. Sohbette
 * birden çok uygulamanın odası olabilir; kart yalnızca kendi uygulamasınınkine bakar.
 */
export function cardSession(
  app: { id: string; url?: string | null } | null,
  rooms: ChatActivityRoom | ChatActivityRooms | null | undefined
): CardSession {
  if (!app) return ENDED;
  const room = roomsOf(rooms).find((candidate) => candidate.participants.length > 0 && roomRunsApp(candidate, app));
  if (!room) return ENDED;
  return { live: true, startTs: room.startTs, participants: room.participants };
}

/** Sohbette biz dışında canlı üyesi olan ilk oda (web `joinableRoom`). */
export function joinableRoom(
  rooms: ChatActivityRoom | ChatActivityRooms | null | undefined,
  selfId: string | null | undefined
): ChatActivityRoom | null {
  return (
    roomsOf(rooms).find(
      (room) => room.participants.length > 0 && !room.participants.some((participant) => participant.id === selfId)
    ) ?? null
  );
}

export type CardTapAction<T> =
  | { kind: "join"; activity: T }
  | { kind: "start"; activity: T }
  | { kind: "unavailable" };

export function cardTapAction<T extends CatalogEntry>(
  card: CardActivityRef,
  catalog: readonly T[],
  rooms: ChatActivityRoom | ChatActivityRooms | null | undefined
): CardTapAction<T> {
  const activity = resolveCardActivity(card, catalog);
  if (!activity) return { kind: "unavailable" };
  return cardSession(activity, rooms).live ? { kind: "join", activity } : { kind: "start", activity };
}

/** `activity.update` karesinden oda görüntüsü (biçimi bozuk alanlar düşer). */
export function roomFromFrame(frame: Record<string, unknown>): ChatActivityRoom {
  const participants = Array.isArray(frame.participants)
    ? (frame.participants as unknown[]).filter(
        (p): p is CardRoomParticipant =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as CardRoomParticipant).id === "string" &&
          typeof (p as CardRoomParticipant).username === "string"
      )
    : [];
  const activity = (frame.activity ?? null) as { id?: unknown; url?: unknown } | null;
  return {
    // Odanın uygulaması (`activityId`) tanımdan önce: boşalan odanın
    // görüntüsünde tanım olmayabilir.
    activityId:
      typeof frame.activityId === "string" && frame.activityId
        ? frame.activityId
        : typeof activity?.id === "string" && activity.id
          ? activity.id
          : null,
    activityUrl: typeof activity?.url === "string" && activity.url ? activity.url : null,
    startTs: typeof frame.startTs === "number" && Number.isFinite(frame.startTs) ? frame.startTs : null,
    participants,
  };
}

export const EMPTY_ROOM: ChatActivityRoom = { activityId: null, activityUrl: null, startTs: null, participants: [] };
