/**
 * Ciklet sesli/görüntülü arama uçtan uca şifreleme oturumu (CSE v1) —
 * anahtar dağıtımı ve yenileme durum makinesi.
 *
 * BU DOSYA web ve mobil depolarında BİREBİR AYNIDIR (bkz. protocol.ts).
 * Platforma bağlı her şey (LiveKit veri kanalı, anahtar sağlayıcısı,
 * zamanlayıcı, rastgelelik) dışarıdan verilir; burada yalnızca protokol var.
 *
 * Akış:
 *  1. `installInitialKey()` — BAĞLANMADAN ÖNCE yerel gönderen anahtarı
 *     (sıra 0) takılır; ilk ses karesi de şifreli çıkar.
 *  2. `onConnected()` — açık anahtar herkese duyurulur (`hello`, r=false).
 *     Duyuruyu alan herkes kendi açık anahtarıyla yanıt verir (r=true).
 *  3. Yeni (ya da açık anahtarı değişmiş) bir katılımcı görülünce, biri
 *     ayrılınca ya da yeniden bağlanınca anahtar YENİLENİR (DAVE "epoch"u):
 *     yeni rastgele anahtar, bir sonraki sırada, o an odadaki her doğrulanmış
 *     katılımcıya ayrı ayrı sarılıp gönderilir. Herkes onaylayınca (`ack`) ya
 *     da süre dolunca yerel gönderici yeni anahtara geçer. Alıcılar eski
 *     anahtarı halkada tuttuğu için yoldaki kareler kaybolmaz.
 *  4. Yeni gelen yalnızca YENİ anahtarı alır (eski konuşmayı çözemez);
 *     ayrılan yeni anahtarı hiç almaz (geçişe kadar ~2 sn hariç — DAVE'de de
 *     aynı pencere var).
 */
import {
  E2EE_KEYRING_SIZE,
  encodeMessage,
  fromBase64,
  isValidIdentity,
  keyPairFromSeed,
  parseMessage,
  privacyCode,
  senderKeyPassphrase,
  toBase64,
  unwrapSenderKey,
  wrapSenderKey,
  type E2EEKeyPair,
  type E2EEMessage,
  type KeyMessage,
} from "./protocol";

/** LiveKit anahtar sağlayıcısına köprü (web işçisi ya da yerel şifreleyici). */
export interface VoiceE2EEKeySink {
  /** Yerel göndericinin anahtarını takar VE gönderimi bu sıraya geçirir. */
  setLocalKey(passphrase: string, index: number): Promise<void>;
  /** Uzak katılımcının anahtarını halkasındaki sıraya takar. */
  setRemoteKey(identity: string, passphrase: string, index: number): Promise<void>;
}

export interface VoiceE2EETransport {
  /** Güvenilir veri kanalı; `to` verilirse yalnızca o katılımcılara. */
  send(payload: Uint8Array, to?: string[]): Promise<void>;
}

export type Cancel = () => void;

export interface VoiceE2EESessionOptions {
  /** LiveKit oda adı (kanal / DM kimliği). */
  room: string;
  /** Yerel LiveKit kimliği (kullanıcı adı). */
  identity: string;
  /** Kriptografik rastgele baytlar (web: crypto.getRandomValues, mobil: expo-crypto). */
  random: (length: number) => Uint8Array;
  keys: VoiceE2EEKeySink;
  transport: VoiceE2EETransport;
  /**
   * Bu kimlik odada GÖRÜNÜR bir uzak katılımcı mı? Gizli (hidden) ya da
   * odada olmayan birinin duyurusu kabul edilmez — anahtar ona hiç gitmez.
   */
  isRemoteParticipant: (identity: string) => boolean;
  /** Medyamıza abone olabilecekler (anahtarımızı verdiğimiz katılımcılar). */
  onAllowedSubscribersChange?: (identities: string[]) => void;
  onError?: (error: unknown) => void;
  /** Ardışık giriş/çıkışları tek yenilemede toplar. */
  rotationDebounceMs?: number;
  /** Onay beklemenin üst sınırı; sonra yeni anahtara yine de geçilir. */
  ackTimeoutMs?: number;
  /** Testler için zamanlayıcı. */
  schedule?: (fn: () => void, ms: number) => Cancel;
  now?: () => number;
}

export type PeerStatus = "pending" | "encrypted";

