import type {
  DirectMessageWithProfile,
  MessageWithMember,
  PresenceStatus,
  PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

import type { RichPresence } from "@/api/types";
import type { MessageEnvelope } from "./gateway";

/**
 * Ağ geçidi olay sözleşmesi (ADR-0012).
 *
 * Kaynak gerçeği:
 *   - istemci → ağ geçidi: `ciklet-web/gateway/src/main.rs` (dispatch) ve
 *     `gateway/src/events.rs` (yük yapıları, `deny_unknown_fields`)
 *   - Node → kullanıcı/sohbet odaları: `ciklet-web/src/lib/realtime/events.ts`
 *     ve `src/lib/calls/service.ts`
 *
 * İstemcinin gönderdiği alanlar snake_case, sunucunun yayınladıkları
 * camelCase. Ağ geçidi tanımadığı alanı taşıyan yükü REDDEDİYOR; bir alan
 * eklemeden önce Rust tarafındaki yapıya bak.
 */

// ── İstemci → ağ geçidi (`event_type`) ──────────────────────────────

export const ClientEvent = {
  CHAT_SUBSCRIBE: "chat.subscribe",
  CHAT_UNSUBSCRIBE: "chat.unsubscribe",
  /** 30 sn'de bir; `heartbeat.ack` döner. */
  HEARTBEAT: "heartbeat",
  /** `{ is_idle }` */
  PRESENCE_IDLE: "presence.idle",
  /** `{ status }` — ONLINE | IDLE | DND | INVISIBLE (elle seçilebilenler). */
  PRESENCE_SET_STATUS: "presence.set_status",
  /** Arkadaş/sunucu listesi değişti; presence kitlesi yeniden alınır. */
  PRESENCE_SYNC: "presence.sync",
  /** `{ chat_id, is_typing }` */
  TYPING: "typing",
  /** `{ channel_id, call_type? }` */
  VOICE_JOIN: "voice.join",
  /** `{ channel_id }` */
  VOICE_LEAVE: "voice.leave",
  /** `{ channel_id }` — kanaldakileri iste (`voice.update` döner). */
  VOICE_MEMBERS: "voice.members",
  VOICE_ACTIVE_CHANNELS: "voice.active_channels",
} as const;

// ── Ağ geçidi → istemci (`eventType`) ───────────────────────────────

export const ServerEvent = {
  HEARTBEAT_ACK: "heartbeat.ack",
  /** `{ statuses: [{ userId, status }] }` */
  PRESENCE_BATCH: "presence.batch",
  /** `{ userId, status }` */
  PRESENCE_UPDATE: "presence.update",
  /** `{ status }` — kendi görünür durumun. */
  PRESENCE_SELF: "presence.self",
  /** `{ userId, activity }` */
  RICH_PRESENCE_UPDATE: "rich_presence.update",
  /** `{ chatId, isTyping, profile }` — abone olunan sohbetlerden. */
  TYPING: "typing",
  /**
   * Yeni mesaj. Tel üzerinde ayrı bir `eventType` DEĞİL — `messageId`
   * taşıyan zarf; ağ geçidi istemcisi onu hem sohbet aboneliğine hem bu
   * ada yayar (sohbet listesi önizlemesi için).
   */
  MESSAGE_CREATE: "message.create",
  /** `{ chatId, message }` — düzenleme, silme, aktivite kartı, arama özeti. */
  MESSAGE_UPDATE: "message.update",
  /** `{ chatId, delta }` */
  MESSAGE_REACTION: "message.reaction",
  /** `{ message, sender, directId, isSpam }` — DM bildirimi (kullanıcı odası). */
  MESSAGE_NOTIFICATION: "message.notification",
  /** `{ readState }` */
  READ_STATE_UPDATED: "read_state.updated",
  /** `{ directId }` — grup kuruldu, üye eklendi/çıkarıldı, biri ayrıldı. */
  DIRECTS_UPDATED: "directs.updated",
  /** `{ serverId, channelId, messageId, senderId }` — sunucu okunmamış rozeti. */
  CHANNEL_MESSAGE: "channel.message",
  /** `{ serverId }` — sunucudan çıkarıldın. */
  SERVERS_REMOVED: "servers.removed",
  /** `{ serverId }` — sunucu silindi. */
  SERVER_DELETED: "server.deleted",
  /** `{ sender }` */
  FRIEND_REQUEST: "friend.request",
  FRIEND_REQUEST_UPDATED: "friend.request_updated",
  /** `{ channelId, participants, startTime, info? }` */
  VOICE_UPDATE: "voice.update",
  /** `{ channels: [...] }` */
  VOICE_ACTIVE_CHANNELS: "voice.active_channels",
  /** `{ caller, type, callId, expiresAt, directChannelId }` */
  CALL_INCOMING: "call.incoming",
  /** `{ profile, callId }` — karşı taraf kabul etti. */
  CALL_ACCEPTED: "call.accepted",
  /** `{ profile, callId }` */
  CALL_DENIED: "call.denied",
  /** `{ caller, callId }` — arayan vazgeçti ya da 45 sn doldu. */
  CALL_CANCELLED: "call.cancelled",
  /** `{ callId, status }` — başka cihazında yanıtladın. */
  CALL_HANDLED_ELSEWHERE: "call.handled_elsewhere",
} as const;

// ── Yük tipleri ─────────────────────────────────────────────────────

/** Kanal ve DM mesajları aynı cache'te, aynı listede yaşar. */
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

export interface RichPresencePayload {
  userId: string;
  activity: RichPresence | null;
}

export interface TypingPayload {
  chatId: string;
  isTyping: boolean;
  profile: Pick<PublicProfile, "id" | "username" | "name" | "imageUrl">;
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

/**
 * Ağ geçidi zarfı → sohbet listesinin beklediği mesaj.
 *
 * Web'deki `lib/gateway/message-envelope.ts` ile aynı kurallar: zarf
 * kontrol düzleminin gönderim anındaki YAZAR ANLIK GÖRÜNTÜSÜNÜ taşıyor.
 * Geçmiş yeniden çekildiğinde güncel ad gelir; canlı satırda gönderim
 * anındaki ad görünür.
 */
export function messageFromEnvelope(event: MessageEnvelope): ChatMessagePayload {
  const profile = {
    id: event.authorId,
    username: event.author.username,
    name: event.author.name,
    imageUrl: event.author.imageUrl,
  } as PublicProfile;

  const replyTo = event.replyTo
    ? {
        id: event.replyTo.messageId,
        // Silinmiş mesajın önizlemesi gösterilmez (sunucudaki `presentReply`).
        content: event.replyTo.deleted ? "" : event.replyTo.preview,
        deleted: event.replyTo.deleted,
        profile: {
          id: event.replyTo.authorId,
          username: event.replyTo.authorUsername,
          name: null,
          imageUrl: null,
        },
      }
    : null;

  const base = {
    id: event.messageId,
    content: event.content,
    fileUrl: event.fileUrl,
    type: event.messageType,
    deleted: false,
    metadata: event.metadata ?? null,
    replyToId: event.replyTo?.messageId ?? null,
    replyTo,
    reactions: [],
    createdAt: event.timestamp,
    updatedAt: event.timestamp,
    expiresAt: event.expiresAt,
  };

  if (event.scope === "channel") {
    return {
      ...base,
      channelId: event.chatId,
      memberId: event.memberId ?? event.authorId,
      member: {
        id: event.memberId ?? event.authorId,
        // Zarf yetki rolünü taşımıyor; en dar varsayım.
        role: "GUEST",
        profileId: event.authorId,
        serverId: event.serverId ?? "",
        nickname: event.author.nickname,
        roleColor: event.author.roleColor,
        profile,
      },
    } as unknown as MessageWithMember;
  }

  return {
    ...base,
    directId: event.chatId,
    profileId: event.authorId,
    profile,
  } as unknown as DirectMessageWithProfile;
}
