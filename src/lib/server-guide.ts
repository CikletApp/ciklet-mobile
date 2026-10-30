/**
 * Sunucu Rehberi — web `lib/server-guide.ts` modülünün istemci kopyası
 * (sınırlar ve tipler). Doğrulama ve üye görünümü uçta
 * (`/api/servers/:id/guide`, `/guide/progress`).
 *
 * Rehber katıldıktan SONRA kalıcı bir başlangıç sayfasıdır: kanal
 * listesinin en üstünde "Sunucu Rehberi" girişi; karşılama (başlık + mesaj
 * + afiş), kanallara bağlı yapılacaklar (en çok 5) ve kaynak kartları
 * (en çok 8).
 */

export const GUIDE_MAX_TASKS = 5;
export const GUIDE_MAX_RESOURCES = 8;
export const GUIDE_WELCOME_TITLE_MAX = 100;
export const GUIDE_WELCOME_MESSAGE_MAX = 1000;
export const GUIDE_ITEM_TITLE_MAX = 60;
export const GUIDE_ITEM_DESCRIPTION_MAX = 200;
export const GUIDE_EMOJI_MAX = 16;

export interface GuideItem {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  /** Bağlı kanal (bu sunucunun üst düzey kanalı). */
  channelId: string;
}

export interface GuideConfig {
  enabled: boolean;
  welcomeTitle: string | null;
  welcomeMessage: string | null;
  bannerUrl: string | null;
  tasks: GuideItem[];
  resources: GuideItem[];
}

/** Üyeye giden öğe: kanal adı ve türüyle. */
export interface GuideItemView extends GuideItem {
  channelName: string;
  channelType: "TEXT" | "AUDIO" | "VIDEO";
}

/** Üyenin gördüğü rehber: yalnızca görebildiği kanallara bağlı öğeler. */
export interface GuideView extends Omit<GuideConfig, "tasks" | "resources"> {
  tasks: GuideItemView[];
  resources: GuideItemView[];
  /** Üyenin tamamladığı (görünür) yapılacak kimlikleri. */
  completed: string[];
}

export const EMPTY_GUIDE: GuideConfig = {
  enabled: false,
  welcomeTitle: null,
  welcomeMessage: null,
  bannerUrl: null,
  tasks: [],
  resources: [],
};

let idCounter = 0;
/** Yeni öğe/soru kimliği — web sekmeleriyle aynı biçim (`/^[A-Za-z0-9_-]{1,32}$/`). */
export const newEditorId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}`;
