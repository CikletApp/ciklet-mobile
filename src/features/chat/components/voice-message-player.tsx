import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View, type GestureResponderEvent } from "react-native";
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Pressable, showToast } from "@/components/ui";
import { ensureMedia, useLocalMedia } from "@/lib/media-cache";
import { formatVoiceDuration, type VoiceMeta } from "@/lib/message-extras";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing } from "@/theme/tokens";
import { claimPlayback, preparePlaybackMode, releasePlayback } from "../voice-message";

/**
 * Sesli mesaj oynatıcı — ciklet-web `voice-message-player.tsx`: oynat /
 * duraklat, dalga formunun üstünde ilerleme (dokun ve sar), süre ve hız
 * (1× / 1.5× / 2×). Aynı anda tek sesli mesaj çalar.
 *
 * Yerel oynatıcı İLK dokunuşta kurulur: listedeki her sesli mesaj için
 * oynatıcı açmak, kullanıcı dinlemese de belleği ve veriyi harcardı.
 *
 * Ses dosyası CİHAZDAN çalar (lib/media-cache): "Sesli mesajlar" otomatik
 * indirmesi açıksa (varsayılan) mesaj sohbet önbelleğine düşer düşmez arka
 * plan kuyruğuyla iner (features/chat/voice-prefetch); değilse ilk dokunuşta.
 * Dosya henüz inmemişse düğmede indirme halkası görünür; dokunuş süren
 * indirmeyi bekler, yeniden başlatmaz.
 * Eskiden `play()` oynatıcı kaynağı yüklemeden çağrılıyor ve ilk dokunuş
 * sessizce yutuluyordu (biraz bekleyip ikinci dokunuşta çalıyordu). Artık
 * oynatıcı "yüklendi" diyene kadar düğmede gösterge döner, sonra kendiliğinden
 * çalar.
 */

/** Oynatıcı kaynağı bu süre içinde yüklenmezse yine de çalmayı dener. */
const LOAD_TIMEOUT_MS = 10_000;

function waitUntilLoaded(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, LOAD_TIMEOUT_MS);
    const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.isLoaded) done();
    });
    function done() {
      clearTimeout(timer);
      subscription.remove();
      resolve();
    }
    // Dinleyici bağlanana kadar yüklenmiş olabilir.
    if (player.isLoaded) done();
  });
}

const RATES = [1, 1.5, 2] as const;
const FALLBACK_BARS = Array.from({ length: 32 }, () => 0.3);

