/**
 * Rol izin matrisi — web `lib/role-permissions` ROLE_PERMISSION_GROUPS ve
 * `lib/bot/permissions` (bit numarası, başlık, açıklama) ile birebir. Yalnızca
 * role EKLENEBİLEN sunucu düzeyi yetkiler; herkesin taban izinleri kanal ve
 * kategori izinlerinde kısıtlanır.
 */
export const ROLE_PERMISSIONS = {
  MANAGE_CHANNELS: { bit: 5, title: "Kanalları Yönet", description: "Kanal oluşturabilir, düzenleyebilir ve silebilir." },
  MANAGE_PERMISSIONS: { bit: 10, title: "İzinleri Yönet", description: "Kanalların izin ayarlarını değiştirebilir." },
  MANAGE_ROLES: { bit: 19, title: "Rolleri Yönet", description: "Kendi en yüksek rolünün altındaki rolleri oluşturup düzenleyebilir ve atayabilir." },
  CREATE_EXPRESSIONS: { bit: 29, title: "İfade Oluştur", description: "Emoji, çıkartma ve ses efekti yükleyebilir; yalnızca kendi yüklediklerini düzenler." },
  MANAGE_EXPRESSIONS: { bit: 28, title: "İfadeleri Yönet", description: "Sunucunun tüm emojilerini, çıkartmalarını ve ses efektlerini düzenleyebilir ve silebilir." },
  VIEW_AUDIT_LOG: { bit: 23, title: "Denetim Kaydını Görüntüle", description: "Sunucu denetim kaydını okuyabilir." },
  VIEW_SERVER_INSIGHTS: { bit: 32, title: "Sunucu İstatistiklerini Görüntüle", description: "Sunucunun büyüme ve etkileşim istatistiklerini görebilir." },
  MANAGE_WEBHOOKS: { bit: 27, title: "Webhook'ları Yönet", description: "Webhook oluşturabilir, düzenleyebilir, silebilir ve duyuru kanallarını takip ettirebilir." },
  MANAGE_SERVER: { bit: 18, title: "Sunucuyu Yönet", description: "Sunucu adını, görselini, moderasyon ayarlarını ve entegrasyonları düzenleyebilir." },
  CREATE_INVITES: { bit: 9, title: "Davet Oluştur", description: "Sunucuya davet bağlantısı oluşturabilir." },
  MANAGE_NICKNAMES: { bit: 26, title: "Takma Adları Yönet", description: "Kendinden alt konumdaki üyelerin sunucu takma adını değiştirebilir." },
  KICK_MEMBERS: { bit: 3, title: "Üyeleri At", description: "Üyeleri sunucudan çıkarabilir." },
  BAN_MEMBERS: { bit: 4, title: "Üyeleri Yasakla", description: "Üyeleri sunucudan yasaklayabilir." },
  MODERATE_MEMBERS: { bit: 20, title: "Üyeleri Zaman Aşımına Al", description: "Kendinden alt konumdaki üyelerin bir süre yazmasını engelleyebilir." },
  MENTION_EVERYONE: { bit: 16, title: "@herkes, @burada ve rolleri etiketle", description: "Tek mesajla kanaldaki herkese ya da bir roldeki herkese bildirim gönderebilir." },
  MANAGE_MESSAGES: { bit: 2, title: "Mesajları Yönet", description: "Diğer üyelerin mesajlarını silebilir." },
  PIN_MESSAGES: { bit: 36, title: "Mesajları Sabitle", description: "Mesajları sabitleyebilir ve sabitlemeyi kaldırabilir." },
  MANAGE_THREADS: { bit: 33, title: "Alt Başlıkları Yönet", description: "Alt başlıkları ve forum gönderilerini arşivleyebilir, açabilir ve etiketlerini düzenleyebilir." },
  BYPASS_SLOW_MODE: { bit: 13, title: "Yavaş Modu Atla", description: "Yavaş moddan etkilenmeden mesaj gönderebilir." },
  PRIORITY_SPEAKER: { bit: 41, title: "Öncelikli Konuşmacı", description: "Konuşurken diğerlerinin sesi kısılır." },
  MUTE_MEMBERS: { bit: 21, title: "Üyeleri Sustur", description: "Ses kanallarında başkalarını sunucuda susturabilir." },
  DEAFEN_MEMBERS: { bit: 24, title: "Üyeleri Sağırlaştır", description: "Ses kanallarında başkalarını sunucuda sağırlaştırabilir; kimseyi duyamazlar." },
  MOVE_MEMBERS: { bit: 22, title: "Üyeleri Taşı", description: "Ses kanalları arasında üye taşıyabilir ve bağlantılarını kesebilir." },
  CREATE_EVENTS: { bit: 31, title: "Etkinlik Oluştur", description: "Etkinlik oluşturabilir; yalnızca kendi etkinliklerini düzenler." },
  MANAGE_EVENTS: { bit: 30, title: "Etkinlikleri Yönet", description: "Sunucunun tüm etkinliklerini düzenleyebilir, başlatabilir ve silebilir." },
  ADMINISTRATOR: { bit: 17, title: "Yönetici", description: "Tüm izinlere sahip olur ve kanal kısıtlamalarını aşar. Dikkatli verin." },
} as const;

export type RolePermissionKey = keyof typeof ROLE_PERMISSIONS;

export const ROLE_PERMISSION_GROUPS: { title: string; keys: RolePermissionKey[] }[] = [
  {
    title: "Genel Sunucu İzinleri",
    keys: [
      "MANAGE_CHANNELS", "MANAGE_PERMISSIONS", "MANAGE_ROLES", "CREATE_EXPRESSIONS", "MANAGE_EXPRESSIONS",
      "VIEW_AUDIT_LOG", "VIEW_SERVER_INSIGHTS", "MANAGE_WEBHOOKS", "MANAGE_SERVER",
    ],
  },
  { title: "Üyelik İzinleri", keys: ["CREATE_INVITES", "MANAGE_NICKNAMES", "KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS"] },
  { title: "Metin Kanalı İzinleri", keys: ["MENTION_EVERYONE", "MANAGE_MESSAGES", "PIN_MESSAGES", "MANAGE_THREADS", "BYPASS_SLOW_MODE"] },
  { title: "Ses Kanalı İzinleri", keys: ["PRIORITY_SPEAKER", "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS"] },
  { title: "Etkinlik İzinleri", keys: ["CREATE_EVENTS", "MANAGE_EVENTS"] },
  { title: "Gelişmiş İzinler", keys: ["ADMINISTRATOR"] },
];

const bitOf = (key: RolePermissionKey): bigint => BigInt(1) << BigInt(ROLE_PERMISSIONS[key].bit);

function parse(permissions: string | null | undefined): bigint {
  try {
    return BigInt(permissions || "0");
  } catch {
    return BigInt(0);
  }
}

export function roleHasPermission(permissions: string | null | undefined, key: RolePermissionKey): boolean {
  const bit = bitOf(key);
  return (parse(permissions) & bit) === bit;
}

/** İzin bitini açar/kapatır; ondalık dizge döner (uç bu biçimi bekler). */
export function toggleRolePermission(permissions: string | null | undefined, key: RolePermissionKey, on: boolean): string {
  const current = parse(permissions);
  const bit = bitOf(key);
  return (on ? current | bit : current & ~bit).toString();
}
