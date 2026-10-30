/**
 * Aktivite host'unun Discord Embedded App SDK eşdeğerliği — SAF modül
 * (RN bağımlılığı yok; scripts/verify-activity-sdk.mjs ile doğrulanır).
 *
 * Web ile BİREBİR aynı kurallar (ciklet-web lib/activity/launch-context,
 * lib/activity/sdk-presence, lib/activity/host-events); bir tarafta değişirse
 * diğerinde de değişir:
 *
 *  - iframe adresi: instance_id, location_id, launch_id, referrer_id (daveti
 *    PAYLAŞAN kişi; bilinmiyorsa yok), custom_id (özel bağlantı), channel_id,
 *    guild_id (sunucu kanalında), frame_id, platform=mobile.
 *  - SDK `setActivity` → kullanıcının rich presence'ı: ad daima uygulamanın
 *    adı, metinler 128 kod noktası, görseller yalnızca https (ya da Portal
 *    varlık anahtarı), grup kimliği yayınlanmaz.
 *  - SUBSCRIBE'da güncel durum (yerleşim, yön, ısı, kullanıcı, görünürlük).
 *  - `sdk.close(code, message)`: normal olmayan kapanışta mesaj gösterilir.
 */
import type { RichPresence, RichPresenceType } from "@/api/types";

// ── Başlatma bağlamı ve iframe adresi ───────────────────────────────

export interface ActivityLaunchContext {
  customId: string | null;
  referrerId: string | null;
  guildId: string | null;
}

export const EMPTY_LAUNCH_CONTEXT: ActivityLaunchContext = Object.freeze({
  customId: null,
  referrerId: null,
  guildId: null,
});

export const MAX_CUSTOM_ID_LENGTH = 256;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;

function cleanId(value: unknown): string | null {
  return typeof value === "string" && ENTITY_ID.test(value) ? value : null;
}

function cleanCustomId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return Array.from(trimmed).slice(0, MAX_CUSTOM_ID_LENGTH).join("");
}

/** Dışarıdan gelen bağlamı süzer; kendini referrer gösteren değer düşer. */
export function normalizeLaunchContext(
  input: Partial<Record<keyof ActivityLaunchContext, unknown>> | null | undefined,
  currentProfileId?: string | null
): ActivityLaunchContext {
  if (!input) return EMPTY_LAUNCH_CONTEXT;
  const referrerId = cleanId(input.referrerId);
  return {
    customId: cleanCustomId(input.customId),
    referrerId: referrerId && referrerId !== currentProfileId ? referrerId : null,
    guildId: cleanId(input.guildId),
  };
}

export interface ActivityFrameUrlParams {
  instanceId: string;
  /** Sohbet kimliği; sohbetsiz başlatmada boş. */
  channelId: string;
  launchId: string;
  frameId: string;
  launch?: ActivityLaunchContext | null;
}