export function VoiceMessagePlayer({
  url,
  meta,
  onLongPress,
}: {
  url: string;
  meta: VoiceMeta;
  onLongPress?: () => void;
}) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const startingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const local = useLocalMedia(url, "voice");
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [width, setWidth] = useState(0);
  const bars = meta.waveform.length > 0 ? meta.waveform : FALLBACK_BARS;

  useEffect(
    () => () => {
      const player = playerRef.current;
      playerRef.current = null;
      if (!player) return;
      releasePlayback(player);
      try {
        player.remove();
      } catch {
        /* zaten serbest */
      }
    },
    []
  );

  const ensurePlayer = (source: string): AudioPlayer | null => {
    if (playerRef.current) return playerRef.current;
    try {
      const player = createAudioPlayer({ uri: source }, { updateInterval: 100 });
      player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
        if (playerRef.current !== player) return;
        if (status.didJustFinish) {
          setPlaying(false);
          setProgress(0);
          releasePlayback(player);
          void player.seekTo(0).catch(() => {});
          return;
        }
        setPlaying(status.playing);
        const duration = status.duration > 0 ? status.duration : meta.durationMs / 1000;
        if (duration > 0) setProgress(Math.min(1, status.currentTime / duration));
      });
      playerRef.current = player;
      return player;
    } catch {
      showToast("Sesli mesaj oynatılamadı.", "error");
      return null;
    }
  };

  /** Kaynak: yerel kopya; yoksa önce cihaza indirilir; indirilemezse sunucudan akış denenir. */
  const resolveSource = async (): Promise<string> => {
    if (local.uri) return local.uri;
    try {
      return await ensureMedia(url, "voice");
    } catch {
      return url;
    }
  };

  const toggle = async () => {
    const existing = playerRef.current;
    if (existing?.playing) {
      existing.pause();
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      let player = existing;
      if (!player) {
        setLoading(true);
        player = ensurePlayer(await resolveSource());
      }
      if (!player) return;
      if (!player.isLoaded) {
        setLoading(true);
        await waitUntilLoaded(player);
      }
      // Bu arada bileşen söküldüyse çalma.
      if (playerRef.current !== player) return;
      await preparePlaybackMode();
      claimPlayback(player);
      player.setPlaybackRate(rate);
      player.play();
    } catch {
      showToast("Sesli mesaj oynatılamadı.", "error");
    } finally {
      startingRef.current = false;
      setLoading(false);
    }
  };

  const seek = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
    // Henüz oynatıcı yoksa (dinlenmemiş) yalnızca yerel kopyadan kurulur;
    // sarma için indirme başlatılmaz.
    const player = playerRef.current ?? (local.uri ? ensurePlayer(local.uri) : null);
    if (!player) return;
    const duration = player.duration > 0 ? player.duration : meta.durationMs / 1000;
    setProgress(ratio);
    void player.seekTo(ratio * duration).catch(() => {});
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    try {
      playerRef.current?.setPlaybackRate(next);
    } catch {
      /* oynatıcı henüz yok — ilk çalışta uygulanır */
    }
  };

  const started = playing || progress > 0;
  // İndirme göstergesi yalnızca dosya henüz cihazda değilken (arka plan
  // kuyruğu ya da dokunuşla iniyor); yerel kopya varsa doğrudan oynat düğmesi.
  const fetching = !local.uri && local.downloading && !playing && progress === 0;
  const shown = started ? progress * meta.durationMs : meta.durationMs;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        width: 260,
        maxWidth: "100%",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.panel,
      }}
    >
      <Pressable
        onPress={() => void toggle()}
        onLongPress={onLongPress}
        delayLongPress={280}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={playing ? "Duraklat" : loading || fetching ? "Sesli mesaj yükleniyor" : "Sesli mesajı oynat"}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: radii.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brand,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {fetching && local.progress !== null ? (
          <DownloadRing ratio={local.progress} color={colors.onBrand} />
        ) : loading || fetching ? (
          <ActivityIndicator size="small" color={colors.onBrand} />
        ) : (
          <PlayPauseGlyph playing={playing} color={colors.onBrand} />
        )}
      </Pressable>

      <Pressable
        noHitSlop
        onPress={seek}
        onLongPress={onLongPress}
        delayLongPress={280}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Konum"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        style={{ flex: 1, height: 32, flexDirection: "row", alignItems: "center", gap: 2 }}
      >
        {bars.map((value, index) => {
          const reached = started && index / bars.length <= progress;
          return (
            <View
              key={index}
              pointerEvents="none"
              style={{
                flex: 1,
                minWidth: 2,
                height: `${Math.max(12, Math.round(value * 100))}%`,
                borderRadius: radii.full,
                backgroundColor: reached ? colors.brand : colors.muted,
                opacity: reached ? 1 : 0.4,
              }}
            />
          );
        })}
      </Pressable>

      <Text style={{ width: 36, textAlign: "right", fontSize: 12, lineHeight: 16, color: colors.muted, fontVariant: ["tabular-nums"] }}>
        {formatVoiceDuration(shown)}
      </Text>
      <Pressable
        onPress={cycleRate}
        accessibilityRole="button"
        accessibilityLabel={`Oynatma hızı ${rate}×`}
        style={({ pressed }) => ({
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: radii.sm,
          backgroundColor: pressed ? colors.raised : "transparent",
        })}
      >
        <Text style={{ fontSize: 11, lineHeight: 15, ...fw(700), color: colors.muted }}>{rate}×</Text>
      </Pressable>
    </View>
  );
}

/** İndirme ilerlemesi: düğmenin içinde dolan halka, ortada oynat üçgeni. */
function DownloadRing({ ratio, color }: { ratio: number; color: string }) {
  const size = 30;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeOpacity={0.3} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, ratio)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Svg width={10} height={10} viewBox="0 0 24 24">
        <Path d="M8 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 8 4.5z" fill={color} />
      </Svg>
    </View>
  );
}

/** Oynat üçgeni / duraklat çubukları — ikon setinde duraklat yok. */
function PlayPauseGlyph({ playing, color }: { playing: boolean; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      {playing ? (
        <>
          <Rect x={6} y={4} width={4} height={16} rx={1} fill={color} />
          <Rect x={14} y={4} width={4} height={16} rx={1} fill={color} />
        </>
      ) : (
        <Path d="M8 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 8 4.5z" fill={color} />
      )}
    </Svg>
  );
}
