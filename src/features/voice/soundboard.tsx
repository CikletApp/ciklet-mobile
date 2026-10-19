import { useCallback, useRef } from "react";
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

/** Sesi bir kez çalar; bitince oynatıcı bırakılır. `volume` yüzde (0–200). */
function playOnce(audioUrl: string, volume: number) {
  try {
    const player = createAudioPlayer({ uri: audioUrl });
    player.volume = Math.min(1, Math.max(0, volume / 100));
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.didJustFinish) return;
      subscription.remove();
      player.remove();
    });
    player.play();
  } catch (error) {
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
  const lastPlayed = useRef(0);
  const { data: sounds } = useServerSounds(serverId);
  const { send } = useDataChannel(SOUNDBOARD_TOPIC, (message) => {
    const soundId = parseSoundId(message.payload);
    const parsed = soundId ? sounds?.find((sound) => sound.id === soundId) : undefined;
    if (!parsed) return;
    // Arka arkaya gelen spam'e karşı kısa bir eşik.
    const now = Date.now();
    if (now - lastPlayed.current < 250) return;
    lastPlayed.current = now;
    playOnce(parsed.audioUrl, parsed.volume);
  });

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
