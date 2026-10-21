import { useEffect, useState } from "react";
import { AppState, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { Button, Divider, ListGroup, Screen, SectionHeader, showDialog } from "@/components/ui";
import {
  isMediaPermissionGranted,
  mediaPresenceSupported,
  openMediaPermissionSettings,
} from "@/features/presence/media-presence";
import { useT } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Etkinlik durumu — "Dinlediğimi paylaş" (Android).
 *
 * Telefonda çalan müzik/video (Spotify, YouTube Music, YouTube…) arkadaşlara
 * etkinlik olarak gider; masaüstündeki gibi. Android bunun için "Bildirim
 * erişimi" istiyor: ilk açılışta açıklama gösterilir, sonra sistem ekranı
 * açılır; kullanıcı izinle geri dönünce anahtar kendiliğinden açılır.
 */
export default function ActivitySettingsScreen() {
  const t = useT();
  const share = usePreferences((s) => s.shareMediaActivity);
  const music = usePreferences((s) => s.shareMusicActivity);
  const video = usePreferences((s) => s.shareVideoActivity);
  const setPreference = usePreferences((s) => s.setPreference);
  const [granted, setGranted] = useState(isMediaPermissionGranted);
  /** İzin için ayarlara gönderildi; dönüşte izin varsa anahtar açılır. */
  const [awaitingGrant, setAwaitingGrant] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const now = isMediaPermissionGranted();
      setGranted(now);
      if (awaitingGrant) {
        setAwaitingGrant(false);
        if (now) setPreference("shareMediaActivity", true);
      }
    });
    return () => subscription.remove();
  }, [awaitingGrant, setPreference]);

  const requestPermission = () => {
    showDialog(
      "Dinlediğini paylaş",
      "Ciklet, telefonunda çalan şarkıyı ya da videoyu (Spotify, YouTube Music, YouTube…) arkadaşlarına etkinlik olarak gösterebilir.\n\n" +
        "Android bunun için \"Bildirim erişimi\" izni istiyor. Ciklet bu izni yalnızca çalan medyanın adını, sanatçısını ve kapağını okumak için kullanır; bildirimlerini okumaz ve saklamaz.\n\n" +
        "Açılan listede Ciklet'i etkinleştir, sonra uygulamaya geri dön. Seçenek gri görünüyorsa: Ayarlar → Uygulamalar → Ciklet → ⋮ → \"Kısıtlanmış ayarlara izin ver\".",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Ayarları aç",
          onPress: () => {
            setAwaitingGrant(true);
            openMediaPermissionSettings();
          },
        },
      ]
    );
  };

  const toggleShare = (value: boolean) => {
    if (!value) {
      setPreference("shareMediaActivity", false);
      return;
    }
    if (isMediaPermissionGranted()) {
      setGranted(true);
      setPreference("shareMediaActivity", true);
      return;
    }
    requestPermission();
  };

  if (!mediaPresenceSupported) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("settings.rows.activity") }} />
        <View style={{ padding: spacing.lg }}>
          <Text style={{ ...typography.body, color: colors.muted }}>
            Dinlediğin müziği paylaşma şimdilik yalnızca Android’de var. iOS, başka uygulamalarda çalan medyayı uygulamalara açmıyor.
          </Text>
        </View>
      </Screen>
    );
  }

  const enabled = share && granted;

  return (
    <Screen>
      <Stack.Screen options={{ title: t("settings.rows.activity") }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="ETKİNLİK DURUMU" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title="Dinlediğimi paylaş"
              description="Telefonunda çalan müzik ve video, arkadaşlarına masaüstündeki gibi etkinlik olarak görünür. Kartında telefon simgesi çıkar."
              value={enabled}
              onChange={toggleShare}
            />
          </ListGroup>
        </View>

        {share && !granted ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.danger }}>
              Bildirim erişimi kapalı; dinlediğin paylaşılmıyor.
            </Text>
            <Button label="Bildirim erişimini aç" variant="secondary" onPress={requestPermission} />
          </View>
        ) : null}

        <SectionHeader title="NELER PAYLAŞILSIN" />
        <View style={{ paddingHorizontal: spacing.lg, opacity: enabled ? 1 : 0.45 }}>
          <ListGroup>
            <ToggleRow
              title="Müzik"
              description="Spotify, YouTube Music, Apple Music, SoundCloud…"
              value={music}
              disabled={!enabled}
              onChange={(value) => setPreference("shareMusicActivity", value)}
            />
            <Divider inset={16} />
            <ToggleRow
              title="Video (YouTube)"
              description="İzlediğin YouTube videosu."
              value={video}
              disabled={!enabled}
              onChange={(value) => setPreference("shareVideoActivity", value)}
            />
          </ListGroup>
        </View>

        <Text style={{ ...typography.caption, color: colors.muted, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          Tarayıcılar ve mesajlaşma uygulamaları (sesli mesajlar) paylaşılmaz. Ciklet arka plandayken bağlantı bir süre sonra kapanabilir; uygulamayı açınca etkinliğin yeniden güncellenir.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.text }}>{title}</Text>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
