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

/**
 * ciklet-web: `src/app/api/members/mine/route.ts`
 *
 * Prisma `include` kullandığı için Member'ın TÜM skaler alanları yanıtta
 * gelir — sıralama ve klasör alanları dahil. Klasör sistemi mobilde bu
 * alanlardan kurulur.
 *
 * ⚠️ Klasörün ADI ve RENGİ burada YOK ve `GET /api/folders` diye bir uç da
 * yok (yalnızca POST/PATCH var). Bu yüzden mobil klasörleri gruplayabiliyor
 * ama başlıklarını sunucudan okuyamıyor — bkz. docs/ROADMAP.md.
 */
export interface MembershipWithServer extends Member {
  server: {
    id: string;
    name: string;
    imageUrl: string;
    /** Sunucunun SAHİBİ. Ray, sahip olunan sunucuyu çerçeveyle işaretler. */
    profileId?: string;
  };
  /** Rayda sunucu sırası. */
  order: number;
  /** Klasöre aitse klasör kimliği. */
  folderId: string | null;
  /** Klasör içindeki sıra. */
  orderInFolder: number | null;
}

/** `PATCH /api/members/[memberId]` — sunucuya özel profil alanları. */
export interface UpdateMemberProfileInput {
  nickname?: string | null;
  serverPronouns?: string | null;
  serverBio?: string | null;
  serverImageUrl?: string | null;
  serverBannerColor?: string | null;
}

/**
 * ciklet-web: `src/lib/direct.ts` → `getDirects()`
 *
 * ⚠️ SDK'daki `DirectWithProfiles` bu ucu YANLIŞ tarif ediyor: tam
 * `PublicProfile` vaat ediyor ama uç yalnızca beş alan seçiyor
 * (`presenceStatus`, `bannerColor`, `pronouns`, `bio`, `isBot` YOK).
 * Presence zaten soketten geliyor; liste için bu alanlara gerek de yok.
 * Tip burada gerçeğe göre daraltılır — aksi halde var olmayan alanlara
 * yaslanan arayüz sessizce boş render eder.
 */
export interface DirectPeer {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface DirectReadState {
  id: string;
  profileId: string;
  directId: string | null;
  channelId: string | null;
  messageId: string;
  lastReadAt: string;
}

export interface DirectSummary {
  id: string;
  profileOneId: string;
  profileTwoId: string;
  latestMessageId: string | null;
  /** Sıralama ve önizleme zamanı için; mesaj İÇERİĞİ bu uçta gelmez. */
  latestMessageAt: string | null;
  profileOne: DirectPeer;
  profileTwo: DirectPeer;
  /** Yalnızca oturum sahibinin okuma durumu (uç `where: { profileId }` ile filtreler). */
  readStates?: DirectReadState[];
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

/**
 * Zengin durum ("… oynuyor").
 * ciklet-web: `src/hooks/use-rich-presence.ts` → `RichPresenceActivity`.
 */
export type RichPresenceType =
  | "PLAYING"
  | "LISTENING"
  | "STREAMING"
  | "WATCHING"
  | "WORKING"
  | "CREATING"
  | "COMPETING";

export interface RichPresence {
  type?: RichPresenceType;
  name: string;
  details?: string;
  state?: string;
  processName?: string;
  /** Epoch ms — geçen süre bundan hesaplanır. */
  startedAt?: number;
  largeImageUrl?: string;
  smallImageUrl?: string;
  appIconUrl?: string;
  timestamps?: { start: number; end: number };
}

/** Üye listesi ekranlarında profil + presence birleştirilmiş görünüm. */
export interface MemberWithPresence extends MemberWithProfile {
  presence: PresenceEntry | undefined;
}
