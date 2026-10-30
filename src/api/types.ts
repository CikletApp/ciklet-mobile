import type {
  Member,
  MemberWithProfile,
  PresenceStatus,
  PublicProfile,
} from "@ciklet/embedded-activities-sdk/types";

import type { NameStyle } from "@/lib/name-style";

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
  /** Yüklenen afiş görseli; yoksa `bannerColor` degradesi çizilir (2026-09-26 eki). */
  bannerUrl?: string | null;
  email: string | null;
  /** Ham numara sunucudan hiç çıkmaz; yalnızca maskeli hali gelir. */
  phoneMasked: string | null;
  isPhoneVerified: boolean;
  /**
   * Hesap telefon doğrulaması bekliyor mu (kayıtta dondurulur; root panelinden
   * kaldırılabilir). Eski sunucu göndermez (2026-09-27 eki).
   */
  phoneVerificationRequired?: boolean;
  dmPermission: "EVERYONE" | "FRIENDS_ONLY" | "NOBODY" | null;
  spamFilter: "ALL" | "NON_FRIENDS" | "NONE" | null;
  friendReqEveryone: boolean | null;
  friendReqFriendsOfFriends: boolean | null;
  friendReqServerMembers: boolean | null;
  eulaAccepted: boolean;
  updatedAt: string;
  /** Özel durum (2026-10 eki); okuyan taraf süresi dolmuşu eler. */
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  customStatusUntil?: string | null;
  gamesVisibility?: GamesVisibility;
  avatarDecorationId?: string | null;
  /** Mağaza kozmetikleri (web `toClientProfile`); kimlikler lib/profile-effects. */
  nameplateId?: string | null;
  profileEffectId?: string | null;
  /** Ad stili (lib/name-style; okuyan taraf `parseNameStyle`'dan geçirir). */
  nameStyle?: NameStyle | null;
}

