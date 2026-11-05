import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { createAudioPlayer } from "expo-audio";

import { useMyPermissions, useServerDetails } from "@/api/hooks";
import {
  SOUND_MAX_SECONDS,
  SOUND_NAME_MAX,
  canEditExpression,
  canUploadExpression,
  useCreateSound,
  useDeleteSound,
  useServerSoundsAdmin,
  useUpdateSound,
  type ServerSoundAdmin,
} from "@/api/hooks/use-server-admin";
import { Button, Divider, EmptyState, ErrorState, Icon, ListGroup, ListSkeleton, Pressable, Screen, showDialog, showToast } from "@/components/ui";
import { RenameSheet } from "@/features/server/expression-admin";
import { BoostSlotsHint } from "@/features/server-boost/boost-ui";
import { effectiveServerPerks } from "@/lib/server-boost";
import { pickSoundFile, uploadServerSound } from "@/lib/uploads";
import { useAuth } from "@/stores/auth";
import { useT } from "@/lib/i18n";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { userErrorMessage } from "@/lib/user-error";

const errorText = (error: unknown, fallback: string) => (userErrorMessage(error, fallback));

/** web lib/soundboard: yüzde 0–200, 5'er adım. */
const VOLUME_MIN = 0;
const VOLUME_MAX = 200;
const VOLUME_STEP = 5;
/** Ses seviyesi düğmesine basılı tutulurken her adımda istek gitmesin. */
const VOLUME_SAVE_DELAY_MS = 500;

type Player = ReturnType<typeof createAudioPlayer>;

/** Yerel ses dosyasının süresi (sn); çözülemezse null — web `measureAudioSeconds`. */
function measureSeconds(uri: string): Promise<number | null> {
  return new Promise((resolve) => {
    let player: Player | null = null;
    let done = false;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription?.remove();
      try {
        player?.remove();
      } catch {
        // Zaten bırakılmış.
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 5_000);
    let subscription: { remove: () => void } | null = null;
    try {
      player = createAudioPlayer({ uri });
      subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.isLoaded && status.duration > 0) finish(status.duration);
      });
      if (player.isLoaded && player.duration > 0) finish(player.duration);
    } catch {
      finish(null);
    }
  });
}

/**
 * Sunucu Ayarları › Soundboard (web soundboard-tab): kısa sesler (≤ 5 sn,
 * 1 MB) yükle, önizle, yeniden adlandır, ses seviyesi (0–200), sil.
 * Yükleme İfade Oluştur / İfadeleri Yönet; düzenleme hepsini yöneten ya da
 * kendi yükleyen. Uçlar aynı kapıları uygular.
 */
