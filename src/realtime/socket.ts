import { io, type Socket } from "socket.io-client";
import { SOCKET_PATH } from "@ciklet/embedded-activities-sdk/types";

import { cookieHeaderFor, getSession } from "@/api/client";
import { API_BASE_URL, HEARTBEAT_INTERVAL_MS } from "@/lib/config";
import { CLIENT_TYPE, CLIENT_VERSION } from "@/lib/device";
import { ClientEvent, ServerEvent } from "./events";

/**
 * Tekil Socket.IO bağlantısı ve yaşam döngüsü.
 *
 * Kimlik el sıkışmadaki `Cookie` başlığıyla taşınır — sunucu tarafındaki
 * `io.use()` ara katmanı bunu tarayıcı oturumuyla aynı yoldan doğrular.
 * React Native'de `extraHeaders` websocket taşımasında ÇALIŞIR: engine.io
 * istemcisi RN'i algılayıp seçenekleri `new WebSocket(url, protocols, opts)`
 * üçüncü argümanına aktarır (tarayıcıda bu mümkün değildir).
 *
 * Bağlantı yalnızca burada kurulur/kapatılır; ekranlar `getSocket()` ile
 * mevcut örneği alır, asla kendileri `io()` çağırmaz.
 */

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

/**
 * Abone olunan sohbetler. Yeniden bağlanmada sunucu oda üyeliklerini
 * unutur; `connect` olayında bu küme yeniden gönderilir. Bu olmadan ağ
 * dalgalanmasından sonra sohbet sessizce ölür.
 */
const subscribedChats = new Set<string>();

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";

type StateListener = (state: ConnectionState) => void;
const stateListeners = new Set<StateListener>();
let connectionState: ConnectionState = "idle";

export function getConnectionState(): ConnectionState {
  return connectionState;
}

export function onConnectionState(listener: StateListener): () => void {
  stateListeners.add(listener);
  listener(connectionState);
  return () => {
    stateListeners.delete(listener);
  };
}

function setState(next: ConnectionState) {
  if (connectionState === next) return;
  connectionState = next;
  for (const listener of stateListeners) listener(next);
}

/**
 * Bağlantıyı kurar (veya mevcut olanı döner). Oturum yoksa `null` döner —
 * çağıranların bunu ele alması gerekir.
 */
export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const session = await getSession();
    if (!session) {
      setState("idle");
      return null;
    }

    setState("connecting");

    const next = io(API_BASE_URL, {
      path: SOCKET_PATH,
      // Yalnızca websocket: RN'de HTTP long-polling hem pil hem gecikme
      // açısından pahalı ve yükseltme el sıkışması gereksiz.
      transports: ["websocket"],
      extraHeaders: { Cookie: cookieHeaderFor(session) },
      query: { clientType: CLIENT_TYPE, clientVersion: CLIENT_VERSION },
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      // Kimlik hatasında sonsuz denemek anlamsız; oturum yenilenince
      // `reconnectSocket()` zaten sıfırdan kurar.
      reconnectionAttempts: 20,
      timeout: 10_000,
    });

    next.on("connect", () => {
      setState("connected");
      // Kesintiden sonra oda üyeliklerini geri kur.
      if (subscribedChats.size > 0) {
        next.emit(ClientEvent.CHAT_SUBSCRIBE, {
          chatIds: Array.from(subscribedChats),
        });
      }
      // Presence aboneliklerini tazele (arkadaş/sunucu listesi değişmiş olabilir).
      next.emit(ClientEvent.PRESENCE_SYNC);
    });

    next.on("disconnect", (reason) => {
      setState(reason === "io client disconnect" ? "idle" : "reconnecting");
    });

    next.on("connect_error", (err) => {
      setState("reconnecting");
      if (__DEV__) console.warn("[socket] bağlantı hatası:", err.message);
    });

    if (__DEV__) {
      next.on(ServerEvent.READY, () => console.log("[socket] hazır"));
    }

    socket = next;
    startHeartbeat();
    return next;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

/** Mevcut bağlantıyı döner; yoksa kurar. */
export async function getSocket(): Promise<Socket | null> {
  return socket ?? connectSocket();
}

/** Senkron erişim — olay dinleyicisi kaydı gibi "varsa kullan" durumları için. */
export function peekSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  stopHeartbeat();
  subscribedChats.clear();
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  setState("idle");
}

/** Token yenilendiğinde çağrılır: el sıkışma başlığı eskidiği için sıfırdan kurulur. */
export async function reconnectSocket(): Promise<Socket | null> {
  const chats = Array.from(subscribedChats);
  disconnectSocket();
  const next = await connectSocket();
  for (const chatId of chats) subscribedChats.add(chatId);
  return next;
}

// ── Sohbet aboneliği ────────────────────────────────────────────────

export function subscribeToChat(chatId: string) {
  subscribedChats.add(chatId);
  socket?.emit(ClientEvent.CHAT_SUBSCRIBE, { chatId });
}

/**
 * Odadan çıkmak İSTEĞE BAĞLIDIR ve varsayılan olarak yapılmaz: DM listesi
 * de aynı odaları "son mesaj" güncellemesi için dinler. Web istemcisi de
 * aynı nedenle `chat:unsubscribe` göndermez.
 */
export function unsubscribeFromChat(chatId: string) {
  subscribedChats.delete(chatId);
  socket?.emit(ClientEvent.CHAT_UNSUBSCRIBE, { chatId });
}

// ── Canlılık sinyali ────────────────────────────────────────────────

function startHeartbeat() {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    if (socket?.connected) socket.emit(ClientEvent.HEARTBEAT);
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}
