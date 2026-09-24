import { cookieHeaderFor, getSession, refreshSession } from "@/api/client";
import { GATEWAY_URL, HEARTBEAT_INTERVAL_MS } from "@/lib/config";

/**
 * Rust ağ geçidi bağlantısı — ADR-0012 "tek gerçek zamanlı kapı".
 *
 * ciklet-web Socket.IO'yu tamamen kaldırdı (`/api/socket/io` üretimde 410
 * dönüyor). Gerçek zamanlı olan her şey — yeni mesaj fan-out'u, düzenleme,
 * tepki, presence, yazıyor göstergesi, ses kanalı listesi, çağrı ve
 * arkadaşlık bildirimleri — tek bir WebSocket'ten geliyor. HTTP'de kalanlar:
 * mesaj GÖNDERME, okundu bildirimi (`/api/read-state/ack`) ve çağrı
 * eylemleri (`/api/calls/*`).
 *
 * Protokol web'deki `src/lib/gateway/client.ts` ile BİREBİR:
 *   istemci → `{ event_type, ...snake_case alanlar }`
 *   sunucu  → `{ eventType, ...camelCase alanlar }`
 *   yeni mesaj → `messageId` + `chatId` taşıyan zarf, sohbet aboneliğine
 *   diğer her şey → `eventType`'a göre olay dinleyicilerine
 *
 * ── Kimlik ──────────────────────────────────────────────────────────────
 * Oturum JWT'si `Cookie` başlığıyla gider (React Native WebSocket'in üçüncü
 * argümanı başlık kabul ediyor). `Authorization` başlığı ya da `?token=`
 * KONULMAMALI: ağ geçidi onları görünce bot/aktivite jetonu yoluna giriyor
 * ve oturum JWT'si orada 401 alıyor. Origin'i RN bağlanılan adresten
 * türetiyor (wss://ciklet.xyz → https://ciklet.xyz), üretim izin listesinde.
 *
 * ── Yeniden bağlanma ────────────────────────────────────────────────────
 * Her dağıtımda ağ geçidi yeniden başlıyor ve tüm istemciler aynı anda
 * kopuyor. Geri çekilme üstel ve SAPMALI: sabit gecikmeyle bütün telefonlar
 * yeni süreci aynı milisaniyede devirirdi. Abonelikler bağlantıda değil bu
 * nesnede tutulur ve her açılışta yeniden gönderilir.
 */

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";

/** Tel üzerinden gelen kare — alanları olay türüne göre değişir. */
export type GatewayFrame = Record<string, unknown> & { eventType?: string };

/** Yeni mesaj zarfı (web: `lib/stream/events.ts` `MessageEvent`). */
export interface MessageEnvelope {
  version: number;
  eventType: "message.create" | string;
  eventId: string;
  messageId: string;
  scope: "channel" | "direct";
  chatId: string;
  serverId: string | null;
  authorId: string;
  memberId: string | null;
  content: string;
  messageType: string;
  fileUrl: string | null;
  metadata: Record<string, unknown> | null;
  replyTo: {
    messageId: string;
    authorId: string;
    authorUsername: string;
    preview: string;
    deleted: boolean;
    expiresAt?: string;
  } | null;
  author: {
    username: string;
    name: string | null;
    imageUrl: string | null;
    nickname: string | null;
    roleColor: string | null;
  };
  expiresAt: string | null;
  timestamp: string;
  clientNonce: string | null;
}

type Listener<T> = (payload: T) => void;

/**
 * React Native'in WebSocket kurucusu üçüncü argümanda başlık kabul ediyor;
 * TypeScript'in DOM tanımı bunu bilmiyor (tarayıcıda başlık gönderilemez).
 */
const NativeWebSocket = WebSocket as unknown as new (
  url: string,
  protocols: string | string[] | undefined,
  options: { headers: Record<string, string> }
) => WebSocket;