export default function ServerSoundboardScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: permissions } = useMyPermissions(serverId);
  const { data: server } = useServerDetails(serverId);
  const myId = useAuth((state) => state.profile?.id);
  const max = effectiveServerPerks(server).soundboardSlots;
  const t = useT();
  const sounds = useServerSoundsAdmin(serverId);
  const create = useCreateSound(serverId);
  const update = useUpdateSound(serverId);
  const remove = useDeleteSound(serverId);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<ServerSoundAdmin | null>(null);
  const [pendingVolume, setPendingVolume] = useState<Record<string, number>>({});
  const previewRef = useRef<Player | null>(null);
  const volumeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = volumeTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      try {
        previewRef.current?.remove();
      } catch {
        // Zaten bırakılmış.
      }
    };
  }, []);

  const items = sounds.data ?? [];
  const canUpload = canUploadExpression(permissions);
  const canEdit = (sound: ServerSoundAdmin) => canEditExpression(permissions, sound.createdById, myId);

  const upload = async () => {
    if (uploading || items.length >= max) return;
    setUploading(true);
    try {
      const asset = await pickSoundFile();
      if (!asset) return;
      const seconds = await measureSeconds(asset.uri);
      if (seconds === null) {
        showToast(t("moreScreens.soundboard.decodeFailed"), "error");
        return;
      }
      if (seconds > SOUND_MAX_SECONDS) {
        showToast(t("moreScreens.soundboard.tooLong", { max: Math.floor(SOUND_MAX_SECONDS), seconds: seconds.toFixed(1) }), "error");
        return;
      }
      const url = await uploadServerSound(asset);
      await create.mutateAsync({ name: asset.name.replace(/\.[^.]+$/, "").slice(0, SOUND_NAME_MAX), audioUrl: url });
      showToast(t("moreScreens.soundboard.added"));
    } catch (error) {
      showToast(errorText(error, t("moreScreens.soundboard.uploadFailed")), "error");
    } finally {
      setUploading(false);
    }
  };

  const preview = (sound: ServerSoundAdmin) => {
    try {
      previewRef.current?.remove();
    } catch {
      // Zaten bırakılmış.
    }
    try {
      const player = createAudioPlayer({ uri: sound.audioUrl });
      player.volume = Math.min(1, volumeOf(sound) / 100);
      previewRef.current = player;
      player.play();
    } catch {
      showToast(t("moreScreens.soundboard.playFailed"), "error");
    }
  };

  const volumeOf = (sound: ServerSoundAdmin) => pendingVolume[sound.id] ?? sound.volume;

  const changeVolume = (sound: ServerSoundAdmin, delta: number) => {
    const current = volumeOf(sound);
    const volume = Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, current + delta));
    if (volume === current) return;
    // Değer anında görünür; istek art arda basışlar bitince tek sefer gider.
    setPendingVolume((map) => ({ ...map, [sound.id]: volume }));
    clearTimeout(volumeTimers.current[sound.id]);
    volumeTimers.current[sound.id] = setTimeout(() => {
      update.mutate(
        { id: sound.id, volume },
        {
          onError: (error) => showToast(errorText(error, t("moreScreens.soundboard.volumeFailed")), "error"),
          onSettled: () =>
            setPendingVolume((map) => {
              if (map[sound.id] !== volume) return map;
              const next = { ...map };
              delete next[sound.id];
              return next;
            }),
        }
      );
    }, VOLUME_SAVE_DELAY_MS);
  };

  const confirmDelete = (sound: ServerSoundAdmin) =>
    showDialog(t("moreScreens.common.deleteConfirm", { name: sound.name }), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("moreScreens.common.delete"),
        style: "destructive",
        onPress: () => remove.mutate(sound.id, { onError: (error) => showToast(errorText(error, t("moreScreens.soundboard.deleteFailed")), "error") }),
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Soundboard" }} />
      {sounds.isLoading ? (
        <ListSkeleton rows={5} />
      ) : sounds.isError ? (
        <ErrorState message={t("moreScreens.soundboard.loadFailed")} onRetry={() => void sounds.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }}>
          <Text style={{ ...typography.overline, color: colors.muted }}>{t("moreScreens.soundboard.header", { used: items.length, max })}</Text>
          <BoostSlotsHint tier={server?.premiumTier} used={items.length} max={max} />
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {t("moreScreens.soundboard.hint", { max: Math.floor(SOUND_MAX_SECONDS) })}
          </Text>
          {canUpload ? (
            <View style={{ flexDirection: "row" }}>
              <Button label={t("moreScreens.soundboard.upload")} icon="volume" loading={uploading} disabled={uploading || items.length >= max} onPress={() => void upload()} />
            </View>
          ) : null}
          {items.length === 0 ? (
            <EmptyState icon="volume" title={t("moreScreens.soundboard.emptyTitle")} description={t("moreScreens.soundboard.emptyBody")} />
          ) : (
            <ListGroup>
              {items.map((sound, index) => {
                const editable = canEdit(sound);
                return (
                  <View key={sound.id}>
                    {index > 0 ? <Divider inset={60} /> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
                      <Pressable
                        onPress={() => preview(sound)}
                        accessibilityRole="button"
                        accessibilityLabel={t("moreScreens.soundboard.preview")}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: radii.md,
                          backgroundColor: colors.brandSoft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {sound.emoji ? <Text style={{ fontSize: 18 }}>{sound.emoji}</Text> : <Icon name="play" size={16} color={colors.brand} />}
                      </Pressable>
                      <Pressable disabled={!editable} onPress={() => setRenaming(sound)} style={{ flex: 1, minWidth: 0 }} accessibilityRole="button">
                        <Text style={{ ...typography.body, ...fw(600), color: colors.text }} numberOfLines={1}>
                          {sound.name}
                        </Text>
                      </Pressable>
                      {editable ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <StepButton icon="chevron-down" label={t("moreScreens.soundboard.volumeDown")} onPress={() => changeVolume(sound, -VOLUME_STEP)} />
                          <Text style={{ ...typography.caption, color: colors.muted, width: 40, textAlign: "center", fontVariant: ["tabular-nums"] }}>
                            {`${volumeOf(sound)}%`}
                          </Text>
                          <StepButton icon="chevron-down" flip label={t("moreScreens.soundboard.volumeUp")} onPress={() => changeVolume(sound, VOLUME_STEP)} />
                          <StepButton icon="trash" label={t("moreScreens.common.delete")} danger onPress={() => confirmDelete(sound)} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ListGroup>
          )}
        </ScrollView>
      )}
      <RenameSheet
        visible={renaming !== null}
        title={t("moreScreens.soundboard.rename")}
        initialName={renaming?.name ?? ""}
        nameMax={SOUND_NAME_MAX}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (!renaming || name === renaming.name) return;
          update.mutate({ id: renaming.id, name }, { onError: (error) => showToast(errorText(error, t("moreScreens.soundboard.renameFailed")), "error") });
        }}
      />
    </Screen>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  flip,
  danger,
}: {
  icon: "chevron-down" | "trash";
  label: string;
  onPress: () => void;
  flip?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ padding: spacing.xs, borderRadius: radii.sm, transform: flip ? [{ rotate: "180deg" }] : undefined }}
    >
      <Icon name={icon} size={16} color={danger ? colors.danger : colors.muted} />
    </Pressable>
  );
}
