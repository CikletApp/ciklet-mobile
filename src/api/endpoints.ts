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
  mentolPlan: "/api/mentol/me",
  mentolRedeem: "/api/mentol/redeem",
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

  // ── Arkadaşlar ────────────────────────────────────────────────────
  friends: "/api/friends",
  friend: (friendId: string) => `/api/friends/${encodeURIComponent(friendId)}`,
  friendBlock: "/api/friends/block",

  // ── Keşif / okunmamış ─────────────────────────────────────────────
  search: (q: string) => `/api/search${qs({ q })}`,
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
  klipy: (query?: string) =>
    `/api/klipy${qs({ endpoint: query ? "search" : "trending", q: query, per_page: 30, page: 1 })}`,

  // ── Gerçek zamanlı ses & aktiviteler ──────────────────────────────
  livekitToken: (room: string, username: string) =>
    `/api/livekit${qs({ room, username })}`,
  activities: "/api/activities",
  activityAuthorize: "/api/activities/authorize",

  // ── DM aramaları (ADR-0012: eylemler HTTP, sonuçları ağ geçidinden) ──
  /** POST `{ receiverId, type }` → `{ callId, expiresAt, directChannelId }`. */
  calls: "/api/calls",
  callAccept: "/api/calls/accept",
  callDecline: "/api/calls/decline",
  callCancel: "/api/calls/cancel",
  /** GET → `{ invites }` — bağlantı anında bekleyen davetler. */
  callsPending: "/api/calls/pending",
} as const;