/** Güvenilir aktivite adresine SDK parametrelerini yazar (aynı adlı olanlar ezilir). */
export function buildActivityFrameUrl(activityUrl: string, params: ActivityFrameUrlParams): string {
  const url = new URL(activityUrl);
  const launch = params.launch ?? EMPTY_LAUNCH_CONTEXT;
  const entries: [string, string | null][] = [
    ["instance_id", params.instanceId],
    ["location_id", params.channelId || null],
    ["launch_id", params.launchId],
    ["referrer_id", launch.referrerId],
    ["custom_id", launch.customId],
    ["channel_id", params.channelId || null],
    ["guild_id", launch.guildId],
    ["frame_id", params.frameId],
    ["platform", "mobile"],
  ];
  for (const [key, value] of entries) {
    url.searchParams.delete(key);
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

// ── setActivity → rich presence ─────────────────────────────────────

const ACTIVITY_TYPES: Record<number, RichPresenceType> = {
  0: "PLAYING",
  2: "LISTENING",
  3: "WATCHING",
  5: "COMPETING",
};

/** Portal varlık anahtarı (web api/developers/apps/[appId]/assets KEY_PATTERN). */
export const ASSET_KEY = /^[a-z0-9_-]{1,64}$/;
/** RPC uygulama kimliği (web lib/activity-party RPC_APPLICATION_ID). */
const RPC_APPLICATION_ID = /^(?:\d{1,20}|cik_app_[0-9a-f]{24})$/i;
const MAX_TEXT = 128;
const MAX_URL = 512;
const MAX_PARTY_SIZE = 1_000_000;

export interface SdkPresenceContext {
  clientId: string;
  appName: string;
  appIconUrl?: string | null;
  /** Aktivitenin açıldığı an (epoch ms); 0 → şimdi. */
  startedAt: number;
  assets?: Record<string, string> | null;
}

export type SdkPresenceResult =
  | { kind: "clear" }
  | { kind: "set"; activity: RichPresence }
  | { kind: "invalid"; message: string };

function clampText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= MAX_TEXT ? trimmed : Array.from(trimmed).slice(0, MAX_TEXT).join("");
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_URL) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Saniye cinsinden gelen zaman damgasını milisaniyeye çevirir. */
export function toEpochMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value < 1e12 ? value * 1000 : value);
}

/** Görsel: https adresi olduğu gibi, Portal anahtarı eşlemesinden; başka her şey düşer. */
export function resolveAssetImage(value: unknown, assets: Record<string, string> | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https:\/\//i.test(trimmed)) return httpsUrl(trimmed);
  if (ASSET_KEY.test(trimmed) && assets && Object.prototype.hasOwnProperty.call(assets, trimmed)) {
    return httpsUrl(assets[trimmed]);
  }
  return undefined;
}

/** Görseller Portal anahtarı mı taşıyor (eşleme yüklenmeli mi)? */
export function usesAssetKeys(args: unknown): boolean {
  const assets = (args as { activity?: { assets?: Record<string, unknown> | null } | null } | null)?.activity?.assets;
  if (!assets || typeof assets !== "object") return false;
  return [assets.large_image, assets.small_image].some((value) => typeof value === "string" && ASSET_KEY.test(value.trim()));
}

function partySize(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [current, max] = value;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_PARTY_SIZE;
  return ok(current) && ok(max) && current <= max ? [current, max] : undefined;
}

/**
 * SET_ACTIVITY argümanları → yayınlanacak etkinlik.
 * `activity` yoksa null (yalnızca metadata), `null` → temizle, nesne değil → geçersiz.
 */
export function toSdkPresence(args: unknown, ctx: SdkPresenceContext): SdkPresenceResult | null {
  if (!args || typeof args !== "object" || !("activity" in args)) return null;
  const activity = (args as { activity?: unknown }).activity;
  if (activity === null || activity === undefined) return { kind: "clear" };
  if (typeof activity !== "object" || Array.isArray(activity)) {
    return { kind: "invalid", message: "activity must be an object or null" };
  }
  const source = activity as Record<string, unknown>;
  const name = clampText(ctx.appName);
  if (!name) return { kind: "invalid", message: "activity could not be published" };

  const timestamps = (source.timestamps ?? null) as { start?: unknown; end?: unknown } | null;
  const assets = (source.assets ?? null) as Record<string, unknown> | null;
  const party = (source.party ?? null) as { size?: unknown } | null;
  const start = toEpochMs(timestamps?.start);
  const end = toEpochMs(timestamps?.end);
  const startedAt = start ?? (ctx.startedAt > 0 ? ctx.startedAt : Date.now());

  const out: RichPresence = {
    type: ACTIVITY_TYPES[typeof source.type === "number" ? source.type : 0] ?? "PLAYING",
    name,
    processName: name,
    startedAt,
  };
  const details = clampText(source.details);
  const state = clampText(source.state);
  if (details) out.details = details;
  if (state) out.state = state;
  if (end && end > startedAt) out.timestamps = { start: startedAt, end };
  if (assets && typeof assets === "object") {
    const large = resolveAssetImage(assets.large_image, ctx.assets);
    const small = resolveAssetImage(assets.small_image, ctx.assets);
    if (large) out.largeImageUrl = large;
    if (small) out.smallImageUrl = small;
    const largeText = large ? clampText(assets.large_text) : undefined;
    const smallText = small ? clampText(assets.small_text) : undefined;
    if (largeText) out.largeText = largeText;
    if (smallText) out.smallText = smallText;
  }
  const icon = httpsUrl(ctx.appIconUrl);
  if (icon) out.appIconUrl = icon;
  if (RPC_APPLICATION_ID.test(ctx.clientId)) {
    out.applicationId = ctx.clientId;
    const size = partySize(party?.size);
    if (size) out.partySize = size;
  }
  return { kind: "set", activity: out };
}

