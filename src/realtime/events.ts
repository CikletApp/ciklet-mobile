import type {
  DirectMessageWithProfile,
  MessageWithMember,
  PresenceStatus,
  PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

import type { RichPresence } from "@/api/types";

/**
 * Socket.IO olay sözleşmesi.
 *
 * Kaynak gerçeği `ciklet-web/src/pages/api/socket/io.ts` dosyasıdır; buradaki
 * her ad o dosyadaki `socket.on(...)` / `.emit(...)` çağrılarıyla BİREBİR
 * doğrulanmıştır.
 *
 * ⚠️ SDK'daki `SocketEvents` / `chatRoom()` yardımcıları bu noktada
 * güvenilmez:
 *   - `chatRoom(id)` → `chat:<id>` üretiyor. Sunucudaki ODA adı ise
 *     `chatroom:<id>` ve istemci odaya isimle KATILMIYOR; `chat:subscribe`
 *     yayınlıyor. Dinlenmesi gereken OLAY `chat:<id>:messages`.
 *   - `PresenceUpdatePayload` = `{profileId, presenceStatus}` diyor;
 *     sunucu `{userId, status}` yolluyor.
 * Bu yüzden mobil, sözleşmeyi buradan okur. (Düzeltmeler ciklet-sdk'ya
 * taşındığında burası oradan re-export'a indirgenecek.)
 */

// ── İstemci → sunucu ────────────────────────────────────────────────

export const ClientEvent = {
  /** `{ chatId }` veya `{ chatIds: [] }` — üyelik sunucuda doğrulanır. */
  CHAT_SUBSCRIBE: "chat:subscribe",
  CHAT_UNSUBSCRIBE: "chat:unsubscribe",
  /** 30 sn'de bir; sunucu `heartbeat_ack` ile yanıtlar. */
  HEARTBEAT: "heartbeat",
  /** `{ isIdle }` — kullanıcı etkileşimi kesildiğinde. */
  PRESENCE_IDLE: "presence:idle",
  /** `{ status }` — kullanıcının elle seçtiği durum. */
  PRESENCE_SET_STATUS: "presence:set_status",
  /** Arkadaş/sunucu listesi değişince abonelikleri yeniden kurar. */
  PRESENCE_SYNC: "presence:sync",
  RICH_PRESENCE_UPDATE: "rich_presence:update",
  /** `{ type: 'direct' | 'channel', id, isTyping }` */
  TYPING: "typing",
  /** `{ channelId? , directId?, messageId }` — okundu bilgisi. */
  MESSAGE_ACK: "MESSAGE_ACK",
  FRIEND_REQUEST: "friend_request",
  FRIEND_REQUEST_UPDATED: "friend_request_updated",
  GET_ACTIVE_VOICE_CHANNELS: "get_active_voice_channels",
  JOIN_VOICE_CHANNEL: "join_voice_channel",
  LEAVE_VOICE_CHANNEL: "leave_voice_channel",
  /** `{ receiverId, type }` — arama başlat. */
  INCOMING_CALL: "incoming_call",
  /** `{ callerId, callId }` — gelen aramayı kabul et. */
  CALL_ACCEPTED: "call_accepted",
  /** `{ callerId, callId }` — gelen aramayı reddet. */
  CALL_DENIED: "call_denied",
  /** `{ receiverId, callId }` — kendi aramanı iptal et. */
  CALL_CANCELLED: "call_cancelled",
  /** Açılışta bekleyen davetleri iste (`pending_call_invites` döner). */
  SYNC_CALL_STATE: "sync_call_state",
} as const;

// ── Sunucu → istemci ────────────────────────────────────────────────

export const ServerEvent = {
  READY: "ready",
  HEARTBEAT_ACK: "heartbeat_ack",
  /** `{ statuses, activities }` — DİZİ DEĞİL. */
  PRESENCE_BATCH: "presence:batch",
  /** `{ userId, status }` */
  PRESENCE_UPDATE: "presence:update",
  /** `{ status }` — kendi görünür durumun. */
  PRESENCE_SELF: "presence:self",
  /** `{ userId, activity }` */
  RICH_PRESENCE_UPDATE: "rich_presence:update",
  TYPING: "typing",
  READ_STATE_UPDATED: "READ_STATE_UPDATED",
  /** Sohbet açık olmasa da gelen DM bildirimi. */
  NEW_MESSAGE: "new_message",
  /**
   * `{ directId }` — sohbet listesinin kendisi değişti.
   *
   * ciklet-web bunu grup kurulduğunda, üye eklenip çıkarıldığında ve biri
   * gruptan ayrıldığında ETKİLENEN HER ÜYEYE yayınlıyor
   * (`api/directs/groups/route.ts`, `api/directs/[directId]/route.ts`).
   * `new_message`'tan farkı: ortada yeni bir mesaj yok, değişen üyelik.
   * Dinlenmezse bir gruba eklenen kullanıcı, uygulamayı kapatıp açana
   * kadar grubu hiç görmez.
   */
  DIRECTS_UPDATED: "directs_updated",
  FRIEND_REQUEST: "friend_request",
  FRIEND_REQUEST_UPDATED: "friend_request_updated",
  VOICE_CHANNEL_UPDATE: "voice_channel_update",
  ACTIVE_VOICE_CHANNELS: "active_voice_channels",
  /** `{ caller, type, callId, expiresAt }` — sana arama geliyor. */
  INCOMING_CALL: "incoming_call",
  /** `{ profile, callId }` — karşı taraf kabul etti. */
  CALL_ACCEPTED: "call_accepted",
  /** `{ profile, callId }` — karşı taraf reddetti. */
  CALL_DENIED: "call_denied",
  /** `{ caller, callId }` — arayan vazgeçti veya davet zaman aşımına uğradı. */
  CALL_CANCELLED: "call_cancelled",
  /** `{ receiverId, reason }` — DM izinleri aramaya kapalı. */
  CALL_REJECTED: "call_rejected",
  /** `{ callId, status }` — başka cihazında yanıtladın. */
  CALL_HANDLED_ELSEWHERE: "call_handled_elsewhere",
  /** Açılışta bekleyen davetler. */
  PENDING_CALL_INVITES: "pending_call_invites",
  ACTIVITY_UPDATE: "activity_update",
  ACTIVITY_SYNC: "activity_sync",
  ACTIVITY_ENDED: "activity_ended",
} as const;

// ── Sohbete özel dinamik olay adları ────────────────────────────────
// ciklet-web: `SOCKET_EVENTS.chatMessages` / `chatUpdate` (lib/constants.ts)

/** Yeni mesaj yayını. `chatId` = channelId veya directId. */
export const chatMessagesEvent = (chatId: string) =>
  `chat:${chatId}:messages` as const;

/** Var olan mesajın güncellenmesi (düzenleme, silme, reaksiyon). */
export const chatUpdateEvent = (chatId: string) =>
  `chat:${chatId}:messages:update` as const;

/** Mesaj reaksiyonunun eklenmesi veya kaldırılması. */
export const chatReactionEvent = (chatId: string) =>
  `chat:${chatId}:reaction` as const;

// ── Yük tipleri ─────────────────────────────────────────────────────

/** Kanal ve DM mesajları aynı olay adı deseninden gelir. */
export type ChatMessagePayload = MessageWithMember | DirectMessageWithProfile;

export interface ReactionDelta {
  messageId: string;
  action: "add" | "remove";
  reaction: {
    id: string;
    emoji: string;
    profileId: string;
    messageId: string | null;
    directMessageId: string | null;
    createdAt?: string;
  };
}

export interface PresenceUpdatePayload {
  userId: string;
  status: PresenceStatus;
}

export interface PresenceSelfPayload {
  status: PresenceStatus;
}

/**
 * `presence:batch` yükü.
 *
 * ⚠️ `statuses` bir NESNE DEĞİL, DİZİdir. Sunucudaki
 * `presenceManager.getBulkStatus()` `PresenceUpdateEvent[]` döndürür
 * (`[{ userId, status }, …]`). Nesne sanıp `Object.entries()` uygulamak
 * anahtar olarak dizi indekslerini ("0", "1", …) verir ve hiçbir
 * kullanıcının durumu çözülmez — arkadaşlar kalıcı olarak çevrimdışı
 * görünür. Web istemcisi de bu diziyi `data.statuses.map(...)` ile okur.
 *
 * `activities` ise gerçekten kullanıcı kimliğine göre anahtarlı bir nesne.
 */
export interface PresenceBatchPayload {
  statuses: PresenceUpdatePayload[];
  activities: Record<string, RichPresence>;
}

/**
 * Sunucunun eski sürümleri `presence:batch`'i sarmalayıcı olmadan, düz bir
 * dizi olarak yayınlıyordu. Web istemcisi hâlâ iki şekli de kabul ediyor;
 * mobil de aynısını yapar.
 */
export type PresenceBatchMessage = PresenceBatchPayload | PresenceUpdatePayload[];

/** Her iki yayın şeklini tek biçime indirger. */
export function normalizePresenceBatch(message: PresenceBatchMessage): {
  statuses: PresenceUpdatePayload[];
  activities: Record<string, RichPresence>;
} {
  if (Array.isArray(message)) return { statuses: message, activities: {} };
  return {
    statuses: Array.isArray(message?.statuses) ? message.statuses : [],
    activities: message?.activities ?? {},
  };
}

export interface RichPresencePayload {
  userId: string;
  activity: RichPresence | null;
}

export interface TypingPayload {
  type: "direct" | "channel";
  id: string;
  isTyping: boolean;
  profile: Pick<PublicProfile, "id" | "username" | "name" | "imageUrl">;
}

export interface FriendRequestPayload {
  sender: Pick<PublicProfile, "id" | "username" | "name" | "imageUrl">;
}

export interface ReadStatePayload {
  id: string;
  profileId: string;
  channelId: string | null;
  directId: string | null;
  messageId: string;
  lastReadAt: string;
}

/**
 * Bir mesajın hangi sohbete ait olduğunu ayırt eder. Kanal mesajlarında
 * `member` alanı, DM'lerde doğrudan `profile` alanı bulunur.
 */
export function isChannelMessage(
  message: ChatMessagePayload
): message is MessageWithMember {
  return "member" in message;
}
