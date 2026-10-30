/**
 * TanStack Query anahtar fabrikası.
 *
 * Anahtarlar tek yerden üretilir; "invalidate ettim ama key bir harf farklıydı"
 * sınıfı sessiz hatalar böylece imkânsız hale gelir. Hiyerarşik yapı sayesinde
 * `queryClient.invalidateQueries({ queryKey: qk.messages.all })` tüm sohbet
 * geçmişlerini tek çağrıda tazeler.
 */
export const qk = {
  currentProfile: ["current-profile"] as const,

  /**
   * Sunucu listesi üyelik ucundan gelir (`GET /api/members/mine`) — ayrı bir
   * "servers" anahtarı YOK, çünkü `GET /api/servers` diye bir uç yok.
   */
  memberships: ["memberships"] as const,

  /** Sunucu klasörleri (ad, renk, sıra). */
  folders: ["folders"] as const,

  /** Bir sunucunun kanalları. */
  channels: (serverId: string) => ["channels", serverId] as const,
  server: (serverId: string) => ["server", serverId] as const,

  /** Bir sunucunun üyeleri. */
  members: (serverId: string) => ["members", serverId] as const,

  directs: ["directs"] as const,
  /**
   * Tek sohbet — `/api/directs/init` yanıtından tohumlanır. Liste mesajsız
   * birebir sohbeti (ve listeden kaldırılanı) döndürmüyor; başlık bundan okur.
   */
  direct: (directId: string) => ["direct", directId] as const,

  friends: ["friends"] as const,
  blockedUsers: ["blocked-users"] as const,

  messages: {
    all: ["messages"] as const,
    /** chatId = channelId veya directId — soket odası da bu kimliği kullanır. */
    chat: (chatId: string) => ["messages", chatId] as const,
  },

  /** Bir sohbetin sabitlenen mesajları (chatId = channelId veya directId). */
  pins: (chatId: string) => ["pins", chatId] as const,

  unreadCounts: ["unread-counts"] as const,
  /** Sohbet başına okunmamış sayısı (gruplar dahil) — `/api/inbox`. */
  inbox: ["inbox"] as const,

  search: (query: string, scope: string) => ["search", scope, query] as const,
  /** DM içinde arama — sohbet ve sorgu başına ayrı sayfa dizisi. */
  directSearch: (directId: string, query: string) =>
    ["direct-search", directId, query] as const,

  /** Mesaj iletme hedefleri (yazılabilir sunucu kanalları). */
  forwardTargets: ["forward-targets"] as const,

  /** Üye kartı — profil başına. */
  profileCard: (profileId: string) => ["profile-card", profileId] as const,
  /** Kendi oyun koleksiyonun (favori seçici). */
  profileGames: ["profile-games"] as const,

  /** Kullanıcının başkaları hakkında tuttuğu kayıtlar (tek liste). */
  annotations: ["profile-annotations"] as const,
  /** Ayarlar → Gizlilik: yoksayılan kullanıcılar (profil alt kümesiyle). */
  ignoredUsers: ["profile-annotations", "ignored"] as const,
  /** Sunucu başına kenar çubuğu tercihleri (Kanallara Göz At, sessizleri gizle). */
  sidebarPreferences: (serverId: string) => ["sidebar-preferences", serverId] as const,

  /** Keşfet listeleri. */
  discover: (tab: string, query: string) => ["discover", tab, query] as const,

  activities: ["activities"] as const,

  sessions: ["sessions"] as const,
  authorizedApps: ["authorized-apps"] as const,

  /** Kendi profil bağlantıların (Steam, Twitch…). */
  profileConnections: ["profile-connections"] as const,
  /** Oturum sahibinin Spotify bağlantı durumu. */
  spotifyLink: ["spotify-link"] as const,
  /** Bir profilin Spotify'da çalanı. */
  spotifyNowPlaying: (profileId: string) => ["spotify-now-playing", profileId] as const,
  /** Kaydedilen mesaj kimlikleri (menüde "Kaydet/Kaldır" için) ve hidrasyonlu liste. */
  bookmarkIds: ["bookmarks", "ids"] as const,
  bookmarks: ["bookmarks", "list"] as const,
  mentions: ["mentions"] as const,
  /** Arama geçmişi (sayfalı). */
  callHistory: ["call-history"] as const,
  /** Mesaj istekleri listesi; sayaç listeden türetilir. */
  messageRequests: ["message-requests"] as const,
  store: ["store"] as const,
  serverTiers: (serverId: string) => ["server-tiers", serverId] as const,

  /** Bildirim ayarları (tek liste: sunucu, kanal, DM). */
  notificationSettings: ["notification-settings"] as const,
  /** Sunucu varsayılan bildirim seviyeleri (ALL olmayanlar); ayar listesiyle birlikte gelir. */
  notificationServerDefaults: ["notification-server-defaults"] as const,
  /** Oturum sahibinin sunucudaki izinleri. */
  myPermissions: (serverId: string) => ["my-permissions", serverId] as const,
  /** Sayfalı üye listesi (moderasyon ekranı). */
  memberPages: (serverId: string, query: string) => ["members", serverId, "pages", query] as const,
  serverRules: (serverId: string) => ["server-rules", serverId] as const,
  /** Denetim kaydı (süzgeçli, sayfalı) ve kayıttaki kişiler. */
  auditLogs: (serverId: string, action: string | null, userId: string | null) =>
    ["audit-logs", serverId, action ?? "*", userId ?? "*"] as const,
  auditLogActors: (serverId: string) => ["audit-logs", serverId, "actors"] as const,
  /** Üye temizleme önizlemesi (`members` altında: üye listesiyle tazelenir). */
  prunePreview: (serverId: string, days: number) => ["members", serverId, "prune", days] as const,
  /**
   * Alt başlıklar `channels` altında: kanal yerleşimi değişince
   * (`server.channels_updated`) kanal listesiyle birlikte tazelenir.
   */
  threads: (serverId: string, channelId: string, archived: boolean) =>
    ["channels", serverId, "threads", channelId, archived ? "archived" : "open"] as const,
  /** Kenar listesi: sunucunun tüm açık alt başlıkları (tek istek). */
  sidebarThreads: (serverId: string) => ["channels", serverId, "sidebar-threads"] as const,
  /** Alt başlık üyeleri — kanal anahtarı altında: üyelik değişince listelerle birlikte tazelenir. */
  threadMembers: (serverId: string, threadId: string) => ["channels", serverId, "thread-members", threadId] as const,
  forum: (serverId: string, channelId: string, filter: string) =>
    ["channels", serverId, "forum", channelId, filter] as const,
  serverEvents: (serverId: string) => ["server-events", serverId] as const,
  serverSearch: (serverId: string, query: string) => ["server-search", serverId, query] as const,
  serverSounds: (serverId: string) => ["server-sounds", serverId] as const,
  /** Sunucu Takviyesi: kullanıcının slotları ve sunucunun takviye durumu. */
  myBoosts: ["boosts"] as const,
  serverBoost: (serverId: string) => ["server-boost", serverId] as const,
} as const;
