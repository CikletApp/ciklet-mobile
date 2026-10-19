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
  content: string;
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
  // ── Üye kartı genişlemesi (ciklet-web, plan.md kategori 3) ──────────
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
  items: {
    id: string;
    kind: StoreItemKind;
    name: string;
    description: string;
    price: number;
    finalPrice: number;
    owned: boolean;
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
  parentChannelId?: string | null;
  archivedAt?: string | null;
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
  };
  roles: { id: string; name: string; color: string | null; hoist: boolean; position: number }[];
}

export interface ServerMembersPage {
  items: ServerMemberListItem[];
  nextCursor: string | null;
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
  latestMessageId: string | null;
  profileId: string;
  threadStarterMessageId: string | null;
}

/** ciklet-web: `GET /api/servers/[id]/threads` satırı (kenar listesi). */
export interface ServerThread {
  id: string;
  name: string;
  parentChannelId: string;
  latestMessageId: string | null;
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
  lastActivityMs: number;
  profile: { id: string; username: string; name: string | null; imageUrl: string | null };
}

export interface ForumResponse {
  tags: string[];
  canPost: boolean;
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
  status: ServerEventStatus;
  creator: { username: string; name: string | null; imageUrl: string | null } | null;
  interestedCount: number;
  interested: boolean;
}

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