/** `PATCH /api/current-profile` gövdesi — yalnızca gönderilen alanlar yazılır. */
export interface UpdateProfileInput {
  name?: string | null;
  pronouns?: string | null;
  bio?: string | null;
  bannerColor?: string | null;
  /** `https://` adres ya da `null` (afişi kaldırır). Yükleme: uploadthing `profileBanner`. */
  bannerUrl?: string | null;
  /** `null` → sunucu Multiavatar üretir. Aksi halde `https://` ile başlamalı. */
  imageUrl?: string | null;
  dmPermission?: CurrentProfile["dmPermission"];
  spamFilter?: CurrentProfile["spamFilter"];
  friendReqEveryone?: boolean;
  friendReqFriendsOfFriends?: boolean;
  friendReqServerMembers?: boolean;
  /** Özel durum: üçü birlikte gönderilir; `null` temizler (ISO bitiş). */
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  customStatusUntil?: string | null;
  /** Oyun koleksiyonunu kim görür. */
  gamesVisibility?: GamesVisibility;
  /** Avatar süsü kimliği (`lib/avatar-decorations`); Mentol/mağaza denetimi sunucuda. */
  avatarDecorationId?: string | null;
  /** Mağaza kozmetikleri — yalnızca sahip olunan ürün takılır. */
  nameplateId?: string | null;
  profileEffectId?: string | null;
  /** Ad stili; `null` kaldırır. Mentol/mağaza denetimi yalnızca DEĞİŞEN kimliklerde, sunucuda. */
  nameStyle?: NameStyle | null;
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
 * ama başlıklarını sunucudan okuyamıyor.
 */
export interface MembershipWithServer extends Member {
  server: {
    id: string;
    name: string;
    imageUrl: string;
    /** Sunucunun SAHİBİ. Ray, sahip olunan sunucuyu çerçeveyle işaretler. */
    profileId?: string;
    /** Toplam üye sayısı — uç gönderiyorsa. */
    memberCount?: number;
  };
  /** Rayda sunucu sırası. */
  order: number;
  /** Klasöre aitse klasör kimliği. */
  folderId: string | null;
  /** Klasör içindeki sıra. */
  orderInFolder: number | null;
  /** Bu sunucunun üyelerinden DM kabul edilsin mi. */
  allowServerDMs: boolean;
}

/** `PATCH /api/members/[memberId]` — sunucuya özel profil alanları. */
export interface UpdateMemberProfileInput {
  nickname?: string | null;
  serverPronouns?: string | null;
  serverBio?: string | null;
  serverImageUrl?: string | null;
  serverBannerColor?: string | null;
}

/** ciklet-web: `GET /api/sessions` */
export interface AccountSession {
  id: string;
  deviceToken: string;
  deviceName: string | null;
  osInfo: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  country?: string | null;
  clientType?: string | null;
  lastSeenAt: string;
  createdAt: string;
}

/** ciklet-web: `GET /api/oauth/authorized-apps` */
export interface AuthorizedApplication {
  id: string;
  applicationId: string;
  createdAt: string;
  scopes?: string[];
  application: {
    name: string;
    description: string | null;
    imageUrl: string | null;
    aboutUrl: string | null;
    privacyPolicyUrl: string | null;
    scopes: string[];
  };
}

/** Mobil sunucu ayarları için yetkili üyeye dönen ayrıntılar. */
export interface ServerDetails {
  id: string;
  name: string;
  imageUrl: string;
  bannerUrl: string | null;
  description: string | null;
  profileId: string;
  systemChannelId: string | null;
  /** AFK kanalı (boşta kalanlar buraya taşınır, konuşamaz); null = kapalı. */
  afkChannelId?: string | null;
  /** AFK zaman aşımı, saniye (lib/voice-settings AFK_TIMEOUT_OPTIONS). */
  afkTimeout?: number;
  isPublic: boolean;
  isDiscoverable: boolean;
  inviteCode: string;
  createdAt: string;
  /** Toplam üye sayısı — uç gönderiyorsa (sunucu özeti). */
  memberCount?: number;
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
  isOfficial?: boolean;
}

export interface DirectLatestMessage {
  id: string;
  /** Ek adreslerinden ayıklanmış önizleme metni (sunucu `lib/message-preview`). */
  content: string;
  /** Ek türü (`{ kind, durationMs?, name? }`); düz metin mesajında null/yok. */
  media?: unknown;
  fileUrl: string | null;
  profileId: string;
  type:
    | "DEFAULT"
    | "CALL_MISSED"
    | "CALL_STARTED"
    | "CALL_ENDED"
    | "ACTIVITY_INVITE"
    | "ACTIVITY_REPLY"
    /** "X bir mesajı sabitledi." — metadata.pinnedMessageId (sabitler v1). */
    | "MESSAGE_PINNED";
  deleted: boolean;
  createdAt: string;
}

/** Grup sohbetinin bir üyesi — `Direct.groupMembers` satırı. */
export interface DirectGroupMember {
  id: string;
  directId: string;
  profileId: string;
  joinedAt: string;
  profile: DirectPeer;
}

export interface DirectSummary {
  id: string;
  /**
   * ⚠️ GRUPTA ANLAMSIZ. ciklet-web grup satırlarında `profileOneId` ve
   * `profileTwoId` alanlarının İKİSİNİ DE sahibe bağlıyor
   * (`api/directs/groups/route.ts`): eski şemadaki iki zorunlu ilişki grup
   * üyeliği için kullanılmıyor ve sıradan bir üye hesabı silinince grubun
   * cascade ile gitmesini engellemek için sahibe sabitleniyorlar.
   *
   * Yani bir grupta bu iki alandan "karşı taraf" TÜRETİLEMEZ ve ikisi eşit
   * olduğu için grup, kendinle sohbetle karışır. Başlık/karşı taraf çözümü
   * için `useDirectDisplay` kullan — bu alanları doğrudan okuma.
   */
  profileOneId: string;
  profileTwoId: string;
  latestMessageId: string | null;
  /** Sıralama ve önizleme zamanı. */
  latestMessageAt: string | null;
  /** DM listesi için güvenli, daraltılmış son mesaj özeti (eski API'de olmayabilir). */
  latestMessage?: DirectLatestMessage | null;
  profileOne: DirectPeer;
  profileTwo: DirectPeer;

  // ── Grup sohbetleri ───────────────────────────────────────────────
  /** Grup mu, birebir mi. Alan yoksa birebir varsayılır (eski yanıtlar). */
  isGroup?: boolean;
  /** Grubun adı — kullanıcı ad vermediyse `null`; başlık üyelerden türetilir. */
  name?: string | null;
  /** Grubun avatarı. */
  imageUrl?: string | null;
  /** Grubu kuran profil; üye yönetimi yetkisi bunda. */
  ownerId?: string | null;
  /** Grup üyeleri, katılma sırasına göre. Birebir sohbette yok. */
  groupMembers?: DirectGroupMember[];

