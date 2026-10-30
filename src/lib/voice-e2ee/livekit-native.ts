/**
 * Uçtan uca şifreli ses — mobil (iOS/Android) LiveKit köprüsü.
 *
 * Web karşılığı: ciklet-web src/lib/voice-e2ee/livekit-web.ts. Protokol ve
 * durum makinesi (protocol.ts, session.ts) iki tarafta birebir aynı; burada
 * yalnızca platforma özgü kısım var:
 *  - Çerçeveleri yerel WebRTC'nin FrameCryptor'ı şifreler (AES-GCM,
 *    @livekit/react-native-webrtc). Anahtar türetmesi web işçisiyle aynı:
 *    parola (UTF-8) → PBKDF2-SHA256(tuz = E2EE_RATCHET_SALT) → AES-128.
 *  - Anahtar mesajları LiveKit veri kanalından (`E2EE_TOPIC`) gider.
 *
 * SDK'nın RNKeyProvider'ı yerine kendi sağlayıcımız, çünkü:
 *  - `discardFrameWhenCryptorNotReady` SDK'da sabit `false`: anahtar hazır
 *    değilken yerel şifreleyici kareyi ŞİFRESİZ geçirir. Biz `true`
 *    veriyoruz — anahtarsız kare düşer, düz metin asla çıkmaz.
 *  - "Şifresiz sihirli baytlar" (varsayılan "LK-ROCKS") ve sunucunun
 *    enjekte ettiği kare (SIF) sonekiyle biten kareler çözülmeden çalınır;
 *    sunucu bunu bilerek araya düz ses sokabilirdi. Sihirli baytlar oturum
 *    başına rastgele, SIF soneki hiç kurulmuyor (web işçisi SIF içeriğini
 *    ayrıca doğruluyor; yerelde bu doğrulama yok).
 *  - Kendi göndericimizin anahtar sırasını yenilemede ilerletmek gerekiyor;
 *    SDK bunu yalnızca parça yayınlanırken bir kez yapıyor.
 */
import { RNE2EEManager, type RNKeyProvider } from "@livekit/react-native";
import {
  RTCFrameCryptorFactory,
  RTCKeyDerivationAlgorithm,
  type RTCFrameCryptor,
  type RTCKeyProvider,
} from "@livekit/react-native-webrtc";
import * as Crypto from "expo-crypto";
import {
  BaseKeyProvider,
  RoomEvent,
  TrackPublication,
  type E2EEOptions,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
} from "livekit-client";

import { E2EE_KEYRING_SIZE, E2EE_RATCHET_SALT, E2EE_TOPIC } from "./protocol";
import { livekitTokenClaims, VoiceE2EESession } from "./session";

class CikletNativeKeyProvider extends BaseKeyProvider {
  private readonly latestIndex = new Map<string, number>();
  private readonly native: RTCKeyProvider;

  constructor() {
    super({
      sharedKey: false,
      ratchetSalt: E2EE_RATCHET_SALT,
      ratchetWindowSize: 0,
      failureTolerance: -1,
      keyringSize: E2EE_KEYRING_SIZE,
      keySize: 128,
    });
    this.native = RTCFrameCryptorFactory.createDefaultKeyProvider({
      sharedKey: false,
      ratchetSalt: E2EE_RATCHET_SALT,
      ratchetWindowSize: 0,
      failureTolerance: -1,
      keyRingSize: E2EE_KEYRING_SIZE,
      discardFrameWhenCryptorNotReady: true,
      keyDerivationAlgorithm: RTCKeyDerivationAlgorithm.PBKDF2,
      uncryptedMagicBytes: Crypto.getRandomBytes(16),
    });
  }

  /** RNE2EEManager yeni parçada şifreleyicinin sırasını buradan alır. */
  getLatestKeyIndex(participantId: string): number {
    return this.latestIndex.get(participantId) ?? 0;
  }

  async setKey(participantId: string, key: string, keyIndex: number): Promise<void> {
    this.latestIndex.set(participantId, keyIndex);
    await this.native.setKey(participantId, key, keyIndex);
  }

  /** Otomatik "ratchet" yok: anahtarlar yalnızca protokolle değişir. */
  override ratchetKey(): void {}

  /** Sunucu enjekte karelerine (SIF) çözmeden geçiş verilmez. */
  async setSifTrailer(): Promise<void> {}

  get rtcKeyProvider(): RTCKeyProvider {
    return this.native;
  }

