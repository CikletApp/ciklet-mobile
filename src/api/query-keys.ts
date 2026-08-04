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

  servers: {
    all: ["servers"] as const,
    detail: (serverId: string) => ["servers", serverId] as const,
  },

  memberships: ["memberships"] as const,

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
