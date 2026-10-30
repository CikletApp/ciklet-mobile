import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { useCreateServerEvent, useServerChannels, useServerEvents, useUpdateServerEvent } from "@/api/hooks";
import type { RecurrencePresetId } from "@/api/types";
import { Button, Icon, KeyboardAvoider, Pressable, SegmentedTabs, TextField, showToast } from "@/components/ui";
import { presetIdOf, recurrencePresets } from "@/lib/event-recurrence";
import { pickAndUploadEventCover } from "@/lib/uploads";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Etkinlik oluştur (moderatör+). Tarih seçici bağımlılığı eklememek için
 * gün çipleri (bugünden 30 gün) + "SS:DD" saat alanı; süre isteğe bağlı.
 * Doğrulama sunucuda da yapılır (geçmiş başlangıç, bitiş sırası).
 * Kapak görseli (16:9) ve tekrar (web formundaki seçeneklerin aynısı,
 * başlangıç gününe göre: "Her hafta Salı", "Her ay 1. Salı" …) isteğe bağlı.
 *
 * `?eventId=` ile aynı form "Etkinliği Düzenle" olarak açılır (web
 * modalındaki düzenleme): alanlar doldurulur; başlangıç ve tekrar
 * değişmediyse uca gönderilmez (mevcut kural ve hatırlatma korunur).
 */

const DURATIONS = [
  { id: "none", label: "Bitiş yok", minutes: 0 },
  { id: "1h", label: "1 saat", minutes: 60 },
  { id: "2h", label: "2 saat", minutes: 120 },
  { id: "4h", label: "4 saat", minutes: 240 },
] as const;

