/**
 * Kanal / kategori izin üzerine yazmaları — ciklet-web `lib/channel-permissions.ts`
 * istemci kısmı (aynı gruplar, sıra ve metinler). Bit konumları web
 * `lib/bot/permissions.ts` ile aynı; JSON'da dizgi taşınır (64 bit).
 */
export type ChannelPermissionKey =
  | "VIEW_CHANNELS"
  | "MANAGE_CHANNELS"
  | "MANAGE_PERMISSIONS"
  | "CREATE_INVITES"
  | "SEND_MESSAGES"
  | "EMBED_LINKS"
  | "ATTACH_FILES"
  | "ADD_REACTIONS"
  | "MANAGE_MESSAGES"
  | "BYPASS_SLOW_MODE"
  | "READ_MESSAGE_HISTORY"
  | "START_ACTIVITIES"
  | "MENTION_EVERYONE"
  | "CONNECT"
  | "MANAGE_THREADS"
  | "CREATE_PUBLIC_THREADS"
  | "CREATE_PRIVATE_THREADS"
  | "SEND_MESSAGES_IN_THREADS"
  | "PIN_MESSAGES"
  | "SEND_POLLS"
  | "SEND_VOICE_MESSAGES"
  | "USE_EXTERNAL_EMOJIS"
  | "USE_APPLICATION_COMMANDS"
  | "USE_EXTERNAL_APPS"
  | "STREAM"
  | "USE_SOUNDBOARD"
  | "USE_VAD"
  | "PRIORITY_SPEAKER"
  | "REQUEST_TO_SPEAK";

export interface ChannelPermissionGroup {
  title: string;
  keys: ChannelPermissionKey[];
  /** Yalnızca ses/görüntü kanallarında gösterilir. */
  voiceOnly?: boolean;
}

/** Kanal Ayarları → İzinler'deki sıra ve gruplama (Discord'un düzeniyle). */
export const CHANNEL_PERMISSION_GROUPS: ChannelPermissionGroup[] = [
  {
    title: "Genel Kanal İzinleri",
    keys: ["VIEW_CHANNELS", "MANAGE_CHANNELS", "MANAGE_PERMISSIONS"],
  },
  {
    title: "Üyelik İzinleri",
    keys: ["CREATE_INVITES"],
  },
  {
    title: "Metin Kanalı İzinleri",
    keys: [
      "SEND_MESSAGES",
      "SEND_MESSAGES_IN_THREADS",
      "CREATE_PUBLIC_THREADS",
      "CREATE_PRIVATE_THREADS",
      "EMBED_LINKS",
      "ATTACH_FILES",
      "ADD_REACTIONS",
      "USE_EXTERNAL_EMOJIS",
      "MENTION_EVERYONE",
      "MANAGE_MESSAGES",
      "PIN_MESSAGES",
      "MANAGE_THREADS",
      "BYPASS_SLOW_MODE",
      "READ_MESSAGE_HISTORY",
      "SEND_VOICE_MESSAGES",
      "SEND_POLLS",
    ],
  },
  {
    title: "Uygulama İzinleri",
    keys: ["USE_APPLICATION_COMMANDS", "USE_EXTERNAL_APPS", "START_ACTIVITIES"],
  },
  {
    title: "Ses Kanalı İzinleri",
    keys: ["CONNECT", "STREAM", "USE_SOUNDBOARD", "USE_VAD", "PRIORITY_SPEAKER", "REQUEST_TO_SPEAK"],
    voiceOnly: true,
  },
];

/** Kanal ayarlarında düzenlenebilen izinler — gruplardan türetilir. */
export const CHANNEL_PERMISSION_KEYS: ChannelPermissionKey[] = CHANNEL_PERMISSION_GROUPS.flatMap(
  (group) => group.keys,
);

/** Arayüz metinleri (Türkçe); bit değerleri lib/bot/permissions.ts'ten gelir. */
export const CHANNEL_PERMISSION_DETAILS: Record<
  ChannelPermissionKey,
  { title: string; description: string }
