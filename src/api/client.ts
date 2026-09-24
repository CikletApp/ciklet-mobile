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
    readonly code?: string
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
        return new ApiError(res.status, body.error, body.code);
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

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
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

  if (!skipAuth) {
    const session = await getSession();
    if (session) headers.set("Cookie", cookieHeaderFor(session));
  }

  // AbortSignal.timeout() Hermes'in her sürümünde yok — elle kuruluyor.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: payload,
      signal: controller.signal,
      // Yerel çerez kavanozu KULLANILMAZ: Android'de kavanozda tek bir çerez
      // bile varsa elle yazdığımız `Cookie` başlığını eziyor (bkz.
      // lib/cookies.ts). Kimlik yalnızca SecureStore'daki token'dan gelir.
      credentials: "omit",
    });
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
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !options.skipRefresh && !options.skipAuth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawRequest(path, { ...options, skipRefresh: true });
    } else {
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

export async function login(
  credentials: Pick<MobileAuthRequest, "username" | "password">
): Promise<MobileAuthResponse> {
  const data = await api<MobileAuthResponse>(endpoints.auth.login, {
    method: "POST",
    skipAuth: true,
    body: {
      ...credentials,
      clientType: CLIENT_TYPE,
      clientVersion: CLIENT_VERSION,
      // Donanım banı kontrolü bu alanı okur (ciklet-web lib/hwid.ts).
      hwid: await getDeviceId(),
    },
  });

  await persist({
    token: data.token,
    cookieName: data.cookieName,
    expiresAt: data.expiresAt,
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
    // 401 = token ölü (süresi doldu, şifre değişti, hesap banlandı).
    // Ağ hatasında oturumu DÜŞÜRME — kullanıcı çevrimdışı olabilir.
    if (err instanceof ApiError && err.isUnauthorized) {
      await logout();
    }
    return false;
  }
}

export async function logout(): Promise<void> {
  cachedSession = null;
  sessionLoaded = true;
  await clearSession();
}