const OPEN_TIMEOUT_MS = 8_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30_000;
const SUBSCRIBE_RETRY_LIMIT = 7;
/**
 * Bu kadar ardışık el sıkışma başarısızlığından sonra oturum bir kez
 * yenilenir. Ağ geçidi 401'i WebSocket hatasından ayırt edilebilir biçimde
 * vermiyor; oturum iptal edildiyse (şifre değişti, NEXTAUTH_SECRET döndü)
 * yenileme 401 alır ve istemci zaten çıkış akışına düşer.
 */
const REFRESH_AFTER_FAILURES = 3;

/** Backoff + tam sapma: [backoff/2, backoff). */
function jittered(attempt: number): number {
  const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  return backoff / 2 + Math.random() * (backoff / 2);
}

class GatewayConnection {
  private socket: WebSocket | null = null;
  private opening = false;
  /** Oturum açıkken true; kapalıyken yeniden bağlanma planlanmaz. */
  private active = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private failuresSinceOpen = 0;
  private state: ConnectionState = "idle";

  private readonly chatListeners = new Map<string, Set<Listener<MessageEnvelope>>>();
  private readonly eventListeners = new Map<string, Set<Listener<GatewayFrame>>>();
  private readonly stateListeners = new Set<Listener<ConnectionState>>();
  private readonly openListeners = new Set<() => void>();
  private readonly subscribeRetries = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly subscribeAttempts = new Map<string, number>();
  /**
   * BİLEREK kapattığımız soketler. Kapanışları yeniden bağlanma planlamamalı
   * ve başarısız el sıkışma sayılmamalı; aksi hâlde oturum yenilemesinde
   * eski soketin kapanışı gereksiz ikinci bir bağlantı tetiklerdi.
   */
  private readonly retired = new WeakSet<WebSocket>();

  private retire(socket: WebSocket | null): void {
    if (!socket) return;
    this.retired.add(socket);
    socket.close();
  }

  // ── Yaşam döngüsü ──────────────────────────────────────────────────

  start(): void {
    this.active = true;
    void this.open();
  }

  stop(): void {
    this.active = false;
    this.clearReconnect();
    this.stopHeartbeat();
    for (const timer of this.subscribeRetries.values()) clearTimeout(timer);
    this.subscribeRetries.clear();
    this.subscribeAttempts.clear();
    this.retire(this.socket);
    this.socket = null;
    this.setState("idle");
  }

  /**
   * Bağlantıyı sıfırdan kurar — ön plana dönüşte ve oturum yenilendiğinde.
   * Açık bir soket varsa dokunulmaz; yalnızca kopuksa hemen dener.
   */
  wake(): void {
    if (!this.active) return;
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.clearReconnect();
    this.reconnectAttempt = 0;
    void this.open();
  }

  /** Oturum kimliği değişti: eski çerezle açılmış soket kapatılıp yenisi kurulur. */
  restart(): void {
    if (!this.active) return;
    this.retire(this.socket);
    this.socket = null;
    this.clearReconnect();
    this.reconnectAttempt = 0;
    void this.open();
  }