> = {
  VIEW_CHANNELS: {
    title: "Kanalı Görüntüle",
    description:
      "Üyelerin bu kanalı görebilmesini sağlar. @everyone için kapatmak kanalı özel kanal hâline getirir.",
  },
  MANAGE_CHANNELS: {
    title: "Kanalı Yönet",
    description:
      "Üyelerin bu kanalın adını, açıklamasını ve yavaş mod ayarını değiştirebilmesini, kanalı silebilmesini sağlar.",
  },
  MANAGE_PERMISSIONS: {
    title: "İzinleri Yönet",
    description: "Üyelerin bu kanalın izinlerini değiştirebilmesini sağlar.",
  },
  CREATE_INVITES: {
    title: "Davet Oluştur",
    description: "Üyelerin bu kanala davet bağlantısıyla yeni kişiler davet edebilmesini sağlar.",
  },
  SEND_MESSAGES: {
    title: "Mesaj Gönder",
    description: "Üyelerin bu kanala mesaj gönderebilmesini sağlar.",
  },
  EMBED_LINKS: {
    title: "Bağlantı Yerleştir",
    description:
      "Üyelerin paylaştığı bağlantıların önizleme kartıyla gösterilmesini sağlar. Kapalıysa bağlantı yalnızca metin olarak kalır.",
  },
  ATTACH_FILES: {
    title: "Dosya Ekle",
    description: "Üyelerin bu kanala dosya ve GIF gönderebilmesini sağlar.",
  },
  ADD_REACTIONS: {
    title: "Tepki Ekle",
    description: "Üyelerin bu kanaldaki mesajlara emoji tepkisi verebilmesini sağlar.",
  },
  MANAGE_MESSAGES: {
    title: "Mesajları Yönet",
    description: "Üyelerin bu kanalda başkalarının mesajlarını silebilmesini sağlar.",
  },
  BYPASS_SLOW_MODE: {
    title: "Yavaş Modu Atla",
    description: "Üyelerin yavaş moddan etkilenmeden bu kanala mesaj gönderebilmesini sağlar.",
  },
  READ_MESSAGE_HISTORY: {
    title: "Mesaj Geçmişini Oku",
    description:
      "Üyelerin bu kanalda daha önce gönderilmiş mesajları okuyabilmesini sağlar. Kapalıysa yalnızca kanal açıkken gelen mesajlar görünür.",
  },
  START_ACTIVITIES: {
    title: "Etkinlik Başlat",
    description: "Üyelerin bu kanalda etkinlik (aktivite) başlatabilmesini sağlar.",
  },
  MENTION_EVERYONE: {
    title: "@herkes, @burada ve Rolleri Etiketle",
    description: "Tek mesajla kanaldaki herkese ya da bir roldeki herkese bildirim gönderir. Moderatörler her zaman yapabilir.",
  },
  CONNECT: {
    title: "Bağlan",
    description: "Üyelerin bu ses kanalına katılabilmesini sağlar.",
  },
  SEND_MESSAGES_IN_THREADS: {
    title: "Alt Başlıklarda ve Gönderilerde Mesaj Gönder",
    description: "Üyelerin bu kanalın alt başlıklarına ve forum gönderilerine yazabilmesini sağlar.",
  },
  CREATE_PUBLIC_THREADS: {
    title: "Alt Başlık Oluştur",
    description: "Üyelerin bu kanalda alt başlık başlatabilmesini sağlar.",
  },
  CREATE_PRIVATE_THREADS: {
    title: "Özel Alt Başlık Oluştur",
    description: "Üyelerin yalnızca davet edilenlerin görebildiği alt başlık başlatabilmesini sağlar.",
  },
  USE_EXTERNAL_EMOJIS: {
    title: "Harici Emoji Kullan",
    description: "Üyelerin başka sunucuların emojilerini kullanabilmesini sağlar (Mentol gerekir).",
  },
  PIN_MESSAGES: {
    title: "Mesajları Sabitle",
    description: "Üyelerin bu kanalda mesaj sabitleyebilmesini ve sabitlemeyi kaldırabilmesini sağlar.",
  },
  MANAGE_THREADS: {
    title: "Alt Başlıkları Yönet",
    description: "Üyelerin alt başlıkları ve forum gönderilerini arşivleyebilmesini, açabilmesini ve etiketlerini düzenleyebilmesini sağlar.",
  },
  SEND_VOICE_MESSAGES: {
    title: "Sesli Mesaj Gönder",
    description: "Üyelerin bu kanala sesli mesaj gönderebilmesini sağlar.",
  },
  SEND_POLLS: {
    title: "Anket Oluştur",
    description: "Üyelerin bu kanala anket gönderebilmesini sağlar.",
  },
  USE_APPLICATION_COMMANDS: {
    title: "Uygulama Komutlarını Kullan",
    description: "Üyelerin bu kanalda botların eğik çizgi komutlarını kullanabilmesini sağlar.",
  },
  USE_EXTERNAL_APPS: {
    title: "Harici Uygulamaları Kullan",
    description: "Üyelerin hesabına kurduğu (sunucuda kurulu olmayan) uygulamaların yanıtları herkese görünür. Kapalıysa yanıtları yalnızca komutu kullanan görür.",
  },
  STREAM: {
    title: "Görüntü",
    description: "Üyelerin bu kanalda kamerasını açabilmesini ve ekran paylaşabilmesini sağlar.",
  },
  USE_SOUNDBOARD: {
    title: "Ses Efekti Panosunu Kullan",
    description: "Üyelerin bu kanalda ses efekti çalabilmesini sağlar.",
  },
  USE_VAD: {
    title: "Ses Etkinliğini Kullan",
    description: "Kapalıysa üyeler bu kanalda yalnızca Bas-Konuş ile konuşabilir.",
  },
  PRIORITY_SPEAKER: {
    title: "Öncelikli Konuşmacı",
    description: "Bu üyeler konuşurken diğerlerinin sesi kısılır.",
  },
  REQUEST_TO_SPEAK: {
    title: "Söz İste",
    description: "Sahne kanalında üyelerin el kaldırıp söz isteyebilmesini sağlar.",
  },
};


