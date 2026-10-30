import { ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChannelType } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { useChannel, useCreateChannel, useDeleteChannel, useUpdateChannel } from "@/api/hooks";
import type { ChannelExtras } from "@/api/types";
import { Button, Divider, KeyboardAvoider, ListGroup, ListRow, SegmentedTabs, TextField, showDialog } from "@/components/ui";
import {
  VIDEO_QUALITY_OPTIONS,
  VOICE_BITRATE_OPTIONS_KBPS,
  VOICE_USER_LIMIT_MAX,
  bitrateLabel,
  parseUserLimit,
  readBitrate,
  readVideoQualityMode,
  type VideoQualityMode,
} from "@/lib/voice-settings";
import { colors, spacing, typography } from "@/theme/tokens";
import { useEffect, useState } from "react";

export default function ChannelSettingsScreen() {
  const { serverId, channelId } = useLocalSearchParams<{ serverId: string; channelId: string }>();
  const creating = channelId === "new";
  const channel = useChannel(serverId, creating ? undefined : channelId);
  const create = useCreateChannel(serverId);
  const update = useUpdateChannel(serverId, channelId);
  const remove = useDeleteChannel(serverId, channelId);
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(ChannelType.TEXT);
  // Ses kanalı ayarları (web Kanal Ayarları → Genel Görünüm ile aynı alanlar
  // ve metinler; lib/voice-settings). Yalnızca var olan ses kanalında.
  const extras = channel as ChannelExtras | undefined;
  const [userLimit, setUserLimit] = useState("0");
  const [bitrate, setBitrate] = useState(readBitrate(undefined));
  const [videoQuality, setVideoQuality] = useState<VideoQualityMode>("auto");

  useEffect(() => {
    if (!channel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(channel.name);
    setType(channel.type);
    setUserLimit(String(extras?.userLimit ?? 0));
    setBitrate(readBitrate(extras?.bitrate));
    setVideoQuality(readVideoQualityMode(extras?.videoQualityMode));
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = creating ? create : update;
  const isVoice = !creating && Boolean(channel) && type !== ChannelType.TEXT;
  // Boş alan 0 (sınırsız); geçersiz değer kaydı engeller (uç da 400 döner).
  const parsedUserLimit = parseUserLimit(userLimit.trim() === "" ? 0 : userLimit);
  const submit = () => {
    if (creating) {
      create.mutate({ name: name.trim(), type }, { onSuccess: () => router.back() });
      return;
    }
    update.mutate(
      {
        name: name.trim(),
        type,
        // Yalnızca değişen ses ayarları gider (web ile aynı davranış).
        ...(isVoice && parsedUserLimit !== null && parsedUserLimit !== (extras?.userLimit ?? 0) ? { userLimit: parsedUserLimit } : {}),
        ...(isVoice && bitrate !== readBitrate(extras?.bitrate) ? { bitrate } : {}),
        ...(isVoice && videoQuality !== readVideoQualityMode(extras?.videoQualityMode) ? { videoQualityMode: videoQuality } : {}),
      },
      { onSuccess: () => router.back() }
    );
  };
  const protectedChannel = channel?.name.toLocaleLowerCase("tr") === "general";

  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: creating ? "Kanal Oluştur" : "Kanalı Düzenle" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <TextField label="KANAL ADI" value={name} onChangeText={setName} autoFocus={creating} maxLength={60} />
        <Text style={{ ...typography.overline, color: colors.muted }}>KANAL TÜRÜ</Text>
        <SegmentedTabs
          items={[
            { id: ChannelType.TEXT, label: "Metin" },
            { id: ChannelType.AUDIO, label: "Ses" },
            { id: ChannelType.VIDEO, label: "Video" },
          ]}
          value={type}
          onChange={setType}
        />
        {isVoice ? (
          <>
            <TextField
              label="KULLANICI SINIRI"
              value={userLimit}
              onChangeText={(value) => setUserLimit(value.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              error={parsedUserLimit === null ? `Kullanıcı sınırı 0 ile ${VOICE_USER_LIMIT_MAX} arasında olmalı.` : null}
            />
            <Text style={{ ...typography.caption, color: colors.muted, marginTop: -spacing.md }}>
              {parsedUserLimit === 0 ? "Sınırsız · " : parsedUserLimit ? `${parsedUserLimit} kişi · ` : ""}
              Kanala aynı anda katılabilecek kişi sayısı (0 = sınırsız). Dolunca yalnızca Üyeleri Taşı izni olanlar katılabilir.
            </Text>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>BİT HIZI</Text>
              <ListGroup>
                {VOICE_BITRATE_OPTIONS_KBPS.map((kbps, index) => (
                  <View key={kbps}>
                    {index > 0 ? <Divider inset={16} /> : null}
                    <ListRow
                      title={bitrateLabel(kbps)}
                      detail={bitrate === kbps * 1000 ? "Seçili" : undefined}
                      chevron={false}
                      onPress={() => setBitrate(kbps * 1000)}
                    />
                  </View>
                ))}
              </ListGroup>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Yüksek bit hızı daha net ses demek ama zayıf bağlantılarda kesintiye yol açabilir.
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.overline, color: colors.muted }}>GÖRÜNTÜ KALİTESİ</Text>
              <SegmentedTabs
                items={VIDEO_QUALITY_OPTIONS.map((option) => ({ id: option.value, label: option.label }))}
                value={videoQuality}
                onChange={setVideoQuality}
              />
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Otomatik: kamera kalitesi bağlantıya göre ayarlanır. 720p: kanaldaki herkesin kamerası en az 720p yayınlanır.
              </Text>
            </View>
          </>
        ) : null}
        <Button
          label={creating ? "Kanalı Oluştur" : "Değişiklikleri Kaydet"}
          fullWidth
          size="lg"
          loading={mutation.isPending}
          disabled={name.trim().length < 2 || protectedChannel || (isVoice && parsedUserLimit === null)}
          onPress={submit}
        />
        {!creating && !protectedChannel ? (
          <Button
            label="Kanalı Sil"
            variant="danger"
            fullWidth
            onPress={() => showDialog("Kanalı sil", "Kanal ve mesajları kalıcı olarak silinecek.", [
              { text: "Vazgeç", style: "cancel" },
              { text: "Sil", style: "destructive", onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }) },
            ])}
          />
        ) : null}
        {protectedChannel ? <Text style={{ ...typography.caption, color: colors.muted }}>Varsayılan general kanalı düzenlenemez veya silinemez.</Text> : null}
        {mutation.isError ? <Text style={{ ...typography.caption, color: colors.danger }}>{mutation.error instanceof ApiError ? mutation.error.message : "Kanal kaydedilemedi."}</Text> : null}
      </ScrollView>
    </KeyboardAvoider>
  );
}
