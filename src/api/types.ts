import type {
  Member,
  MemberWithProfile,
  PresenceStatus,
  PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

/**
 * SDK sözleşmesinde HENÜZ karşılığı olmayan yanıt tipleri.
 *
 * Buradaki her tip, `ciklet-web` içindeki ilgili rotanın gerçek çıktısından
 * türetilmiştir (dosya yolu her tipin üstünde belirtilir). Bir tip
 * olgunlaştığında ve başka istemciler de (desktop/bot) kullanmaya
 * başladığında `ciklet-sdk`'ya taşınmalıdır — mobil, sözleşmenin sahibi
 * değil tüketicisidir.
 */

/** ciklet-web: `src/app/api/current-profile/route.ts` (stripSensitive çıktısı) */
export interface CurrentProfile extends PublicProfile {
  email: string | null;
  /** Ham numara sunucudan hiç çıkmaz; yalnızca maskeli hali gelir. */
  phoneMasked: string | null;
  isPhoneVerified: boolean;
  dmPermission: "EVERYONE" | "FRIENDS_ONLY" | "NOBODY" | null;
  spamFilter: "ALL" | "NON_FRIENDS" | "NONE" | null;
  friendReqEveryone: boolean | null;
  friendReqFriendsOfFriends: boolean | null;
  friendReqServerMembers: boolean | null;
  eulaAccepted: boolean;
  updatedAt: string;
}

/** `PATCH /api/current-profile` gövdesi — yalnızca gönderilen alanlar yazılır. */
export interface UpdateProfileInput {
  name?: string | null;
  pronouns?: string | null;
  bio?: string | null;
  bannerColor?: string | null;
  /** `null` → sunucu Multiavatar üretir. Aksi halde `https://` ile başlamalı. */
  imageUrl?: string | null;
  dmPermission?: CurrentProfile["dmPermission"];
  spamFilter?: CurrentProfile["spamFilter"];
  friendReqEveryone?: boolean;
  friendReqFriendsOfFriends?: boolean;
  friendReqServerMembers?: boolean;
}

/** ciklet-web: `src/app/api/members/mine/route.ts` */
export interface MembershipWithServer extends Member {
  server: { id: string; name: string; imageUrl: string };
}

/** `PATCH /api/members/[memberId]` — sunucuya özel profil alanları. */
export interface UpdateMemberProfileInput {
  nickname?: string | null;
  serverPronouns?: string | null;
  serverBio?: string | null;
  serverImageUrl?: string | null;
  serverBannerColor?: string | null;
}

/** ciklet-web: `src/app/api/search/route.ts` */
export interface SearchResults {
  servers: { id: string; name: string; imageUrl: string }[];
  channels: { id: string; name: string; serverId: string; type: string }[];
  people: PublicProfile[];
}

/** ciklet-web: `src/app/api/unread-counts/route.ts` */
export interface UnreadCounts {
  channelUnreads: Record<string, { count: number; serverId: string }>;
  serverUnreads: Record<string, number>;
}

/** ciklet-web: `src/app/api/activities/route.ts` */
export interface ActivitySummary {
  /** OAuth client_id — gömülü uygulama bunu `new CikletSDK(clientId)`'ye verir. */
  id: string;
  name: string;
  url: string;
  icon: string;
  description?: string;
  isVerified?: boolean;
}

/** Presence deposu için normalize edilmiş kayıt. */
export interface PresenceEntry {
  status: PresenceStatus;
  /** Zengin durum ("… oynuyor"). Yoksa null. */
  activity: RichPresence | null;
}

export interface RichPresence {
  name?: string;
  details?: string;
  state?: string;
  imageUrl?: string;
  startedAt?: number;
  [key: string]: unknown;
}

/** Üye listesi ekranlarında profil + presence birleştirilmiş görünüm. */
export interface MemberWithPresence extends MemberWithProfile {
  presence: PresenceEntry | undefined;
}
