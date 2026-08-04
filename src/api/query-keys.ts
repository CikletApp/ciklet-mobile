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

  /** Bir sunucunun üyeleri. */
  members: (serverId: string) => ["members", serverId] as const,

  directs: ["directs"] as const,

  friends: ["friends"] as const,

  messages: {
    all: ["messages"] as const,
    /** chatId = channelId veya directId — soket odası da bu kimliği kullanır. */
    chat: (chatId: string) => ["messages", chatId] as const,
  },

  unreadCounts: ["unread-counts"] as const,

  search: (query: string) => ["search", query] as const,

  activities: ["activities"] as const,

  sessions: ["sessions"] as const,
} as const;