const bit = (n: number) => BigInt(1) << BigInt(n);

const BITS: Record<ChannelPermissionKey, bigint> = {
  VIEW_CHANNELS: bit(0),
  SEND_MESSAGES: bit(1),
  MANAGE_MESSAGES: bit(2),
  MANAGE_CHANNELS: bit(5),
  ADD_REACTIONS: bit(6),
  CONNECT: bit(7),
  CREATE_INVITES: bit(9),
  MANAGE_PERMISSIONS: bit(10),
  EMBED_LINKS: bit(11),
  ATTACH_FILES: bit(12),
  BYPASS_SLOW_MODE: bit(13),
  READ_MESSAGE_HISTORY: bit(14),
  START_ACTIVITIES: bit(15),
  MENTION_EVERYONE: bit(16),
  MANAGE_THREADS: bit(33),
  CREATE_PUBLIC_THREADS: bit(34),
  SEND_MESSAGES_IN_THREADS: bit(35),
  PIN_MESSAGES: bit(36),
  SEND_POLLS: bit(37),
  SEND_VOICE_MESSAGES: bit(38),
  USE_EXTERNAL_EMOJIS: bit(39),
  USE_SOUNDBOARD: bit(40),
  PRIORITY_SPEAKER: bit(41),
  STREAM: bit(42),
  USE_VAD: bit(43),
  REQUEST_TO_SPEAK: bit(44),
  USE_APPLICATION_COMMANDS: bit(45),
  CREATE_PRIVATE_THREADS: bit(46),
  USE_EXTERNAL_APPS: bit(47),
};

/** Anahtar → bit. */
export function channelPermissionBit(key: ChannelPermissionKey): bigint {
  return BITS[key];
}
