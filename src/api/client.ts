import type {
  ApiErrorResponse,
  MobileAuthRefreshResponse,
  MobileAuthRequest,
  MobileAuthResponse,
} from "@ciklet/embedded-activities-sdk/types";

import { API_BASE_URL } from "@/lib/config";
import { loadSession, saveSession, clearSession } from "@/lib/storage";

/**
 * Ciklet API istemcisi.
 *
 * Auth modeli: /api/mobile/auth'tan alınan NextAuth oturum token'ı, her
 * isteğe `Cookie: <cookieName>=<token>` başlığıyla eklenir — sunucudaki
 * getServerSession bunu normal tarayıcı oturumu gibi görür, hiçbir rota
 * değişikliği gerekmez. 401'de oturum düşmüş sayılır.
 */

let cachedSession: { token: string; cookieName: string } | null = null;

export async function getSession() {
  if (!cachedSession) cachedSession = await loadSession();
  return cachedSession;
}

export function cookieHeaderFor(session: { token: string; cookieName: string }) {
  return `${session.cookieName}=${encodeURIComponent(session.token)}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session) headers.set("Cookie", cookieHeaderFor(session));

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorResponse;
      if (body?.error) message = body.error;
    } catch {
      /* gövde JSON olmayabilir */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

// ── Auth akışı ──────────────────────────────────────────────────────

export async function login(req: MobileAuthRequest): Promise<MobileAuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/mobile/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(res.status, body?.error ?? "Giriş başarısız");
  }
  const data = (await res.json()) as MobileAuthResponse;
  await saveSession(data.token, data.cookieName);
  cachedSession = { token: data.token, cookieName: data.cookieName };
  return data;
}

/** Kayan yenileme — açılışta ve periyodik olarak çağrılır. */
export async function refreshSession(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  try {
    const data = await api<MobileAuthRefreshResponse>("/api/mobile/auth/refresh", {
      method: "POST",
    });
    await saveSession(data.token, data.cookieName);
    cachedSession = { token: data.token, cookieName: data.cookieName };
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await logout();
    }
    return false;
  }
}

export async function logout() {
  cachedSession = null;
  await clearSession();
}
