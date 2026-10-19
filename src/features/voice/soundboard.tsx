import { useCallback, useEffect, useRef } from "react";
import { FlatList, Modal, Pressable as RNPressable, Text, View } from "react-native";
import { useDataChannel } from "@livekit/react-native";
import { createAudioPlayer } from "expo-audio";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useServerSounds } from "@/api/hooks";
import type { ServerSoundItem } from "@/api/types";
import { EmptyState, ListSkeleton, Pressable, showToast } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Soundboard — web kontrol çubuğundaki panelin mobil karşılığı.
 *
 * Web sesi Web Audio ile karıştırıp ikinci bir LiveKit ses parçası olarak
 * yayınlıyor; React Native'de dosyadan ses parçası üretecek bir yol
 * (Web Audio / MediaStreamDestination) yok ve yerel modül eklemek bu dalın
 * kapsamı dışında. Bu yüzden mobil:
 *  - web'den çalınan sesleri zaten duyar (uzak ses parçası, LiveKit çalar);
 *  - kendi çaldığı sesi yerelde çalar ve odaya `soundboard` konulu veri
 *    mesajı yayınlar; açık mobil ve web istemcileri bu mesajı alıp aynı
 *    sesi çalar.
 * Mesaj yalnızca ses KİMLİĞİNİ taşır; alıcı sesi sunucunun kendi listesinde
 * çözer ve oradaki adres ile seviyeyi kullanır. Gönderenin adresine
 * güvenilseydi herhangi bir katılımcı herkese rastgele bir adresi
 * indirtebilirdi (web call/soundboard-popover aynı kuralı uygular).
 */
export const SOUNDBOARD_TOPIC = "soundboard";

interface SoundboardMessage {
  soundId: string;
  name?: string;
}

// Kodlayıcılar tembel kurulur: TextEncoder/Decoder'ı LiveKit'in
// `registerGlobals` çoklu dolgusu sağlıyor, modül yüklenirken hazır olmayabilir.
const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Bitiş olayı hiç gelmezse (yüklenemeyen adres, kesilen ses) oynatıcı yine de bırakılır. */
const PLAYER_TIMEOUT_MS = 30_000;
/** Aynı göndericiden arka arkaya gelen mesajlar arasındaki en kısa süre. */
const SENDER_GAP_MS = 250;

/** Sesi bir kez çalar; bitince, hata ya da zaman aşımında oynatıcı bırakılır. `volume` yüzde (0–200). */
function playOnce(audioUrl: string, volume: number) {
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  let subscription: { remove: () => void } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const release = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    subscription?.remove();
    subscription = null;
    try {
      player?.remove();
    } catch {
      // Zaten bırakılmış.
    }
    player = null;
  };
  try {
    player = createAudioPlayer({ uri: audioUrl });
    player.volume = Math.min(1, Math.max(0, volume / 100));
    subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) release();
    });
    timer = setTimeout(release, PLAYER_TIMEOUT_MS);
    player.play();
  } catch (error) {
    release();
    if (__DEV__) console.warn("[soundboard] çalınamadı", error);
  }
}

function parseSoundId(payload: Uint8Array): string | null {
  try {
    const data = JSON.parse(decode(payload)) as Partial<SoundboardMessage>;
    return typeof data.soundId === "string" ? data.soundId : null;
  } catch {
    return null;
  }
}

/**
 * Odaya bağlı soundboard: gelen veri mesajlarını çalar, `play` hem yerelde
 * çalar hem yayınlar. `LiveKitRoom` içinde kullanılmalı.
 */
export function useSoundboard(serverId: string | undefined) {
  /** Gönderici kimliği → son çalma zamanı: bir kişinin spam'i başkasını susturmasın. */
  const lastPlayed = useRef(new Map<string, number>());
  const { data: sounds } = useServerSounds(serverId);
  // Geri çağrı kararlı kalsın diye liste ref'te: `useDataChannel` her yeni
  // fonksiyonda aboneliği söküp yeniden kuruyordu.
  const soundsRef = useRef(sounds);
  useEffect(() => {
    soundsRef.current = sounds;
  }, [sounds]);

  const onMessage = useCallback((message: { payload: Uint8Array; from?: { identity: string } }) => {
    const soundId = parseSoundId(message.payload);
    const parsed = soundId ? soundsRef.current?.find((sound) => sound.id === soundId) : undefined;
    if (!parsed) return;
    // Arka arkaya gelen spam'e karşı gönderici başına kısa bir eşik.
    const sender = message.from?.identity ?? "";
    const now = Date.now();
    if (now - (lastPlayed.current.get(sender) ?? 0) < SENDER_GAP_MS) return;
    lastPlayed.current.set(sender, now);
    playOnce(parsed.audioUrl, parsed.volume);
  }, []);
  const { send } = useDataChannel(SOUNDBOARD_TOPIC, onMessage);

  const play = useCallback(
    async (sound: ServerSoundItem) => {
      playOnce(sound.audioUrl, sound.volume);
      try {
        const body: SoundboardMessage = { soundId: sound.id, name: sound.name };
        await send(encode(JSON.stringify(body)), { reliable: true, topic: SOUNDBOARD_TOPIC });
      } catch {
        showToast("Ses odaya gönderilemedi.", "error");
      }
    },
    [send]
  );

  return { play };
}

export function SoundboardSheet({
  serverId,
  visible,
  onClose,
  onPlay,
}: {
  serverId: string | undefined;
  visible: boolean;
  onClose: () => void;
  onPlay: (sound: ServerSoundItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const sounds = useServerSounds(visible ? serverId : undefined);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}
      >
        <RNPressable
          onPress={() => undefined}
          accessible={false}
          style={{
            maxHeight: "70%",
            marginHorizontal: spacing.sm,
            marginBottom: insets.bottom + spacing.sm,
            padding: spacing.md,
            gap: spacing.sm,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ ...typography.overline, color: colors.muted }}>SOUNDBOARD</Text>
          {sounds.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (sounds.data ?? []).length === 0 ? (
            <EmptyState
              icon="volume"
              title="Ses yok"
              description="Sunucu ayarlarından (web) soundboard sesi eklenebilir."
            />
          ) : (
            <FlatList
              data={sounds.data}
              keyExtractor={(sound) => sound.id}
              numColumns={3}
              columnWrapperStyle={{ gap: spacing.sm }}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPlay(item)}
                  haptic="light"
                  noHitSlop
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} sesini çal`}
                  style={({ pressed }) => ({
                    flex: 1 / 3,
                    alignItems: "center",
                    gap: 4,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.xs,
                    borderRadius: radii.lg,
                    backgroundColor: pressed ? colors.brandSoft : colors.raised,
                  })}
                >
                  <Text style={{ fontSize: 24 }}>{item.emoji || "🔊"}</Text>
                  <Text style={{ ...typography.caption, ...fw(600), color: colors.bright }} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          )}
          <View style={{ height: spacing.xs }} />
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