// ── Durum olayları ──────────────────────────────────────────────────

export interface SdkUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
}

export interface HostStateSnapshot {
  layoutMode: "focused" | "pip";
  orientation: "portrait" | "landscape";
  hidden: boolean;
  user: SdkUser | null;
  /** Mobilde gerçek ısı durumu okunmuyor (expo-battery / termal API bağımlılığı yok). */
  thermalState?: "nominal" | "fair" | "serious" | "critical";
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function currentUserPayload(user: SdkUser) {
  return { ...user, user };
}

/** Abone olunan DURUM olayının güncel değeri; durum değilse null. */
export function currentStateFor(evt: unknown, snapshot: HostStateSnapshot): unknown | null {
  switch (evt) {
    case "ACTIVITY_LAYOUT_MODE_UPDATE":
      return { layout_mode: snapshot.layoutMode };
    case "ORIENTATION_UPDATE":
      return { screen_orientation: snapshot.orientation, orientation: snapshot.orientation };
    case "THERMAL_STATE_UPDATE":
      // TODO: gerçek ısı durumu — iOS ProcessInfo.thermalState / Android
      // PowerManager.getCurrentThermalStatus için yerel modül gerekiyor
      // (expo-battery / expo-device bunu vermiyor). O zamana dek "nominal".
      return { thermal_state: snapshot.thermalState ?? "nominal" };
    case "CURRENT_USER_UPDATE":
      return snapshot.user ? currentUserPayload(snapshot.user) : null;
    case "VISIBILITY_UPDATE":
      return { hidden: snapshot.hidden };
    default:
      return null;
  }
}

/**
 * Aktivitenin gördüğü safe-area boşlukları. Tam ekran dikeyde üst çubuk
 * çentiği zaten kaplıyor, WebView ekranın altına (ev çubuğu) ve yanlara
 * uzanıyor; klavye açıkken gövde klavyenin üstünde biter (alt 0). Yatay
 * görünümde kap zaten çentik/ev çubuğu kadar içeriden başlıyor, mini
 * pencerede boşluk yok.
 */
export function activitySafeArea(input: {
  mode: "full" | "mini";
  landscape: boolean;
  keyboardOpen: boolean;
  insets: SafeAreaInsets;
}): SafeAreaInsets {
  if (input.mode === "mini" || input.landscape) return { top: 0, right: 0, bottom: 0, left: 0 };
  const px = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0);
  return {
    top: 0,
    right: px(input.insets.right),
    bottom: input.keyboardOpen ? 0 : px(input.insets.bottom),
    left: px(input.insets.left),
  };
}

const CLOSE_NORMAL = 1000;
const MAX_CLOSE_MESSAGE = 200;

/** `sdk.close(code, message)`: normal olmayan kodla kapanışta gösterilecek mesaj; yoksa null. */
export function closeNotice(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const { code, message } = args as { code?: unknown; message?: unknown };
  if (code === CLOSE_NORMAL || code === undefined || code === null) return null;
  if (typeof message !== "string") return null;
  const clean = message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!clean) return null;
  return Array.from(clean).slice(0, MAX_CLOSE_MESSAGE).join("");
}
