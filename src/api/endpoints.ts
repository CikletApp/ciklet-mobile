/**
 * ciklet-web uç noktalarının TEK kaynağı.
 *
 * Rota yolları kod tabanına string olarak dağılmaz; web tarafında bir yol
 * değişirse yalnızca burası güncellenir. Sorgu parametreleri burada
 * kodlanır — çağrı yerlerinde `encodeURIComponent` unutulması sınıfı hata
 * ortadan kalkar.
 */

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export const endpoints = {
  // ── Kimlik ────────────────────────────────────────────────────────
  auth: {
    login: "/api/mobile/auth",
    refresh: "/api/mobile/auth/refresh",
  },

  /** Expo push cihaz kaydı ve tercih güncellemesi. */
  pushRegister: "/api/push/register",

  // ── Profil ────────────────────────────────────────────────────────
  currentProfile: "/api/current-profile",
  appearance: "/api/appearance",
  accountUsername: "/api/account/username",
  accountEmail: "/api/account/email",
  accountTwoFactor: "/api/account/two-factor",
  changePassword: "/api/auth/change-password",
  accountStatus: "/api/account-status",
  /** Son Kullanıcı Sözleşmesi onayı (POST). */
  eula: "/api/eula",
  /** Telegram doğrulama botuna tek kullanımlık bağlantı (kısıtlı oturumla da açık). */
  phoneTelegramStart: "/api/phone/telegram/start",
  mentolPlan: "/api/mentol/me",
  mentolRedeem: "/api/mentol/redeem",
  /** GET mağaza içi abonelik bilgisi (açık mağazalar, ürünler, hesap belirteci, etkin abonelik). */
  mentolIap: "/api/mentol/iap",
  /** POST mağaza satın alması doğrulama → güncel plan (`/api/mentol/me` biçimi) + `store`. */
  mentolIapVerify: "/api/mentol/iap/verify",
  /** Ödüllü reklam durumu (GET) ve tek kullanımlık SSV nonce'u (POST). */
  rewardedAds: "/api/ads/rewarded",
  rewardedAdsSession: "/api/ads/rewarded/session",
  sessions: "/api/sessions",
  session: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}`,
  authorizedApps: "/api/oauth/authorized-apps",

  // ── Sunucular ─────────────────────────────────────────────────────
  /**
   * ⚠️ YALNIZCA POST (sunucu oluşturma). ciklet-web'de bu yolun GET
   * handler'ı YOK — istek 405 döner. Kullanıcının sunucu listesi
   * `myMemberships` ucundan gelir.
   */
  createServer: "/api/servers",
  server: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}`,
  serverLeave: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/leave`,
  serverJoin: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/join`,
  serverActivities: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/activities`,
  /**
   * GET: kanalda "/" önerileri — `{ bots: [{ id, applicationId, name,
   * username, imageUrl, commands: [{ name, description }] }] }`. Kanalı
   * göremeyen botlar sunucuda elenir; bu yüzden `channelId` her zaman gider.
   */
  botCommands: (serverId: string, channelId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/bot-commands${qs({ channelId })}`,
  invite: (code: string) => `/api/i/${encodeURIComponent(code)}`,

  // ── Sunucu klasörleri ─────────────────────────────────────────────
  /** GET: klasörler (ad, renk, sıra). ciklet-web'e mobil için eklendi. */
  folders: "/api/folders",
  folder: (folderId: string) => `/api/folders/${encodeURIComponent(folderId)}`,
  /** PATCH `{ serverIds }` — klasör İÇİNDEKİ sıra. */
  folderReorder: (folderId: string) =>
    `/api/folders/${encodeURIComponent(folderId)}/reorder`,
  folderAdd: (folderId: string) =>
    `/api/folders/${encodeURIComponent(folderId)}/add`,
  folderRemove: (folderId: string) =>
    `/api/folders/${encodeURIComponent(folderId)}/remove`,
  /** PATCH `{ items: [{type:'folder'|'server', id}] }` — kök sıralama. */
  sidebarReorder: "/api/sidebar/reorder",
  /** PATCH `{ serverIds }` — klasörsüz sunucuların sırası. */
  serversReorder: "/api/servers/reorder",

  // ── Üyelikler ─────────────────────────────────────────────────────
  /** Kullanıcının sunucu listesinin TEK kaynağı (server alanı gömülü gelir). */
  myMemberships: "/api/members/mine",
  /** Bir sunucunun görünür üyeleri (hayalet üyelikler hariç). */
  serverMembers: (serverId: string) => `/api/members${qs({ serverId })}`,
  member: (memberId: string) => `/api/members/${encodeURIComponent(memberId)}`,

  // ── Kanallar ──────────────────────────────────────────────────────
  /** Bir sunucunun kanalları. `serverId` zorunlu; üyelik sunucuda denetlenir. */
  serverChannels: (serverId: string) => `/api/channels${qs({ serverId })}`,
  createChannel: (serverId: string) => `/api/channels${qs({ serverId })}`,
  channel: (channelId: string) => `/api/channels/${encodeURIComponent(channelId)}`,
  manageChannel: (channelId: string, serverId: string) =>
    `/api/channels/${encodeURIComponent(channelId)}${qs({ serverId })}`,

  // ── Doğrudan mesajlar (1:1) ───────────────────────────────────────
  directs: "/api/directs",
  direct: (directId: string) => `/api/directs/${encodeURIComponent(directId)}`,
  directExpiry: (directId: string) => `/api/directs/${encodeURIComponent(directId)}/expiry`,
  directInit: "/api/directs/init",

  /**
   * Grup sohbetleri.
   *
   * POST `{ memberIds, name? }` — yalnızca ARKADAŞLAR eklenebilir ve toplam
   * kişi sayısı 10'u aşamaz; uç ikisini de zorluyor.
   * PATCH `{ name?, memberIds? }` — yalnızca GRUP SAHİBİ çağırabilir ve
   * `memberIds` fark değil TAM LİSTEDİR.
   *
   * Not: gruptan ayrılmak için ayrı bir uç YOK; `DELETE /api/directs/[id]`
   * grup satırında "ayrıl" anlamına gelir.
   */
  createGroupDirect: "/api/directs/groups",
  groupDirect: (directId: string) =>
    `/api/directs/groups/${encodeURIComponent(directId)}`,

  // ── Mesaj geçmişi ─────────────────────────────────────────────────
  channelMessages: (channelId: string, cursor?: string) =>
    `/api/messages${qs({ channelId, cursor })}`,
  directMessages: (directId: string, cursor?: string) =>
    `/api/direct-messages${qs({ directId, cursor })}`,

  /**
   * Mesaj gönderimi Socket.IO sunucusunun HTTP ucundan geçer — kaydı yapar
   * ve odaya yayınlar. Web istemcisiyle birebir aynı uç.
   */
  sendChannelMessage: (channelId: string, serverId: string) =>
    `/api/socket/messages${qs({ channelId, serverId })}`,
  sendDirectMessage: (directId: string) =>
    `/api/socket/direct-messages${qs({ directId })}`,
  editChannelMessage: (messageId: string, channelId: string, serverId: string) =>
    `/api/socket/messages/${encodeURIComponent(messageId)}${qs({ channelId, serverId })}`,
  editDirectMessage: (directMessageId: string, directId: string) =>
    `/api/socket/direct-messages/${encodeURIComponent(directMessageId)}${qs({ directId })}`,
  reactions: "/api/socket/reactions",
  reports: "/api/reports",

  // ── Sohbet zenginleştirmeleri (rol pili, sunucu emojisi, çıkartma) ──
  /** GET: sunucunun rolleri `[{ id, name, color, position, … }]` (üyelik ister). */
  serverRoles: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/roles`,
  /** GET: sunucu emojileri `[{ id, name, imageUrl }]` — `<:ad:id>` belirteci. */
  serverEmojis: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/emojis`,
  /** GET: sunucu çıkartmaları `[{ id, name, description, imageUrl }]`. */
  serverStickers: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/stickers`,
  /**
   * POST: eğik çizgi komutu `{ botId, name, args }` ya da bileşen (type 3)
   * `{ messageId, customId, values? }` → `{ id }`. GET `…/interactions/{id}`
   * → `{ status }` (3 sn sonra hâlâ PENDING ise bot yanıt vermedi).
   */
  channelInteractions: (channelId: string) =>
    `/api/channels/${encodeURIComponent(channelId)}/interactions`,
  channelInteraction: (channelId: string, interactionId: string) =>
    `/api/channels/${encodeURIComponent(channelId)}/interactions/${encodeURIComponent(interactionId)}`,
  /** POST `{ chatId, scope, optionIds }` — anket oyu. */
  pollVote: (messageId: string) => `/api/messages/${encodeURIComponent(messageId)}/poll/vote`,

  // ── Sabitlenen mesajlar ───────────────────────────────────────────
  /**
   * POST sabitler, DELETE kaldırır; yanıt güncel mesaj. İdempotent. Hatalar:
   * 403 yetki yok, 409 `PIN_LIMIT` (sohbet başına 50), 422 `NOT_PINNABLE`
   * (arama/süre/sabit sistem satırları). Kanalda yetki sunucu ADMIN/MODERATOR
   * ya da "Mesajları Yönet"; DM ve grupta her katılımcı.
   */
  pinChannelMessage: (messageId: string, channelId: string) =>
    `/api/messages/${encodeURIComponent(messageId)}/pin${qs({ channelId })}`,
  pinDirectMessage: (messageId: string, directId: string) =>
    `/api/direct-messages/${encodeURIComponent(messageId)}/pin${qs({ directId })}`,
  /** `{ items }` — en son sabitlenen başta, en çok 50, sayfalama yok. */
  channelPins: (channelId: string) => `/api/messages/pins${qs({ channelId })}`,
  directPins: (directId: string) => `/api/direct-messages/pins${qs({ directId })}`,

  // ── Arkadaşlar ────────────────────────────────────────────────────
  friends: "/api/friends",
  friend: (friendId: string) => `/api/friends/${encodeURIComponent(friendId)}`,
  friendBlock: "/api/friends/block",

  // ── Keşif / okunmamış ─────────────────────────────────────────────
  /** `scope` boşsa "all" — bkz. `SearchScope` (api/types.ts). */
  search: (q: string, scope?: string) => `/api/search${qs({ q, scope })}`,
  /**
   * DM sohbetinin İÇİNDE arama. En az bir ölçüt zorunlu (yalnızca
   * `directId` göndermek 400 döner); `order` newest (varsayılan) | oldest.
   */
  directMessageSearch: (
    directId: string,
    params: { q?: string; cursor?: string; order?: "newest" | "oldest" } = {}
  ) => `/api/direct-messages/search${qs({ directId, ...params })}`,
  /** Mesaj iletilebilecek sunucu kanalları — "Mesajı İlet" hedef listesi. */
  forwardTargets: "/api/forward/targets",
  /** Üye kartı — sohbette avatara dokununca açılan zengin profil. */
  profileCard: (profileId: string) =>
    `/api/profile/${encodeURIComponent(profileId)}/card`,
  /** Başkaları hakkında tutulan kayıtlar (not, takma ad, yok say). */
  profileAnnotations: "/api/profile-annotations",
  profileAnnotation: (profileId: string) =>
    `/api/profile-annotations/${encodeURIComponent(profileId)}`,
  /**
   * Keşfet — mobil için ciklet-web'den istenen JSON uçları (web tarafı SSR).
   * Uç henüz yayında değilse ekran 404'ü "hazırlanıyor" olarak gösterir.
   */
  discoverServers: (q?: string, tab?: "popular" | "new") =>
    `/api/discover/servers${qs({ q, tab })}`,
  discoverApps: (q?: string) => `/api/discover/apps${qs({ q })}`,
  unreadCounts: "/api/unread-counts",
  markUnread: "/api/read-state/unread",
  /**
   * POST `{ channelId | directId, messageId }` — okuma imlecini ilerletir.
   * Eskiden Socket.IO `MESSAGE_ACK` olayıydı (ADR-0012 ile HTTP'ye taşındı);
   * sonuç `read_state.updated` olarak ağ geçidinden geri gelir.
   */
  readStateAck: "/api/read-state/ack",
  inbox: "/api/inbox",
  linkPreview: (url: string) => `/api/link-preview${qs({ url })}`,
  // Klipy vekili (web `api/klipy`): sayfa 1..20, sayfa başı 24 — web seçicisiyle aynı.
  klipyCategories: "/api/klipy?endpoint=categories",
  klipyTrending: (page: number) => `/api/klipy${qs({ endpoint: "trending", per_page: 24, page })}`,
  klipySearch: (q: string, page: number) => `/api/klipy${qs({ endpoint: "search", q, per_page: 24, page })}`,

  // ── Gerçek zamanlı ses & aktiviteler ──────────────────────────────
  livekitToken: (room: string, username: string) =>
    `/api/livekit${qs({ room, username })}`,
  activities: "/api/activities",
  activityAuthorize: "/api/activities/authorize",
  /**
   * GET `{ keys: string[] }` — Ciklet'in tanıdığı oyun/program ad anahtarları
   * (oturum gerekir). Canlı oyun etkinliği bu kümeye göre süzülür (lib/recognized-games).
   */
  recognizedGames: "/api/games/recognized",

  // ── DM aramaları (ADR-0012: eylemler HTTP, sonuçları ağ geçidinden) ──
  /** POST `{ receiverId, type }` → `{ callId, expiresAt, directChannelId }`. */
  calls: "/api/calls",
  callAccept: "/api/calls/accept",
  callDecline: "/api/calls/decline",
  callCancel: "/api/calls/cancel",
  /** GET → `{ invites }` — bağlantı anında bekleyen davetler. */
  callsPending: "/api/calls/pending",
  /** GET → `{ items, nextCursor }` — arama geçmişi (yalnızca kendi kayıtların). */
  callsHistory: (cursor?: string) => `/api/calls/history${qs({ cursor: cursor || undefined })}`,

  // ── Profil genişlemesi, sosyal ve para ────────────────────────────
  /** GET liste, PUT `{ type, handle, visible? }`, DELETE `{ type }`. */
  profileConnections: "/api/profile/connections",
  /** GET bağlantı durumu, DELETE bağlantıyı kaldır. Bağlama OAuth ile webde. */
  spotifyConnection: "/api/connections/spotify",
  spotifyNowPlaying: (profileId: string) =>
    `/api/spotify/now-playing/${encodeURIComponent(profileId)}`,
  /** POST `{ hostProfileId, action: "sync" | "stop" }` — ~10 sn'de bir. */
  spotifyListenAlong: "/api/spotify/listen-along",
  /** GET liste (`?idsOnly=1` → `{ ids }`), POST `{ messageId, scope, chatId }`, DELETE `{ messageId }`. */
  bookmarks: (idsOnly?: boolean) => `/api/bookmarks${qs({ idsOnly: idsOnly ? 1 : undefined })}`,
  /** Son 7 günde bahsedilen kanal mesajları. */
  mentions: "/api/mentions",
  /** GET istekler (`?count=1` → `{ count }`), POST `{ directId, action: "accept" | "ignore" }`. */
  messageRequests: (count?: boolean) => `/api/directs/requests${qs({ count: count ? 1 : undefined })}`,
  /** GET katalog + sahiplik + takılılar. */
  store: "/api/store",
  /** POST `{ itemId, giftTo? }` → `{ paymentId }`. */
  storeCheckout: "/api/store/checkout",
  /** POST `{ plan, period, giftTo? }` → `{ paymentId, … }`. */
  mentolCheckout: "/api/mentol/checkout",
  serverTiers: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/subscription-tiers`,
  serverTierCheckout: (serverId: string, tierId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/subscription-tiers/${encodeURIComponent(tierId)}/checkout`,
  /** POST → `{ path }`: ödeme sayfasının oturumsuz, süreli yolu (tarayıcıda açılır). */
  paymentLink: (paymentId: string) => `/api/mentol/payments/${encodeURIComponent(paymentId)}/link`,

  // ── Bildirim ayarları (sunucu / kanal / DM) ───────────────────────
  /**
   * GET: tüm kayıtlar (`label` dolu); PUT `{ serverId|channelId|directId,
   * level?, mutedUntil?, suppressEveryone? }` tek hedefi yazar (verilmeyen
   * alan korunur); DELETE aynı hedef gövdesiyle varsayılana döner.
   */
  notificationSettings: "/api/notification-settings",

  // ── Sunucu yetkileri ve moderasyon ────────────────────────────────
  /** GET `{ isOwner, memberRole, topPosition, permissions, keys }` — yalnızca arayüz ipucu. */
  myPermissions: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/my-permissions`,
  /** Sayfalı üye listesi (`{ items, nextCursor }`, sayfa başı en çok 50). */
  serverMembersPage: (serverId: string, cursor?: string | null, q?: string) =>
    `/api/members${qs({ serverId, cursor, q })}`,
  /** DELETE — üyeyi sunucudan at (moderatör+, hiyerarşi sunucuda). */
  memberKick: (memberId: string, serverId: string) =>
    `/api/members/${encodeURIComponent(memberId)}${qs({ serverId })}`,
  /** POST `{ seconds, reason? }` zaman aşımı verir; `{ seconds: null }` kaldırır. */
  memberTimeout: (memberId: string) =>
    `/api/members/${encodeURIComponent(memberId)}/timeout`,
  /** GET `{ required, text, serverName, acceptedAt, pending }` — kural perdesi. */
  serverRules: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/rules`,
  serverRulesAccept: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/rules/accept`,

  // ── Alt başlıklar ve forum ────────────────────────────────────────
  /**
   * GET sunucunun görünür, açık, forum dışı alt başlıkları tek istekte:
   * `[{ id, name, parentChannelId, latestMessageId }]` (kenar listesi).
   */
  serverThreads: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/threads`,
  /**
   * GET açık (ya da `archived`) alt başlıklar, en çok 50. POST `{ name?,
   * messageId?, autoArchiveMinutes? }` → `{ id, name }` (mesajdan alt başlık).
   */
  channelThreads: (channelId: string, archived = false) =>
    `/api/channels/${encodeURIComponent(channelId)}/threads${qs({ archived: archived ? 1 : undefined })}`,
  /** POST `{ archived }` — alt başlığı arşivle / arşivden çıkar. */
  threadArchive: (threadId: string) =>
    `/api/channels/${encodeURIComponent(threadId)}/archive`,
  /** GET `{ tags, canPost, posts }`; POST `{ title, content, tags? }` → `{ id }`. */
  forumPosts: (
    channelId: string,
    params: { sort?: "activity" | "created"; tag?: string; archived?: boolean } = {}
  ) =>
    `/api/channels/${encodeURIComponent(channelId)}/forum${qs({
      sort: params.sort,
      tag: params.tag,
      archived: params.archived ? 1 : undefined,
    })}`,

  // ── Zamanlanmış etkinlikler ───────────────────────────────────────
  /** GET yaklaşan + süren (`all` geçmişi de ekler); POST yeni (moderatör+). */
  serverEvents: (serverId: string, all = false) =>
    `/api/servers/${encodeURIComponent(serverId)}/events${qs({ all: all ? 1 : undefined })}`,
  /** PATCH `{ status }` ya da alanlar; DELETE. */
  serverEvent: (serverId: string, eventId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}`,
  /** POST ilgileniyorum / DELETE geri al → `{ interested, interestedCount }`. */
  serverEventInterest: (serverId: string, eventId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/interest`,

  /**
   * Sunucu içi mesaj arama — DM aramasıyla aynı süzgeç dili; yanıt
   * `{ items (channelId ekli), total, nextCursor, channels: {id: ad} }`.
   */
  serverMessageSearch: (
    serverId: string,
    params: { q?: string; cursor?: string; order?: "newest" | "oldest"; channel?: string } = {}
  ) => `/api/servers/${encodeURIComponent(serverId)}/messages/search${qs(params)}`,

  // ── Ses: soundboard, sahne, moderasyon ────────────────────────────
  /** GET sunucu sesleri (`ServerSound[]`). */
  serverSounds: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}/sounds`,
  /** POST `{ action: speak|listen|promote|demote, identity? }`. */
  stage: (channelId: string) => `/api/channels/${encodeURIComponent(channelId)}/stage`,
  /** POST `{ profileId, action: mute|unmute|disconnect|move, targetChannelId? }`. */
  voiceModerate: (channelId: string) =>
    `/api/channels/${encodeURIComponent(channelId)}/voice/moderate`,
} as const;