export interface VoiceE2EESnapshot {
  /** Yerel anahtar takıldı mı (yayın şifreli çıkıyor mu)? */
  ready: boolean;
  /** Şu an gönderimde kullanılan anahtar sırası. */
  localKeyIndex: number;
  /** Yeni anahtar dağıtılıyor, henüz geçilmedi. */
  rotating: boolean;
  /**
   * Açık anahtarını duyurmuş katılımcılar. "encrypted": onun anahtarı da
   * elimizde (sesini çözebiliyoruz); "pending": anahtarı bekleniyor.
   */
  peers: Record<string, PeerStatus>;
  /** Ses gizlilik kodu (6 × 5 rakam); hazır değilse null. */
  code: string[] | null;
}

interface Peer {
  publicKey: Uint8Array;
  publicKeyText: string;
  /** Ondan aldığımız son anahtarın sırası; hiç almadıysak null. */
  receivedIndex: number | null;
}

interface SenderKey {
  index: number;
  key: Uint8Array;
}

interface PendingRotation extends SenderKey {
  awaiting: Set<string>;
}

/** Bir katılımcının 1 dakikada en fazla bu kadar açık anahtar değiştirmesine izin. */
const MAX_PUBLIC_KEY_CHANGES_PER_MINUTE = 5;
/** Duyurusu henüz gelmemiş göndericiden tamponlanan anahtar mesajı sınırı. */
const MAX_BUFFERED_KEYS = 4;