const TIME = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/;
const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function startOfDay(offset: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

/** Bugünden kaç gün sonra (yerel takvim günü; geçmiş için negatif). */
function dayOffsetOf(date: Date): number {
  const day = new Date(date.getTime());
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - startOfDay(0).getTime()) / 86_400_000);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "1 sa 30 dk" */
function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} sa` : "", m ? `${m} dk` : ""].filter(Boolean).join(" ");
}

export default function NewServerEventScreen() {
  const { serverId, eventId } = useLocalSearchParams<{ serverId: string; eventId?: string }>();
  const { data: channels } = useServerChannels(serverId);
  const create = useCreateServerEvent(serverId);
  const update = useUpdateServerEvent(serverId);
  const { data: eventList } = useServerEvents(eventId ? serverId : undefined);
  const editing = eventId ? eventList?.find((item) => item.id === eventId) : undefined;
  const voiceChannels = useMemo(
    () => (channels ?? []).filter((channel) => channel.type !== ChannelType.TEXT),
    [channels]
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [placeKind, setPlaceKind] = useState<"voice" | "other">("voice");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState(() => {
    const next = new Date(Date.now() + 60 * 60_000);
    return `${String(next.getHours()).padStart(2, "0")}:00`;
  });
  const [duration, setDuration] = useState<string>("none");
  // Düzenlemede hazır sürelere uymayan mevcut süre ayrı bir çip olur.
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrencePresetId>("none");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Düzenlemede açılıştaki başlangıç (dakika) ve tekrar — değişmedilerse gönderilmez.
  const [base, setBase] = useState<{ startMinute: number; recurrence: RecurrencePresetId } | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!editing || prefilled.current) return;
    prefilled.current = true;
    const start = new Date(editing.startsAt);
    setName(editing.name);
    setDescription(editing.description ?? "");
    setPlaceKind(editing.channelId ? "voice" : "other");
    setChannelId(editing.channelId);
    setLocation(editing.location ?? "");
    setDayOffset(dayOffsetOf(start));
    setTime(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
    const minutes = editing.endsAt ? Math.round((new Date(editing.endsAt).getTime() - start.getTime()) / 60_000) : 0;
    const preset = DURATIONS.find((item) => item.minutes === minutes);
    setCustomMinutes(preset ? null : minutes);
    setDuration(preset ? preset.id : "custom");
    const recurrenceId = presetIdOf(editing.recurrenceRule);
    setRecurrence(recurrenceId);
    setCoverImageUrl(editing.coverImageUrl ?? null);
    setBase({ startMinute: Math.floor(start.getTime() / 60_000), recurrence: recurrenceId });
  }, [editing]);

  const durations = useMemo(
    () => [
      ...DURATIONS,
      ...(customMinutes
        ? [{ id: "custom", label: `Mevcut süre (${durationText(customMinutes)})`, minutes: customMinutes }]
        : []),
    ],
    [customMinutes]
  );

  // Gün çipleri bugünden 30 gün; düzenlenen etkinlik bu aralığın dışındaysa onun günü de eklenir.
  const firstOffset = Math.min(0, dayOffset);
  const lastOffset = Math.max(29, dayOffset);
  const days = useMemo(
    () => Array.from({ length: lastOffset - firstOffset + 1 }, (_, i) => ({ offset: firstOffset + i, date: startOfDay(firstOffset + i) })),
    [firstOffset, lastOffset]
  );
  const timeMatch = TIME.exec(time.trim());
  const place = placeKind === "voice" ? channelId : location.trim();
  const valid = name.trim().length > 0 && Boolean(timeMatch) && Boolean(place) && !coverUploading;

  // Başlangıç (gün + saat) değişince tekrar seçenekleri yeniden hesaplanır.
  const startsAtLocal = useMemo(() => {
    const date = startOfDay(dayOffset);
    if (timeMatch) date.setHours(Number(timeMatch[1]), Number(timeMatch[2]));
    return date;
  }, [dayOffset, timeMatch?.[1], timeMatch?.[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const presets = useMemo(() => recurrencePresets(startsAtLocal), [startsAtLocal]);
  const selectedPreset = presets.find((item) => item.id === recurrence) ?? presets[0];

  const pickCover = async () => {
    if (coverUploading) return;
    setCoverUploading(true);
    try {
      const url = await pickAndUploadEventCover();
      if (url) setCoverImageUrl(url);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Görsel yüklenemedi.", "error");
    } finally {
      setCoverUploading(false);
    }
  };

  const submit = () => {
    if (!timeMatch) return;
    setError(null);
    const startsAt = new Date(startsAtLocal.getTime());
    const minutes = durations.find((item) => item.id === duration)?.minutes ?? 0;
    if (editing && base) {
      const startChanged = Math.floor(startsAt.getTime() / 60_000) !== base.startMinute;
      const effectiveStart = startChanged ? startsAt : new Date(editing.startsAt);
      const recurrenceChanged = startChanged || recurrence !== base.recurrence;
      update.mutate(
        {
          eventId: editing.id,
          input: {
            name: name.trim(),
            description: description.trim(),
            channelId: placeKind === "voice" ? channelId : null,
            location: placeKind === "other" ? location.trim() : null,
            ...(startChanged ? { startsAt: startsAt.toISOString() } : {}),
            endsAt: minutes ? new Date(effectiveStart.getTime() + minutes * 60_000).toISOString() : null,
            ...(recurrenceChanged ? { recurrenceRule: selectedPreset.rule } : {}),
            coverImageUrl,
          },
        },
        {
          onSuccess: () => {
            showToast("Etkinlik güncellendi.");
            router.back();
          },
          onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Etkinlik güncellenemedi."),
        }
      );
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        channelId: placeKind === "voice" ? channelId : null,
        location: placeKind === "other" ? location.trim() : null,
        startsAt: startsAt.toISOString(),
        endsAt: minutes ? new Date(startsAt.getTime() + minutes * 60_000).toISOString() : null,
        recurrenceRule: selectedPreset.rule,
        coverImageUrl,
      },
      {
        onSuccess: () => router.back(),
        onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Etkinlik oluşturulamadı."),
      }
    );
  };

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: eventId ? "Etkinliği Düzenle" : "Etkinlik Oluştur" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Pressable
          onPress={() => void pickCover()}
          haptic="light"
          noHitSlop
          accessibilityRole="button"
          accessibilityLabel="Kapak görseli seç"
          style={{
            aspectRatio: 16 / 9,
            borderRadius: radii.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderStyle: coverImageUrl ? "solid" : "dashed",
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <Icon name="image" size={22} color={colors.muted} />
              <Text style={{ ...typography.caption, ...fw(600), color: colors.muted }}>Kapak görseli ekle (16:9, isteğe bağlı)</Text>
            </View>
          )}
          {coverUploading ? <ActivityIndicator color={colors.bright} /> : null}
        </Pressable>
        {coverImageUrl && !coverUploading ? (
          <Button label="Kapağı kaldır" icon="close" variant="secondary" onPress={() => setCoverImageUrl(null)} />
        ) : null}

        <TextField label="ETKİNLİK ADI" value={name} onChangeText={setName} maxLength={100} autoFocus={!eventId} />
        <TextField
          label="AÇIKLAMA"
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
        />

        <Text style={{ ...typography.overline, color: colors.muted }}>YER</Text>
        <SegmentedTabs
          items={[
            { id: "voice" as const, label: "Ses kanalı" },
            { id: "other" as const, label: "Başka bir yer" },
          ]}
          value={placeKind}
          onChange={setPlaceKind}
        />
        {placeKind === "voice" ? (
          voiceChannels.length === 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>Bu sunucuda ses kanalı yok.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {voiceChannels.map((channel) => (
                <Chip
                  key={channel.id}
                  label={channel.name}
                  selected={channelId === channel.id}
                  onPress={() => setChannelId(channel.id)}
                />
              ))}
            </View>
          )
        ) : (
          <TextField
            label="KONUM YA DA BAĞLANTI"
            value={location}
            onChangeText={setLocation}
            maxLength={100}
            autoCapitalize="none"
          />
        )}

        <Text style={{ ...typography.overline, color: colors.muted }}>GÜN</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {days.map(({ offset, date }) => (
            <Chip
              key={offset}
              label={
                offset === 0
                  ? "Bugün"
                  : offset === 1
                    ? "Yarın"
                    : `${DAY_NAMES[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}`
              }
              selected={dayOffset === offset}
              onPress={() => setDayOffset(offset)}
            />
          ))}
        </ScrollView>

        <TextField
          label="SAAT (SS:DD)"
          value={time}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          error={time && !timeMatch ? "Saati 20:30 biçiminde yaz." : undefined}
        />

        <Text style={{ ...typography.overline, color: colors.muted }}>SÜRE</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {durations.map((item) => (
            <Chip key={item.id} label={item.label} selected={duration === item.id} onPress={() => setDuration(item.id)} />
          ))}
        </View>

        <Text style={{ ...typography.overline, color: colors.muted }}>TEKRAR</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {presets.map((item) => (
            <Chip key={item.id} label={item.label} selected={selectedPreset.id === item.id} onPress={() => setRecurrence(item.id)} />
          ))}
        </View>

        {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}
        <Button
          label={eventId ? "Kaydet" : "Etkinliği Oluştur"}
          fullWidth
          size="lg"
          disabled={!valid || (Boolean(eventId) && !editing)}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoider>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.bentoBorder,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : colors.panel,
      })}
    >
      <Text style={{ ...typography.caption, ...fw(selected ? 700 : 500), color: selected ? colors.brand : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