  private async open(): Promise<void> {
    if (!this.active || this.opening) return;
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.opening = true;
    this.setState(this.state === "connected" || this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    const session = await getSession();
    if (!session || !this.active) {
      this.opening = false;
      if (!session) this.setState("idle");
      return;
    }

    let socket: WebSocket;
    try {
      socket = new NativeWebSocket(GATEWAY_URL, undefined, {
        headers: { Cookie: cookieHeaderFor(session) },
      });
    } catch {
      this.opening = false;
      this.scheduleReconnect();
      return;
    }

    const timeout = setTimeout(() => socket.close(), OPEN_TIMEOUT_MS);

    socket.onopen = () => {
      clearTimeout(timeout);
      this.opening = false;
      if (!this.active) {
        this.retire(socket);
        return;
      }
      this.socket = socket;
      this.reconnectAttempt = 0;
      this.failuresSinceOpen = 0;
      this.resubscribeAll(socket);
      this.startHeartbeat();
      this.setState("connected");
      for (const listener of this.openListeners) listener();
    };

    socket.onmessage = (event) => this.handleFrame(event.data);

    socket.onerror = () => {
      // Ayrıntı `onclose`'da işleniyor; RN burada durum kodu vermiyor.
    };

    socket.onclose = () => {
      clearTimeout(timeout);
      if (this.retired.has(socket)) return;
      this.opening = false;
      const wasOpen = this.socket === socket;
      if (wasOpen) this.socket = null;
      this.stopHeartbeat();
      if (!this.active) return;
      if (!wasOpen) this.failuresSinceOpen += 1;
      this.setState("reconnecting");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.active || this.reconnectTimer) return;

    // El sıkışma üst üste reddediliyorsa en olası sebep bayat oturum:
    // bir kez yenilenir ve yeni çerezle denenir.
    if (this.failuresSinceOpen === REFRESH_AFTER_FAILURES) {
      void refreshSession();
    }

    const delay = jittered(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  /** Ağ geçidindeki presence kaydının ömrünü uzatır; gelmezse TTL dolar. */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ event_type: "heartbeat" });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) listener(next);
  }

  getState(): ConnectionState {
    return this.state;
  }

  isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ── Kareler ────────────────────────────────────────────────────────

  private handleFrame(raw: unknown): void {
    if (typeof raw !== "string") return;
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw) as GatewayFrame;
    } catch {
      return;
    }
    if (!frame || typeof frame !== "object") return;

    // Onay/hata kareleri. Mobil mesajı HTTP'den gönderiyor, bu yüzden
    // nonce'lu ack beklemiyor; nonce'suz hata abonelik reddidir.
    if (frame.type === "ack" || frame.type === "error") {
      if (frame.type === "error" && !frame.clientNonce) {
        const chatId = typeof frame.chatId === "string" ? frame.chatId : null;
        if (frame.retryable === true && chatId) {
          this.retrySubscribe(chatId);
        } else if (__DEV__) {
          console.warn("[gateway] reddedildi:", frame.code, chatId ?? "");
        }
      }
      return;
    }

    const eventType = frame.eventType;
    if (typeof eventType !== "string") return;

    if (eventType.startsWith("chat.")) {
      if (eventType === "chat.subscribed" && typeof frame.chatId === "string") {
        this.subscribeAttempts.delete(frame.chatId);
      }
      return;
    }

    // Mesaj zarfı mı, bağlantı düzeyinde olay mı? `messageId` ayırıyor:
    // yazıyor göstergesi de `chatId` taşıyor ama mesaj değil.
    if (typeof frame.messageId === "string" && typeof frame.chatId === "string") {
      const listeners = this.chatListeners.get(frame.chatId);
      if (listeners) {
        for (const listener of listeners) listener(frame as unknown as MessageEnvelope);
      }
      // Sohbet dışındaki dinleyiciler de (sohbet listesi önizlemesi) duysun.
      this.emit("message.create", frame);
      return;
    }

    this.emit(eventType, frame);
  }

  private emit(eventType: string, frame: GatewayFrame): void {
    const listeners = this.eventListeners.get(eventType);
    if (!listeners) return;
    for (const listener of listeners) listener(frame);
  }

  // ── Abonelikler ────────────────────────────────────────────────────

  private sendControl(socket: WebSocket, eventType: string, chatId: string): void {
    try {
      socket.send(JSON.stringify({ event_type: eventType, chat_id: chatId }));
    } catch {
      // Kapanmış soket; açılışta hepsi yeniden gönderilecek.
    }
  }

  private resubscribeAll(socket: WebSocket): void {
    for (const chatId of this.chatListeners.keys()) {
      this.sendControl(socket, "chat.subscribe", chatId);
    }
  }

  /** Geçici arızayla reddedilen aboneliği geri çekilerek yeniden dener. */
  private retrySubscribe(chatId: string): void {
    if (!this.active || !this.chatListeners.has(chatId) || this.subscribeRetries.has(chatId)) return;
    const attempt = this.subscribeAttempts.get(chatId) ?? 0;
    if (attempt >= SUBSCRIBE_RETRY_LIMIT) return;
    this.subscribeAttempts.set(chatId, attempt + 1);
    this.subscribeRetries.set(
      chatId,
      setTimeout(() => {
        this.subscribeRetries.delete(chatId);
        const socket = this.socket;
        if (socket?.readyState === WebSocket.OPEN && this.chatListeners.has(chatId)) {
          this.sendControl(socket, "chat.subscribe", chatId);
        }
      }, jittered(attempt))
    );
  }

  /**
   * Bir sohbetin yeni mesaj yayınlarını dinler. Aynı sohbete birden çok
   * dinleyici olabilir; ağ geçidine yalnızca bir kez abone olunur ve son
   * dinleyici gidince abonelik bırakılır (bağlantı başına 200 sınırı var).
   */
  subscribeToChat(chatId: string, listener: Listener<MessageEnvelope>): () => void {
    let listeners = this.chatListeners.get(chatId);
    const first = !listeners;
    if (!listeners) {
      listeners = new Set();
      this.chatListeners.set(chatId, listeners);
    }
    listeners.add(listener);

    const socket = this.socket;
    if (first && socket?.readyState === WebSocket.OPEN) {
      this.sendControl(socket, "chat.subscribe", chatId);
    }

    return () => {
      const current = this.chatListeners.get(chatId);
      if (!current) return;
      current.delete(listener);
      if (current.size > 0) return;
      this.chatListeners.delete(chatId);
      const retry = this.subscribeRetries.get(chatId);
      if (retry) clearTimeout(retry);
      this.subscribeRetries.delete(chatId);
      this.subscribeAttempts.delete(chatId);
      const open = this.socket;
      if (open?.readyState === WebSocket.OPEN) this.sendControl(open, "chat.unsubscribe", chatId);
    };
  }

  on(eventType: string, listener: Listener<GatewayFrame>): () => void {
    let listeners = this.eventListeners.get(eventType);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(eventType, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.eventListeners.get(eventType);
      current?.delete(listener);
      if (current?.size === 0) this.eventListeners.delete(eventType);
    };
  }

  onState(listener: Listener<ConnectionState>): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /** Her başarılı açılışta çağrılır — kaçırılan durumu yeniden istemek için. */
  onOpen(listener: () => void): () => void {
    this.openListeners.add(listener);
    return () => {
      this.openListeners.delete(listener);
    };
  }

  /**
   * Yanıt beklenmeyen olay gönderir. Bağlantı yoksa DÜŞÜRÜLÜR, kuyruğa
   * alınmaz: yeniden bağlanınca bayat bir "yazıyor" sinyali karşı tarafta
   * hayalet gösterge bırakırdı.
   */
  send(payload: Record<string, unknown>): boolean {
    const socket = this.socket;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }
}

const gateway = new GatewayConnection();

export const startGateway = () => gateway.start();
export const stopGateway = () => gateway.stop();
export const wakeGateway = () => gateway.wake();
export const restartGateway = () => gateway.restart();
export const isGatewayOpen = () => gateway.isOpen();
export const getConnectionState = () => gateway.getState();
export const onConnectionState = (listener: Listener<ConnectionState>) => gateway.onState(listener);
export const onGatewayOpen = (listener: () => void) => gateway.onOpen(listener);
export const onGatewayEvent = (eventType: string, listener: Listener<GatewayFrame>) =>
  gateway.on(eventType, listener);
export const subscribeToChat = (chatId: string, listener: Listener<MessageEnvelope>) =>
  gateway.subscribeToChat(chatId, listener);
export const sendGatewayEvent = (payload: Record<string, unknown>) => gateway.send(payload);
