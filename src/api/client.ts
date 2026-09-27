import type {
  MobileAuthRefreshResponse,
  MobileAuthRequest,
  MobileAuthResponse,
} from "@ciklet/embedded-activities-sdk/types";

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/lib/config";
import { CLIENT_TYPE, CLIENT_VERSION, getDeviceId } from "@/lib/device";
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from "@/lib/storage";
import { endpoints } from "./endpoints";

/**
 * Ciklet HTTP istemcisi.
 *
 * Kimlik modeli: `/api/mobile/auth`'tan alınan NextAuth oturum token'ı her
 * isteğe `Cookie: <cookieName>=<token>` başlığıyla eklenir. Sunucudaki
 * `getServerSession` bunu normal tarayıcı oturumu gibi görür — ciklet-web'de
 * TEK BİR ROTA bile değiştirmek gerekmez.
 */

// ── Hata modeli ─────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Bazı uçlar makine-okunur kod döner (ör. `server_limit`). */
    readonly code?: string,
    /** Çözülmüş JSON gövdesi — koda eşlik eden ayrıntı için (ör. ban bilgisi). */
    readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Oturum düşmüş — arayüz giriş ekranına dönmeli. */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** Ağ yok / zaman aşımı — "tekrar dene" göstermek anlamlı. */
  get isNetwork() {
    return this.status === 0;
  }
}

/**
 * ciklet-web iki farklı hata biçimi döndürüyor: bir kısım rota
 * `NextResponse.json({ error })`, bir kısmı düz metin
 * `new NextResponse("Unauthorized")`. İkisi de tek `ApiError`'a normalize
 * edilir; aksi halde kullanıcıya ham HTML ya da hiç mesaj gösterilmez.
 */
async function toApiError(res: Response): Promise<ApiError> {
  const raw = await res.text().catch(() => "");

  if (raw) {
    try {
      const body = JSON.parse(raw) as { error?: string; code?: string };
      if (typeof body?.error === "string" && body.error) {
        return new ApiError(res.status, body.error, body.code, body);
      }
    } catch {
      /* JSON değil — düz metin gövde. */
    }
    // Sunucu HTML hata sayfası döndürmüşse kullanıcıya gösterme.
    if (!raw.trimStart().startsWith("<") && raw.length < 300) {
      return new ApiError(res.status, raw.trim());
    }
  }

  return new ApiError(res.status, res.statusText || `HTTP ${res.status}`);
}

// ── Oturum önbelleği ────────────────────────────────────────────────

let cachedSession: StoredSession | null = null;
let sessionLoaded = false;

export async function getSession(): Promise<StoredSession | null> {
  if (!sessionLoaded) {
    cachedSession = await loadSession();
    sessionLoaded = true;
  }
  return cachedSession;
}

/** Senkron erişim — oturumun yüklü olduğu bilinen yerler (soket kurulumu) için. */
export function peekSession(): StoredSession | null {
  return cachedSession;
}

export function cookieHeaderFor(session: StoredSession): string {
  return `${session.cookieName}=${encodeURIComponent(session.token)}`;
}

async function persist(session: StoredSession) {
  cachedSession = session;
  sessionLoaded = true;
  await saveSession(session);
}

// ── Oturum düşme bildirimi ──────────────────────────────────────────
// Zustand store'unu buradan import etmek döngüsel bağımlılık yaratırdı
// (store → client → store). Bunun yerine dinleyici kaydı kullanılır.

type SessionExpiredListener = () => void;
const expiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

// ── Ban bildirimi ───────────────────────────────────────────────────
// Yenileme banlı hesaba `account_banned` dönerse oturum düşer ve ekran
// "oturumun bitti" yerine ban ekranını göstermeli (web: /banned).

export interface BanNotice {
  kind: "account" | "device";
  reason: string | null;
  /** "TEMPORARY" ise `expiresAt` kalkış zamanı. */
  type: string | null;
  expiresAt: string | null;
}