  dispose(): void {
    this.native.dispose();
  }
}

/** Yenilemede kendi göndericimizi yeni anahtar sırasına geçirebilen yönetici. */
class CikletE2EEManager extends RNE2EEManager {
  async useLocalKeyIndex(room: Room, index: number): Promise<void> {
    // SDK şifreleyicileri özel bir haritada tutuyor (parça kimliği → şifreleyici).
    const cryptors = (this as unknown as { frameCryptors: Map<string, RTCFrameCryptor> }).frameCryptors;
    for (const trackSid of room.localParticipant.trackPublications.keys()) {
      await cryptors.get(trackSid)?.setKeyIndex(index);
    }
  }
}

export class NativeVoiceE2EE {
  readonly session: VoiceE2EESession;
  private readonly keyProvider = new CikletNativeKeyProvider();
  private readonly manager: CikletE2EEManager;
  private room: Room | null = null;
  private detachRoom: (() => void) | null = null;
  private disposed = false;

  private constructor(
    readonly identity: string,
    readonly roomName: string,
  ) {
    this.manager = new CikletE2EEManager(this.keyProvider as unknown as RNKeyProvider, false);
    this.session = new VoiceE2EESession({
      room: roomName,
      identity,
      random: (length) => Crypto.getRandomBytes(length),
      keys: {
        setLocalKey: async (passphrase, index) => {
          await this.keyProvider.setKey(identity, passphrase, index);
          if (this.room) await this.manager.useLocalKeyIndex(this.room, index);
        },
        setRemoteKey: (peer, passphrase, index) => this.keyProvider.setKey(peer, passphrase, index),
      },
      transport: {
        send: async (payload, to) => {
          const room = this.room;
          if (!room || this.disposed) return;
          const bytes = new Uint8Array(payload);
          await room.localParticipant.publishData(bytes, { reliable: true, topic: E2EE_TOPIC, destinationIdentities: to });
        },
      },
      isRemoteParticipant: (peer) => Boolean(this.room?.remoteParticipants.get(peer)),
      onAllowedSubscribersChange: (identities) => {
        this.room?.localParticipant.setTrackSubscriptionPermissions(
          false,
          identities.map((participantIdentity) => ({ participantIdentity, allowAll: true })),
        );
      },
      onError: (error) => console.warn("[e2ee]", error),
    });
  }

  /** Token'dan kimlik ve oda; ilk yerel anahtar bağlanmadan takılır. */
  static async create(token: string): Promise<NativeVoiceE2EE | null> {
    const claims = livekitTokenClaims(token);
    if (!claims) return null;
    const handle = new NativeVoiceE2EE(claims.identity, claims.room);
    await handle.session.installInitialKey();
    return handle;
  }

  get roomOptions(): E2EEOptions {
    return { e2eeManager: this.manager };
  }

  async attach(room: Room): Promise<void> {
    if (this.disposed) return;
    this.room = room;
    const onConnected = () => void this.session.onConnected();
    const onReconnected = () => void this.session.onReconnected();
    const onParticipantDisconnected = (participant: RemoteParticipant) =>
      this.session.onParticipantDisconnected(participant.identity);
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic === E2EE_TOPIC) void this.session.handleData(participant?.identity, payload);
    };
    // Karşı taraf anahtarını verip abonelik izni açınca aboneliği geri iste.
    const onPermission = (publication: RemoteTrackPublication, status: TrackPublication.PermissionStatus) => {
      if (status === TrackPublication.PermissionStatus.Allowed && !publication.isSubscribed) {
        try {
          publication.setSubscribed(true);
        } catch {
          /* yayın bu arada kalkmış olabilir */
        }
      }
    };
    room
      .on(RoomEvent.Connected, onConnected)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.TrackSubscriptionPermissionChanged, onPermission);
    this.detachRoom = () => {
      room
        .off(RoomEvent.Connected, onConnected)
        .off(RoomEvent.Reconnected, onReconnected)
        .off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .off(RoomEvent.DataReceived, onData)
        .off(RoomEvent.TrackSubscriptionPermissionChanged, onPermission);
    };
    await room.setE2EEEnabled(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachRoom?.();
    this.detachRoom = null;
    this.session.dispose();
    this.room = null;
    // Yerel anahtar sağlayıcısı oda kapandıktan sonra bırakılır.
    const provider = this.keyProvider;
    setTimeout(() => provider.dispose(), 2000);
  }
}