const defaultSchedule = (fn: () => void, ms: number): Cancel => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export class VoiceE2EESession {
  private readonly opts: Required<
    Pick<VoiceE2EESessionOptions, "rotationDebounceMs" | "ackTimeoutMs" | "schedule" | "now">
  > &
    VoiceE2EESessionOptions;
  private readonly keyPair: E2EEKeyPair;
  private readonly publicKeyText: string;
  private current: SenderKey;
  private nextIndex = 1;
  private pending: PendingRotation | null = null;
  private readonly peers = new Map<string, Peer>();
  private readonly buffered = new Map<string, KeyMessage[]>();
  private readonly keyChanges = new Map<string, number[]>();
  private readonly listeners = new Set<() => void>();
  private snapshot: VoiceE2EESnapshot;
  private ready = false;
  private connected = false;
  private disposed = false;
  private cancelRotation: Cancel | null = null;
  private cancelAckWait: Cancel | null = null;
  private lastAllowed = "";

  constructor(options: VoiceE2EESessionOptions) {
    if (!isValidIdentity(options.identity)) throw new Error("geçersiz LiveKit kimliği");
    this.opts = {
      rotationDebounceMs: 250,
      ackTimeoutMs: 2500,
      schedule: defaultSchedule,
      now: () => Date.now(),
      ...options,
    };
    this.keyPair = keyPairFromSeed(options.random(32));
    this.publicKeyText = toBase64(this.keyPair.publicKey);
    this.current = { index: 0, key: options.random(32) };
    this.snapshot = this.buildSnapshot();
  }

  // ── Dış olaylar ──────────────────────────────────────────────────────

  /** Bağlanmadan önce: ilk gönderen anahtarını takar. */
  async installInitialKey(): Promise<void> {
    await this.opts.keys.setLocalKey(senderKeyPassphrase(this.current.key), this.current.index);
    if (this.disposed) return;
    this.ready = true;
    this.emit();
  }

  /** Odaya bağlanıldı: açık anahtarı duyur. Abonelik izni boş listeyle başlar. */
  async onConnected(): Promise<void> {
    if (this.disposed) return;
    this.connected = true;
    this.lastAllowed = "\u0000"; // ilk bildirim her durumda gitsin
    this.publishAllowed();
    await this.send({ v: 1, t: "hello", pk: this.publicKeyText, r: false });
  }

  /**
   * LiveKit bağlantısı koptu ve geri geldi: karşı taraf bizi çıkmış sayıp
   * silmiş olabilir. Yeniden duyur ve anahtarı yenile.
   */
  async onReconnected(): Promise<void> {
    if (this.disposed) return;
    this.connected = true;
    this.lastAllowed = "\u0000";
    this.publishAllowed();
    await this.send({ v: 1, t: "hello", pk: this.publicKeyText, r: false });
    this.scheduleRotation();
  }

  onParticipantDisconnected(identity: string): void {
    this.buffered.delete(identity);
    if (!this.peers.delete(identity)) return;
    this.pending?.awaiting.delete(identity);
    this.publishAllowed();
    this.scheduleRotation();
    this.emit();
  }

  /** `E2EE_TOPIC` konulu veri mesajı. `from` LiveKit'in bildirdiği gönderen. */
  async handleData(from: string | undefined, payload: Uint8Array): Promise<void> {
    if (this.disposed || !from || from === this.opts.identity || !isValidIdentity(from)) return;
    if (!this.opts.isRemoteParticipant(from)) return;
    const message = parseMessage(payload);
    if (!message) return;
    try {
      switch (message.t) {
        case "hello":
          await this.onHello(from, message.pk, message.r);
          break;
        case "key":
          await this.onKey(from, message);
          break;
        case "ack":
          this.onAck(from, message.to, message.i);
          break;
      }
    } catch (error) {
      this.opts.onError?.(error);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRotation?.();
    this.cancelAckWait?.();
    this.cancelRotation = this.cancelAckWait = null;
    // Gizli malzemeyi bellekte bırakma (JS'te garanti değil, ama ucuz).
    this.keyPair.secretKey.fill(0);
    this.current.key.fill(0);
    this.pending?.key.fill(0);
    this.pending = null;
    this.peers.clear();
    this.buffered.clear();
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): VoiceE2EESnapshot {
    return this.snapshot;
  }

  // ── Mesaj işleyicileri ──────────────────────────────────────────────

  private async onHello(from: string, publicKeyText: string, isReply: boolean): Promise<void> {
    const existing = this.peers.get(from);
    if (existing && existing.publicKeyText === publicKeyText) {
      // Bilinen anahtarla yeniden duyuru: karşı taraf yeniden bağlandı ve bizi
      // unutmuş olabilir — yanıtla ve yenile (eski anahtarı ona VERME: arada
      // kaçırdığı konuşma ona açılmasın).
      if (!isReply) {
        await this.send({ v: 1, t: "hello", pk: this.publicKeyText, r: true }, [from]);
        this.scheduleRotation();
      }
      return;
    }
    if (existing && !this.allowKeyChange(from)) return;
    const publicKey = fromBase64(publicKeyText, 32);
    if (!publicKey) return;
    this.peers.set(from, { publicKey, publicKeyText, receivedIndex: null });
    this.publishAllowed();
    this.emit();
    if (!isReply) await this.send({ v: 1, t: "hello", pk: this.publicKeyText, r: true }, [from]);
    // Duyurudan önce gelmiş anahtar mesajları.
    const waiting = this.buffered.get(from);
    this.buffered.delete(from);
    for (const message of waiting ?? []) await this.onKey(from, message);
    this.scheduleRotation();
  }

  private async onKey(from: string, message: KeyMessage): Promise<void> {
    if (message.to !== this.opts.identity) return;
    const peer = this.peers.get(from);
    if (!peer) {
      const list = this.buffered.get(from) ?? [];
      if (list.length < MAX_BUFFERED_KEYS) this.buffered.set(from, [...list, message]);
      return;
    }
    const senderKey = unwrapSenderKey({
      room: this.opts.room,
      sender: from,
      recipient: this.opts.identity,
      recipientKeyPair: this.keyPair,
      senderPublicKey: peer.publicKey,
      message,
    });
    if (!senderKey) return;
    const passphrase = senderKeyPassphrase(senderKey);
    senderKey.fill(0);
    await this.opts.keys.setRemoteKey(from, passphrase, message.i);
    // Beklerken katılımcı çıkmış ya da anahtarını değiştirmiş olabilir.
    if (this.disposed || this.peers.get(from) !== peer) return;
    peer.receivedIndex = message.i;
    this.emit();
    await this.send({ v: 1, t: "ack", to: from, i: message.i }, [from]);
  }

  private onAck(from: string, to: string, index: number): void {
    const pending = this.pending;
    if (to !== this.opts.identity || !pending || pending.index !== index) return;
    pending.awaiting.delete(from);
    if (pending.awaiting.size === 0) void this.commit(pending);
  }

  // ── Anahtar yenileme ────────────────────────────────────────────────

  private scheduleRotation(): void {
    if (this.disposed || !this.connected) return;
    this.cancelRotation?.();
    this.cancelRotation = this.opts.schedule(() => {
      this.cancelRotation = null;
      void this.rotate().catch((error) => this.opts.onError?.(error));
    }, this.opts.rotationDebounceMs);
  }

  /** Testler ve zorunlu yenileme için doğrudan çağrılabilir. */
  async rotate(): Promise<void> {
    if (this.disposed) return;
    this.cancelAckWait?.();
    this.cancelAckWait = null;
    this.pending?.key.fill(0);

    let index = this.nextIndex;
    // Hiç geçilmemiş yenilemeler üst üste binerse sıra kullanımdakine
    // dönebilir; kullanımdaki anahtarın üstüne yazılmasın.
    if (index === this.current.index) index = (index + 1) % E2EE_KEYRING_SIZE;
    this.nextIndex = (index + 1) % E2EE_KEYRING_SIZE;

    const recipients = [...this.peers.keys()].filter((identity) => this.opts.isRemoteParticipant(identity));
    const pending: PendingRotation = { index, key: this.opts.random(32), awaiting: new Set(recipients) };
    this.pending = pending;
    this.emit();

    for (const recipient of recipients) {
      const peer = this.peers.get(recipient);
      if (!peer) continue;
      const message = wrapSenderKey({
        room: this.opts.room,
        sender: this.opts.identity,
        recipient,
        senderKeyPair: this.keyPair,
        recipientPublicKey: peer.publicKey,
        index,
        senderKey: pending.key,
        nonce: this.opts.random(12),
      });
      await this.send(message, [recipient]);
      if (this.pending !== pending) return; // bu arada yeni bir yenileme başladı
    }

    if (pending.awaiting.size === 0) {
      await this.commit(pending);
      return;
    }
    this.cancelAckWait = this.opts.schedule(() => {
      this.cancelAckWait = null;
      void this.commit(pending).catch((error) => this.opts.onError?.(error));
    }, this.opts.ackTimeoutMs);
  }

  private async commit(pending: PendingRotation): Promise<void> {
    if (this.disposed || this.pending !== pending) return;
    this.pending = null;
    this.cancelAckWait?.();
    this.cancelAckWait = null;
    await this.opts.keys.setLocalKey(senderKeyPassphrase(pending.key), pending.index);
    if (this.disposed) return;
    this.current.key.fill(0);
    this.current = { index: pending.index, key: pending.key };
    this.emit();
  }

  // ── Yardımcılar ─────────────────────────────────────────────────────

  private allowKeyChange(identity: string): boolean {
    const now = this.opts.now();
    const recent = (this.keyChanges.get(identity) ?? []).filter((at) => now - at < 60_000);
    if (recent.length >= MAX_PUBLIC_KEY_CHANGES_PER_MINUTE) return false;
    this.keyChanges.set(identity, [...recent, now]);
    return true;
  }

  private publishAllowed(): void {
    if (!this.connected || !this.opts.onAllowedSubscribersChange) return;
    const allowed = [...this.peers.keys()].filter((identity) => this.opts.isRemoteParticipant(identity)).sort();
    const signature = allowed.join("\n");
    if (signature === this.lastAllowed) return;
    this.lastAllowed = signature;
    this.opts.onAllowedSubscribersChange(allowed);
  }

  private async send(message: E2EEMessage, to?: string[]): Promise<void> {
    if (this.disposed || !this.connected) return;
    try {
      await this.opts.transport.send(encodeMessage(message), to);
    } catch (error) {
      this.opts.onError?.(error);
    }
  }

  private buildSnapshot(): VoiceE2EESnapshot {
    const peers: Record<string, PeerStatus> = {};
    for (const [identity, peer] of this.peers) peers[identity] = peer.receivedIndex === null ? "pending" : "encrypted";
    return {
      ready: this.ready,
      localKeyIndex: this.current.index,
      rotating: this.pending !== null,
      peers,
      code: this.ready
        ? privacyCode(this.opts.room, [
            { identity: this.opts.identity, publicKey: this.keyPair.publicKey },
            ...[...this.peers.entries()].map(([identity, peer]) => ({ identity, publicKey: peer.publicKey })),
          ])
        : null,
    };
  }

  private emit(): void {
    if (this.disposed) return;
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}

/**
 * LiveKit token'ından yerel kimlik (`sub`) ve oda (`video.room`). Yerel
 * anahtar bağlanmadan ÖNCE kimliğe takıldığı için kimliği tahmin etmek
 * yerine sunucunun bastığı token'dan okuruz. İmza doğrulanmaz — yalnızca
 * kendi token'ımızı okuyoruz; yanlışsa LiveKit bağlantıyı zaten kurmaz.
 */
export function livekitTokenClaims(token: string): { identity: string; room: string } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  let base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const bytes = fromBase64(base64);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown; video?: { room?: unknown } };
    const identity = payload.sub;
    const room = payload.video?.room;
    if (!isValidIdentity(identity) || typeof room !== "string" || room.length === 0) return null;
    return { identity, room };
  } catch {
    return null;
  }
}

/**
 * İstemci kararı: oda uçtan uca şifreli mi? Yalnızca sunucu yanıtı açıkça
 * `e2ee: true` derse (VOICE_E2EE_ENABLED açık ve sahne değil). Alan yoksa
 * (eski sunucu) ya da başka bir değerse şifreleme YOK — istemci eskisi gibi
 * katılır. Böylece özellik sürüm çıkarmadan sunucudan açılıp kapatılır.
 */
export function roomUsesE2EE(response: { e2ee?: unknown; stage?: unknown } | null | undefined): boolean {
  return Boolean(response) && response!.e2ee === true && !response!.stage;
}