/** 403 gövdesinden ban bilgisini çıkarır; ban değilse null. */
export function banNoticeFrom(err: unknown): BanNotice | null {
  if (!(err instanceof ApiError) || err.status !== 403) return null;
  if (err.code === "device_banned") return { kind: "device", reason: null, type: null, expiresAt: null };
  if (err.code !== "account_banned") return null;
  const ban = (err.body as { ban?: Record<string, unknown> } | undefined)?.ban ?? {};
  return {
    kind: "account",
    reason: typeof ban.reason === "string" && ban.reason ? ban.reason : null,
    type: typeof ban.type === "string" ? ban.type : null,
    expiresAt: typeof ban.expiresAt === "string" ? ban.expiresAt : null,
  };
}

type BannedListener = (notice: BanNotice) => void;
const bannedListeners = new Set<BannedListener>();

export function onAccountBanned(listener: BannedListener): () => void {
  bannedListeners.add(listener);
  return () => {
    bannedListeners.delete(listener);
  };
}

function notifyBanned(notice: BanNotice) {
  for (const listener of bannedListeners) {
    try {
      listener(notice);
    } catch (err) {
      if (__DEV__) console.warn("[api] ban dinleyicisi hata verdi", err);
    }
  }
}

function notifySessionExpired() {
  for (const listener of expiredListeners) {
    try {
      listener();
    } catch (err) {
      if (__DEV__) console.warn("[api] oturum-düştü dinleyicisi hata verdi", err);
    }
  }
}

// ── İstek ───────────────────────────────────────────────────────────

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Nesne verilirse JSON'a çevrilir ve Content-Type ayarlanır. */
  body?: unknown;
  /** Varsayılan REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Kimlik başlığı eklenmesin (giriş ucu). */
  skipAuth?: boolean;
  /** 401'de sessiz yenileme denenmesin — sonsuz döngüyü önler. */
  skipRefresh?: boolean;
}

/** Yanıt + isteğin hangi oturum token'ıyla gittiği (yoksa null). */
interface RawResult {
  res: Response;
  sentToken: string | null;
}

async function rawRequest(path: string, options: RequestOptions): Promise<RawResult> {
  const { body, timeoutMs = REQUEST_TIMEOUT_MS, skipAuth, skipRefresh: _s, ...init } = options;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      payload = body; // Content-Type'ı fetch kendi sınır dizesiyle koyar.
    } else if (typeof body === "string") {
      payload = body;
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    } else {
      payload = JSON.stringify(body);
      headers.set("Content-Type", "application/json");
    }
  }

  let sentToken: string | null = null;
  if (!skipAuth) {
    const session = await getSession();
    if (session) {
      headers.set("Cookie", cookieHeaderFor(session));
      sentToken = session.token;
    }
  }

  // AbortSignal.timeout() Hermes'in her sürümünde yok — elle kuruluyor.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: payload,
      signal: controller.signal,
      // Yerel çerez kavanozu KULLANILMAZ: Android'de kavanozda tek bir çerez
      // bile varsa elle yazdığımız `Cookie` başlığını eziyor (bkz.
      // lib/cookies.ts). Kimlik yalnızca SecureStore'daki token'dan gelir.
      credentials: "omit",
    });
    return { res, sentToken };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ApiError(
      0,
      aborted ? "İstek zaman aşımına uğradı." : "Sunucuya ulaşılamıyor."
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tipli API çağrısı. 401 alındığında bir kez sessiz yenileme denenir; o da
 * başarısızsa oturum düşürülür ve dinleyiciler bilgilendirilir.
 *
 * Oturum YALNIZCA 401'i alan istek bir oturumla gittiyse ve o oturum hâlâ
 * geçerli olansa düşürülür. Oturumsuz giden bir isteğin 401'i "oturum
 * bitti" demek değil; bu istekler çıkışa yol açsaydı, kullanıcı tam o
 * sırada giriş yaptığında yeni kaydedilen oturum silinebilirdi (giriş
 * yapan kullanıcının anında çıkışa düşmesi bu yarıştan da besleniyordu).
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const first = await rawRequest(path, options);
  let res = first.res;

  if (res.status === 401 && first.sentToken && !options.skipRefresh && !options.skipAuth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = (await rawRequest(path, { ...options, skipRefresh: true })).res;
    } else if ((await getSession())?.token === first.sentToken) {
      await logout();
      notifySessionExpired();
    }
  }

  if (!res.ok) throw await toApiError(res);

  // 204 ve gövdesiz 200'ler JSON.parse'ı patlatır.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Kimlik akışı ────────────────────────────────────────────────────