  /**
   * Oturum sahibinin bu sohbetteki okundu imleci — **snowflake string**.
   *
   * ADR-0002 ile okundu imleci mesajların yanına (MongoDB) taşındı; uç artık
   * `readStates` dizisi DEĞİL bu tek değeri döndürüyor
   * (`ciklet-web/src/lib/direct.ts`). Karşılaştırma `lib/snowflake.ts`
   * üzerinden yapılır — `Number`'a çevrilirse sessizce yuvarlanır.
   */
  readCursor?: string | null;
}

/**
 * ciklet-web: `src/lib/global-search.ts` — `GET /api/search?q=&scope=`.
 *
 * ⚠️ Uç 2026-09-25'te `{servers, channels, people}` yapısından tek düz
 * `{items}` listesine geçti (Ctrl/Cmd+K hızlı geçiş yeniden yazımı). Her
 * öğe `kind` ile ayrılır; kapsam `scope` parametresiyle daraltılır.
 */
export type SearchScope = "all" | "people" | "text" | "voice" | "servers";

export interface SearchProfileSlim {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

export interface SearchPerson extends SearchProfileSlim {
  kind: "person";
  isBot: boolean;
  isOfficial: boolean;
  /** Nereden tanıdığı: arkadaş, DM geçmişi ya da ortak sunucu. */
  relation: "friend" | "dm" | "member";
}

export interface SearchGroup {
  kind: "group";
  id: string;
  name: string;
  imageUrl: string | null;
  members: SearchProfileSlim[];
}

export interface SearchChannel {
  kind: "channel";
  id: string;
  name: string;
  type: "TEXT" | "AUDIO" | "VIDEO";
  server: { id: string; name: string; imageUrl: string };
}

export interface SearchServer {
  kind: "server";
  id: string;
  name: string;
  imageUrl: string;
}

export type SearchItem = SearchPerson | SearchGroup | SearchChannel | SearchServer;

export interface SearchResponse {
  items: SearchItem[];
}

/** ciklet-web: `src/app/api/unread-counts/route.ts` */
export interface UnreadCounts {
  channelUnreads: Record<string, { count: number; serverId: string }>;
  serverUnreads: Record<string, number>;
  /** Sohbet başına okunmamış sayısı. */
  directUnreads?: Record<string, number>;
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
  /**
   * FETCH_EXTERNAL izin listesi (ciklet-web c13ff2fc): "https origin + '/'
   * ile biten yol öneki" girdileri; yalnızca sunucuda ACTIVITY_FETCH_ALLOWLIST
   * yapılandırıldıysa gelir. Bkz. features/activities/bridge.ts.
   */
  fetchAllowlist?: string[] | null;
  /**
   * Aktivite menüsündeki "Yardım Merkezi": uygulamanın https destek adresi,
   * yoksa Ciklet'in GÖRELİ yardım yolu (`/docs/apps`) — API köküne eklenir.
   * Eski sunucu göndermez.
   */
  helpUrl?: string;
}

/** `GET /api/activities/invite` — "Arkadaşları Davet Et" hedefi (web lib/activity/invite). */
export interface ActivityInviteTarget {
  /** `direct:<id>` ya da `friend:<profileId>`. */
  key: string;
  kind: "direct" | "friend";
  directId: string | null;
  profileId: string | null;
  isGroup: boolean;
  name: string;
  username: string | null;
  imageUrl: string | null;
  members: { id: string; username: string; name: string | null; imageUrl: string | null }[];
  memberCount: number;
  /** false → alıcılardan biri oturumun sohbetine erişemiyor; seçilemez. */
  eligible: boolean;
}

export type ActivityInviteOriginKind = "channel" | "group" | "direct";

export interface ActivityInviteListResponse {
  activity: { id: string; name: string; icon: string };
  origin: { kind: ActivityInviteOriginKind; label: string | null };
  maxTargets: number;
  targets: ActivityInviteTarget[];
}

export interface ActivityInviteSendResponse {
  sent: number;
  results: { key: string; directId?: string; messageId?: string; error?: string }[];
}

/** `GET /api/activities/session?chatId=` — davet kartından katılma. */
export interface ActivitySessionResponse {
  activity: { id: string; name: string; url: string; icon: string; helpUrl: string };
  chat: {
    id: string;
    type: "channel" | "direct";
    serverId: string | null;
    isGroup: boolean;
    peerId: string | null;
    label: string | null;
    path: string;
  };
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
  /** Büyük/küçük görselin açıklaması (Discord uyumlu; aktivite SDK'sı ve masaüstü RPC). */
  largeText?: string;
  smallText?: string;
  appIconUrl?: string;
  timestamps?: { start: number; end: number };
  /** Yalnızca `STREAMING`: bağlı hesap yayını (Twitch/Kick); `state` yayının kategorisi. */
  platform?: "twitch" | "kick" | "youtube";
  /**
   * Yalnızca `STREAMING`: kanal adresi ("Yayını İzle"). Açmadan önce
   * `streamWatchUrl` (lib/activity-broadcast) ile denetlenir — gövde
   * istemciden de gelebilir.
   */
  url?: string;
  channel?: string;
  viewerCount?: number;
  /**
   * Yalnızca `STREAMING`: yayıncının masaüstünden bildirdiği oyun (sunucu
   * birleştirir; ciklet-web lib/streaming/activity → withStreamGame). Varsa
   * "<oyun> yayını yapıyor" bu addan, `gameIconUrl` oyunun görseli.
   */
  game?: string;
  gameIconUrl?: string;
  /**
   * Yalnızca oyun: oyunla aynı anda bir yayın programı (OBS…) açık (web
   * istemcisi koyar) → "<oyun> yayını yapıyor" (lib/activity-broadcast).
   */
  broadcasting?: boolean;
  /** Bot etkinliği (ağ geçidi basar). */
  bot?: boolean;
  /**
   * Etkinliğin kaynağı telefon ise `"mobile"` (bkz. features/presence/
   * media-activity). Masaüstü ve web göndermiyor; yoksa masaüstü/web sayılır.
   */
  device?: string;
  /**
   * Discord uyumlu RPC etkinliği (masaüstü köprüsü). Çizmeden önce
   * lib/activity-party ile denetlenir — gövde istemciden geliyor.
   * `applicationId`: RPC uygulama kimliği; `partySize` [şu an, en çok] →
   * "(2/4)"; `buttons` en çok 2 bağlantı düğmesi (yalnızca başkasına
   * çizilir); `joinable` katılınabilir (masaüstündeki "Katıl"; mobilde
   * düğme yok). Katılma sırrı hiçbir zaman burada değil.
   */
  applicationId?: string;
  partySize?: [number, number];
  buttons?: { label: string; url: string }[];
  joinable?: boolean;
}

/** Üye listesi ekranlarında profil + presence birleştirilmiş görünüm. */
export interface MemberWithPresence extends MemberWithProfile {
  presence: PresenceEntry | undefined;
}

// ── Mesaj iletme ────────────────────────────────────────────────────

/**
 * ciklet-web: `GET /api/forward/targets` — mesaj İLETİLEBİLECEK sunucu
 * kanalları. Yalnızca görünür + yazılabilir METİN kanalları döner; DM
 * hedefleri istemcide zaten yüklü olan sohbet listesinden gelir.
 */
export interface ForwardTargetServer {
  id: string;
  name: string;
  imageUrl: string;
  channels: { id: string; name: string }[];
}

export interface ForwardTargetsResponse {
  servers: ForwardTargetServer[];
}

// ── Üye kartı ───────────────────────────────────────────────────────

/**
 * ciklet-web: `GET /api/profile/[profileId]/card` — sohbette nick/avatara
 * dokununca açılan üye kartının verisi. `profile`, `PROFILE_PUBLIC_SELECT`
 * alt kümesidir (bio/pronouns/bannerColor dahil).
 */
export interface ProfileCardResponse {
  profile: PublicProfile & {
    bannerColor?: string | null;
    /** Yüklenen afiş görseli; öncelik görselde, yoksa renk (web ile aynı kural). */
    bannerUrl?: string | null;
    isOfficial?: boolean;
    avatarDecorationId?: string | null;
    customStatusText?: string | null;
    customStatusEmoji?: string | null;
    customStatusUntil?: string | null;
    nameplateId?: string | null;
    profileEffectId?: string | null;
    nameStyle?: NameStyle | null;
  };
  isSelf: boolean;
  /** Mentol planı — rozet metni istemcide eşlenir. */
  plan: "FREE" | "PLUS" | "PRO";
  /** Planın rozet hakkı var mı (`PLAN_FEATURES[plan].badge`). */
  badge: boolean;
  friendship: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "BLOCKED";
    profileOneId: string;
    blockedById: string | null;
    /** Arkadaşlığın başladığı an; eski satırlarda yoksa `createdAt`. */
    acceptedAt?: string | null;
    createdAt?: string;
  } | null;
  mutualFriendsCount: number;
  mutualFriends: SearchProfileSlim[];
  // ── Üye kartı genişlemesi ──────────
  /** Türetilmiş rozetler (`lib/profile-badges`); sunucu üretir, istemci çizer. */
  badges?: ProfileBadge[];
  /** İkisinin de görünür üye olduğu sunucular (en çok 50). */
  mutualServers?: { id: string; name: string; imageUrl: string | null }[];
  /** Son 7 günün etkinlikleri, en yeni önce (en çok 10). */
  recentActivity?: ProfileActivitySession[];
  /** Oyun koleksiyonu; görünürlük kapalıysa iki liste de boş gelir. */
  collection?: { games: ProfileGameView[]; programs: ProfileGameView[] };
  /** Görünür bağlantılar (kendi kartında hepsi). */
  connections?: ProfileConnectionView[];
  /**
   * Favori oyun (ciklet-web lib/favorite-game): koleksiyonla aynı süzgeçten
   * geçmiş satır + etiket; yoksa / gizliyse null. Eski sunucuda alan yok.
   */
  favoriteGame?: FavoriteGameView | null;
}

export type ProfileBadgeId =
  | "official"
  | "bot"
  | "developer"
  | "mentol_plus"
  | "mentol_pro"
  | "early_member";

export interface ProfileBadge {
  id: ProfileBadgeId;
  label: string;
  description: string;
}

/** ciklet-web: `ActivitySession` satırı (kart ucu seçimi). */
export interface ProfileActivitySession {
  id: string;
  type: string;
  name: string;
  details: string | null;
  largeImageUrl: string | null;
  appIconUrl: string | null;
  startedAt: string;
  lastSeenAt: string;
  /** `null` → oturum hâlâ sürüyor. */
  endedAt: string | null;
}

export type GamesVisibility = "EVERYONE" | "FRIENDS" | "NOBODY";

/** ciklet-web: `lib/profile-games.ts` → `ProfileGameView`. */
export interface ProfileGameView {
  name: string;
  type: string;
  playtimeMs: number;
  sessionCount: number;
  lastPlayedAt: string;
  coverUrl: string | null;
  iconUrl: string | null;
  hidden: boolean;
}

/** Kart yanıtındaki `favoriteGame` (web `FavoriteGameView`). */
export interface FavoriteGameView extends ProfileGameView {
  /** `FAVORITE_GAME_TAGS` kimliği ya da null. */
  tag: string | null;
  /** Etiketin Türkçe metni — sunucu verir, istemci sözlük taşımaz. */
  tagLabel: string | null;
}

/** `GET /api/profile/games` satırı — kendi koleksiyonun (gizliler dahil). */
export interface OwnProfileGame extends ProfileGameView {
  /** Ciklet tanıyor mu; tanınmayan oyun profilde görünmez. */
  recognized?: boolean;
  /** Favori satırda true; etiket de onunla gelir. */
  favorite?: boolean;
  favoriteTag?: string | null;
}

export type ConnectionType =
  | "steam"
  | "epic"
  | "xbox"
  | "playstation"
  | "riot"
  | "twitch"
  | "youtube"
  | "instagram"
  | "x"
  | "github"
  | "spotify";

/** ciklet-web: `GET/PUT /api/profile/connections` ve kart ucu. */
export interface ProfileConnectionView {
  type: ConnectionType;
  handle: string;
  /** Tıklanabilir dış adres; bazı platformlarda yok. */
  url: string | null;
  verified: boolean;
  visible: boolean;
}

// ── Profil ek açıklamaları ──────────────────────────────────────────

/**
 * ciklet-web: `GET /api/profile-annotations` + `PUT …/[profileId]`.
 * Kullanıcının başkaları hakkında tuttuğu ÖZEL kayıtlar: kişisel not,
 * arkadaş takma adı, yok say. Karşı taraf bu kayıtları hiçbir yolla göremez.
 */
export interface ProfileAnnotation {
  nickname: string | null;
  note: string | null;
  ignored: boolean;
}

export interface ProfileAnnotationEntry extends ProfileAnnotation {
  targetId: string;
}

/** PUT gövdesi bir YAMA: gönderilmeyen alan korunur, null/boş temizler. */
export type ProfileAnnotationPatch = Partial<ProfileAnnotation>;

// ── Keşfet ──────────────────────────────────────────────────────────

/**
 * ciklet-web: `GET /api/discover/servers` — mobil için istenen JSON ucu
 * (web'deki /discover sayfaları SSR; sözleşme ciklet-web oturumuyla
 * SendMessage üzerinden kararlaştırıldı, 2026-09-25).
 */
export interface DiscoverServerItem {
  id: string;
  name: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  memberCount: number;
  onlineCount: number | null;
  isMember: boolean;
}

/**
 * ciklet-web: `GET /api/discover/apps` (src/lib/discover/apps.ts).
 * Listeleme kuralı: (activityUrl dolu VE reviewStatus APPROVED) VEYA bot
 * ilişkisi olan uygulamalar; sıra isVerified desc, createdAt desc.
 */
export interface DiscoverAppItem {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  /** Uygulamanın COVER (yoksa BACKGROUND) görseli. */
  bannerUrl: string | null;
  isVerified: boolean;
  botUsername: string | null;
  isActivity: boolean;
  hasBot: boolean;
}

/**
 * Sabitleme alanları — ciklet-web sabitlenen mesajlar sözleşmesi v1
 * (ciklet-web-37, 2026-09-27). `GET /api/messages`, `/api/direct-messages`,
 * `message.update`, gönderim yanıtları ve sabit listesi bu iki alanı taşır;
 * canlı `message.create` zarfında YOK (yeni mesaj sabitlenmemiş sayılır).
 * SDK tiplerinde olmadığı için ayrı tanımlı; okumak için
 * `features/chat/pins.ts` → `pinnedAtOf`.
 */
export interface PinnedByProfile {
  id: string;
  /** Sabitleyenin hesabı silinmişse "" — "bir kullanıcı" gösterilir. */
  username: string;
  name: string | null;
  imageUrl: string | null;
  isBot?: boolean;
  isOfficial?: boolean;
}

export interface PinFields {
  pinnedAt?: string | null;
  pinnedBy?: PinnedByProfile | null;
}

// ── Spotify ─────────────────────────────────────────────────────────

/** ciklet-web: `lib/spotify-sync.ts` → `NowPlaying`. */
export interface SpotifyNowPlaying {
  isPlaying: boolean;
  uri: string;
  title: string;
  artists: string;
  album: string;
  imageUrl: string | null;
  url: string | null;
  progressMs: number;
  durationMs: number;
  /** Yanıtın sunucuda alındığı an (ms); ilerleme bununla ileri sarılır. */
  fetchedAt: number;
}

/** ciklet-web: `GET /api/connections/spotify` — oturum sahibinin bağlantısı. */
export interface SpotifyLinkStatus {
  configured: boolean;
  linked: boolean;
  displayName: string | null;
  premium: boolean;
}

/**
 * ciklet-web: `POST /api/spotify/listen-along` yanıtı. `state`:
 * playing | host_paused | no_device | premium_required | not_linked |
 * hidden | failed | rate_limited | stopped.
 */
export interface ListenAlongResponse {
  state: string;
  track?: SpotifyNowPlaying;
}

// ── Yer imleri, bahsetmeler, mesaj istekleri ───────────────────────

/** ciklet-web: `GET /api/bookmarks` (hidrasyonlu liste) satırı. */
export interface BookmarkEntry {
  messageId: string;
  content: string;
  fileUrl: string | null;
  createdAt: string;
  savedAt: string;
  author: SearchProfileSlim | null;
  scope: "channel" | "direct";
  /** Kanal kimliği ya da DM kimliği. */
  chatId: string;
  channelName: string | null;
  serverName: string | null;
  /** Web adresi; mobil kendi rotasını `scope` + `chatId`'den kurar. */
  url: string;
  /** Kurulu hatırlatıcı (ISO) — "Bana hatırlat"; eski sunucuda alan yok. */
  remindAt?: string | null;
  /** Son hatırlatmanın gönderildiği an. */
  remindedAt?: string | null;
}

/** ciklet-web: `GET /api/bookmarks?idsOnly=1`. */
export interface BookmarkIdsResponse {
  ids: string[];
  /** Mesaj kimliği → hatırlatıcı anı (ISO). */
  reminders?: Record<string, string>;
}

/** ciklet-web: `GET /api/profile-annotations?ignored=1` satırı. */
export interface IgnoredUser {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  ignoredAt: string;
}

/** ciklet-web: `GET/PATCH /api/servers/:id/sidebar-preferences`. */
export interface SidebarPreferences {
  hideMutedChannels: boolean;
  hiddenChannelIds: string[];
}

/** ciklet-web: `GET /api/mentions` satırı (son 7 gün, kanal mesajları). */
export interface MentionEntry {
  messageId: string;
  content: string;
  createdAt: string;
  author: SearchProfileSlim | null;
  channelId: string;
  channelName: string;
  serverId: string;
  serverName: string;
  url: string;
}

/**
 * ciklet-web: `GET /api/calls/history` satırı. `category` bakanın gözünden:
 * gelen (cevaplanan), giden (cevaplansın ya da cevaplanmasın), cevapsız,
 * reddedilen. `peer` her zaman karşı taraf.
 */
export interface CallHistoryItem {
  id: string;
  callId: string;
  kind: "audio" | "video";
  direction: "incoming" | "outgoing";
  category: "incoming" | "outgoing" | "missed" | "declined";
  answered: boolean;
  outcome: "ANSWERED" | "MISSED" | "DECLINED" | "CANCELLED";
  directId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSecs: number | null;
  peer: { id: string; username: string; name: string | null; imageUrl: string | null };
}

export interface CallHistoryPage {
  items: CallHistoryItem[];
  nextCursor: string | null;
}

/** ciklet-web: `GET /api/directs/requests` satırı. */
export interface MessageRequestEntry {
  directId: string;
  other: SearchProfileSlim;
  /** Okunmamış mesaj sayısı (0 olanlar listelenmez). */
  count: number;
}

// ── Mağaza ve abonelikler ──────────────────────────────────────────

export type StoreItemKind = "decoration" | "nameplate" | "effect";

/** ciklet-web: `GET /api/store`. Fiyatlar TL ana birim. */
export interface StoreCatalogResponse {
  currency: string;
  mentol: boolean;
  discountPercent: number;
  /** Ödeme sağlayıcısı yapılandırılmamışsa satın alma kapalı. */
  purchasable: boolean;
  /**
   * Ücretsiz mağaza modu (web STORE_FREE_MODE): her ürün `POST /api/store/claim`
   * ile ücretsiz alınır; `finalPrice` 0, `price` liste fiyatı. Eski sunucuda yok.
   */
  free?: boolean;
  items: {
    id: string;
    kind: StoreItemKind;
    name: string;
    description: string;
    price: number;
    finalPrice: number;
    owned: boolean;
    free?: boolean;
  }[];
  equipped: {
    decoration: string | null;
    nameplate: string | null;
    effect: string | null;
  };
}

/** ciklet-web: `GET /api/servers/[id]/subscription-tiers`. */
export interface ServerTiersResponse {
  manager: boolean;
  tiers: {
    id: string;
    name: string;
    description: string | null;
    /** TL ana birim (uç kuruştan çevirir). */
    price: number;
    active: boolean;
    role: { id: string; name: string; color: string | null } | null;
    subscriberCount?: number;
  }[];
  mine: { tierId: string; status: string; expiresAt: string } | null;
}

/** Ödeme ucu yanıtı — ödeme sayfası `/mentol/odeme/[paymentId]`. */
export interface CheckoutResponse {
  paymentId: string;
}

// ── Kanal ek alanları ───────────────────────────────────────────────

/**
 * ciklet-web: `GET /api/channels?serverId=` Prisma satırını olduğu gibi
 * döndürür; SDK'nın `Channel` tipinde olmayan kanal bayrakları burada.
 * Hepsi isteğe bağlı: eski sunucu yanıtı ya da kalıcı önbellek taşımayabilir.
 */
export interface ChannelExtras {
  topic?: string | null;
  /** Yaş sınırlı kanal — ilk açılışta perde. */
  nsfw?: boolean;
  /** Yalnızca ekli mesaj kabul eden kanal (galeri görünümü). */
  mediaOnly?: boolean;
  /** Sahne kanalı (yalnızca AUDIO). */
  stage?: boolean;
  /** Forum kanalı: doğrudan yazılmaz, her gönderi bir alt başlık. */
  forum?: boolean;
  forumTags?: string[];
  announcement?: boolean;
  /** Ses kanalı durumu — kanal listesinde adın altında. */
  voiceStatus?: string | null;
  /** Ses kanalı kullanıcı sınırı; 0 = sınırsız (lib/voice-settings). */
  userLimit?: number;
  /** Ses bit hızı (bps). */
  bitrate?: number;
  /** Kamera kalitesi: "auto" | "full" (720p). */
  videoQualityMode?: string;
  parentChannelId?: string | null;
  archivedAt?: string | null;
  /** Kilitli alt başlık: yalnızca "Alt Başlıkları Yönet" yazar (web lib/threads). */
  locked?: boolean;
  /** Forumun en üstüne sabitli gönderi (web lib/forum). */
  forumPinned?: boolean;
}

// ── Sunucu izinleri ve moderasyon ───────────────────────────────────

/** ciklet-web: `GET /api/servers/[id]/my-permissions` */
export interface MyServerPermissions {
  isOwner: boolean;
  memberRole: "ADMIN" | "MODERATOR" | "GUEST" | null;
  topPosition: number;
  /** BigInt'in ondalık metni. */
  permissions: string;
  /** Açık izin bitlerinin adları (`BotPermissions` anahtarları). */
  keys: string[];
}

/** ciklet-web: `lib/server-members.ts` → `ServerMemberListItem` (sayfalı üye listesi). */
export interface ServerMemberListItem {
  id: string;
  role: "ADMIN" | "MODERATOR" | "GUEST";
  profileId: string;
  serverId: string;
  nickname: string | null;
  /** Etkin zaman aşımı bitişi (ISO) ya da null. */
  timedOutUntil: string | null;
  serverImageUrl: string | null;
  profile: {
    id: string;
    username: string;
    name: string | null;
    imageUrl: string | null;
    isBot: boolean;
    /** Mağaza isim plakası (lib/profile-effects NAMEPLATES). */
    nameplateId?: string | null;
    /** Özel durum (lib/custom-status); eski sunucuda alan yok. */
    customStatusText?: string | null;
    customStatusEmoji?: string | null;
    customStatusUntil?: string | null;
  };
  roles: {
    id: string;
    name: string;
    color: string | null;
    hoist: boolean;
    position: number;
    /** Rol simgesi (web Role.iconUrl / iconEmoji); eski sunucuda yok. */
    iconUrl?: string | null;
    iconEmoji?: string | null;
  }[];
}

export interface ServerMembersPage {
  items: ServerMemberListItem[];
  nextCursor: string | null;
}

/** ciklet-web: denetim kaydında işlem yapan kişi (`audit-logs/actors` ve kayıt satırı). */
export interface AuditLogActor {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
}

/** ciklet-web: `GET /api/servers/[id]/audit-logs` satırı. */
export interface AuditLogEntry {
  id: string;
  serverId: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  /** Sebep (`reason` gövdesi ya da `X-Audit-Log-Reason`); eski kayıtlarda `details.reason`. */
  reason: string | null;
  createdAt: string;
  actor: AuditLogActor | null;
}

/** ciklet-web: `GET /api/servers/[id]/rules` */
export interface ServerRulesState {
  required: boolean;
  text: string | null;
  serverName: string;
  acceptedAt: string | null;
  /** Bu üye kabul etmeden yazamaz mı (sahip/yönetici muaf). */
  pending: boolean;
}

// ── Alt başlıklar ve forum ──────────────────────────────────────────

/** ciklet-web: `GET /api/channels/[id]/threads` satırı. */
export interface ThreadSummary {
  id: string;
  name: string;
  createdAt: string;
  archivedAt: string | null;
  /** Kilitli (web lib/threads); eski sunucuda yok. */
  locked?: boolean;
  /** Forum gönderisi forumun en üstüne sabitli; eski sunucuda yok. */
  forumPinned?: boolean;
  latestMessageId: string | null;
  profileId: string;
  threadStarterMessageId: string | null;
  /** Özel alt başlık: yalnızca üyeler + moderatörler görür; eski sunucuda yok. */
  private?: boolean;
  /** Özel alt başlıkta herkes davet edebilir mi; eski sunucuda yok. */
  invitable?: boolean;
  /** Oturum sahibi takip ediyor (üye); eski sunucuda yok. */
  joined?: boolean;
}

/** ciklet-web: `GET /api/channels/[id]/thread-members` (lib/server/thread-members). */
export interface ThreadMembersState {
  threadId: string;
  private: boolean;
  invitable: boolean;
  ownerId: string;
  joined: boolean;
  canJoin: boolean;
  canAdd: boolean;
  canManage: boolean;
  canEditInvitable: boolean;
  members: {
    profileId: string;
    memberId: string;
    joinedAt: string;
    username: string;
    name: string | null;
    imageUrl: string | null;
    nickname: string | null;
    isBot: boolean;
  }[];
}

/** ciklet-web: `GET /api/servers/[id]/threads` satırı (kenar listesi). */
export interface ServerThread {
  id: string;
  name: string;
  parentChannelId: string;
  latestMessageId: string | null;
  /** Kilitli (web lib/threads); eski sunucuda yok. */
  locked?: boolean;
  /** Özel alt başlık; eski sunucuda yok. */
  private?: boolean;
}

/** ciklet-web: `GET /api/channels/[id]/forum` gönderisi. */
export interface ForumPost {
  id: string;
  name: string;
  /** İlk mesajdan özet. */
  topic: string | null;
  appliedTags: string[];
  createdAt: string;
  latestMessageId: string | null;
  archivedAt: string | null;
  /** Forumun en üstüne sabitli (forum başına bir); eski sunucuda yok. */
  pinned?: boolean;
  /** Kilitli: yalnızca alt başlıkları yönetebilenler yazar. */
  locked?: boolean;
  lastActivityMs: number;
  profile: { id: string; username: string; name: string | null; imageUrl: string | null };
}

export interface ForumResponse {
  tags: string[];
  canPost: boolean;
  /** "Alt Başlıkları Yönet" (sabitle / kilitle / moderasyonlu etiket). */
  canModerate?: boolean;
  posts: ForumPost[];
}

// ── Zamanlanmış etkinlikler ─────────────────────────────────────────

export type ServerEventStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELED";

/** ciklet-web: `lib/server-events/present.ts` → `presentEvent`. */
export interface ServerEventItem {
  id: string;
  serverId: string;
  channelId: string | null;
  channelName: string | null;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  /** null → tekrarlanmaz (web `lib/server-events/recurrence`). */
  recurrenceRule?: RecurrenceRule | null;
  /** 16:9 kapak görseli. */
  coverImageUrl?: string | null;
  status: ServerEventStatus;
  creator: { username: string; name: string | null; imageUrl: string | null } | null;
  interestedCount: number;
  interested: boolean;
}

/** Discord `recurrence_rule` alt kümesi; günler 0 = Pazartesi … 6 = Pazar. */
export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  byWeekday?: number[];
  byNWeekday?: { n: number; day: number }[];
  byMonth?: number[];
  byMonthDay?: number[];
  /** IANA saat dilimi; yoksa sunucu Europe/Istanbul varsayar. */
  timeZone?: string;
}

export type RecurrencePresetId =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthlyNth"
  | "monthlyDate"
  | "yearly";

// ── Soundboard ──────────────────────────────────────────────────────

/** ciklet-web: `ServerSound` satırı (`GET /api/servers/[id]/sounds`). */
export interface ServerSoundItem {
  id: string;
  serverId: string;
  name: string;
  emoji: string | null;
  audioUrl: string;
  /** Yüzde 0–200; çalan taraf uygular. */
  volume: number;
}
