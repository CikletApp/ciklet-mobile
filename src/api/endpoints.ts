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

  // ── Profil ────────────────────────────────────────────────────────
  currentProfile: "/api/current-profile",
  accountUsername: "/api/account/username",
  accountStatus: "/api/account-status",
  sessions: "/api/sessions",
  session: (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}`,

  // ── Sunucular ─────────────────────────────────────────────────────
  servers: "/api/servers",
  server: (serverId: string) => `/api/servers/${encodeURIComponent(serverId)}`,
  serverLeave: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/leave`,
  serverJoin: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/join`,
  serverActivities: (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/activities`,
  invite: (code: string) => `/api/i/${encodeURIComponent(code)}`,

  // ── Üyelikler (sunucu profili düzenleme buradan yazılır) ──────────
  myMemberships: "/api/members/mine",
  member: (memberId: string) => `/api/members/${encodeURIComponent(memberId)}`,

  // ── Kanallar ──────────────────────────────────────────────────────
  channels: "/api/channels",
  channel: (channelId: string) => `/api/channels/${encodeURIComponent(channelId)}`,

  // ── Doğrudan mesajlar (1:1) ───────────────────────────────────────
  directs: "/api/directs",
  direct: (directId: string) => `/api/directs/${encodeURIComponent(directId)}`,
  directInit: "/api/directs/init",

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

  // ── Arkadaşlar ────────────────────────────────────────────────────
  friends: "/api/friends",
  friend: (friendId: string) => `/api/friends/${encodeURIComponent(friendId)}`,
  friendBlock: "/api/friends/block",

  // ── Keşif / okunmamış ─────────────────────────────────────────────
  search: (q: string) => `/api/search${qs({ q })}`,
  unreadCounts: "/api/unread-counts",
  markUnread: "/api/read-state/unread",
  inbox: "/api/inbox",

  // ── Gerçek zamanlı ses & aktiviteler ──────────────────────────────
  livekitToken: (room: string, username: string) =>
    `/api/livekit${qs({ room, username })}`,
  activities: "/api/activities",
  activityAuthorize: "/api/activities/authorize",
} as const;