export interface LoginResult extends MobileAuthResponse {
  /**
   * Hesap telefon doğrulamasını bitirmemiş: dönen token KISITLI (sunucu
   * yalnızca doğrulama uçlarını açıyor). Yalnızca istekte
   * `phoneVerification` bildirildiyse gelir; eski sunucu bunun yerine
   * `phone_verification_required` koduyla 403 döner.
   */
  phoneVerificationRequired?: boolean;
  /** Sözleşme kabul edilmedi; token yalnızca kabul/doğrulama uçlarını açar. */
  eulaRequired?: boolean;
}

export async function login(
  credentials: Pick<MobileAuthRequest, "username" | "password"> & {
    /** İki adımlı doğrulama kodu ya da kurtarma kodu; sunucu `totp_required` dediyse. */
    totp?: string;
  }
): Promise<LoginResult> {
  const data = await api<LoginResult>(endpoints.auth.login, {
    method: "POST",
    skipAuth: true,
    body: {
      ...credentials,
      clientType: CLIENT_TYPE,
      clientVersion: CLIENT_VERSION,
      // Donanım banı kontrolü bu alanı okur (ciklet-web lib/hwid.ts).
      hwid: await getDeviceId(),
      // Uygulamada Telegram doğrulama ve sözleşme ekranları var: bu
      // hesaplara 403 yerine kısıtlı oturum verilebilir. Bayrak olmadan
      // sunucu eski davranışta kalır — ekranı olmayan sürümler kısıtlı
      // oturumla her istekte 403 alıp bozulurdu.
      phoneVerification: "telegram",
      eulaScreen: true,
    },
  });

  await persist({
    token: data.token,
    cookieName: data.cookieName,
    expiresAt: data.expiresAt,
    ...(data.phoneVerificationRequired ? { phonePending: true } : {}),
  });
  return data;
}

/**
 * Kayan yenileme. Eşzamanlı birden çok 401 tek bir yenileme uçuşuna
 * indirgenir — aksi halde her istek ayrı yenileme tetikler ve sunucu
 * gereksiz token üretir.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    const data = await api<MobileAuthRefreshResponse>(endpoints.auth.refresh, {
      method: "POST",
      skipRefresh: true,
    });
    await persist({
      token: data.token,
      cookieName: data.cookieName,
      expiresAt: data.expiresAt,
    });
    return true;
  } catch (err) {
    // 401 = token ölü (süresi doldu, şifre değişti). 403 `account_banned`
    // = hesap banlandı; ban ekranı gösterilir. Ağ hatasında oturumu
    // DÜŞÜRME — kullanıcı çevrimdışı olabilir. Bu arada yeni bir giriş
    // yapıldıysa (token değiştiyse) o oturuma dokunulmaz.
    //
    // Arayüz burada bilgilendirilmek ZORUNDA: eskiden yalnızca oturum
    // siliniyordu; 401'i alan `api()` artık farklı (boş) oturum gördüğü için
    // bildirimi atlıyor ve uygulama oturumsuz "girişli" ekranda kalıyordu.
    const ban = banNoticeFrom(err);
    if ((ban || (err instanceof ApiError && err.isUnauthorized)) && (await getSession())?.token === session.token) {
      await logout();
      if (ban) notifyBanned(ban);
      else notifySessionExpired();
    }
    return false;
  }
}

export async function logout(): Promise<void> {
  cachedSession = null;
  sessionLoaded = true;
  await clearSession();
}
