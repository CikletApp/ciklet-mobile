import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError } from "@/api/client";
import { isTimedOut, timeoutRemainingLabel, useAcceptRules, useServerRules } from "@/api/hooks";
import { Button, Icon, showToast, type IconName } from "@/components/ui";
import { nsfwAckKey } from "@/lib/nsfw-ack";
import { useNow } from "@/lib/use-now";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Kanal açılışındaki kapılar — web `nsfw-curtain`, `rules-curtain` ve
 * zaman aşımı notunun mobil karşılıkları. Perdeler sohbetin ÜSTÜNE
 * mutlak konumla çizilir; sohbet altta yüklenmeye devam eder ki kabulden
 * sonra beklenmesin. Yazma yetkisi sunucuda aynı kurallara bağlı; bunlar
 * yalnızca kullanıcıya nedenini söyler.
 */

/**
 * Yaş sınırlı kanal onayı bu cihazda profil + kanal başına hatırlanır (web:
 * tarayıcı başına); çıkışta silinir (bkz. lib/nsfw-ack.ts).
 */
export function useNsfwAcknowledged(channelId: string | undefined, nsfw: boolean) {
  const profileId = useAuth((s) => s.profile?.id);
  const key = profileId && channelId ? nsfwAckKey(profileId, channelId) : null;
  const [state, setState] = useState<{ key: string; acknowledged: boolean } | null>(null);
  useEffect(() => {
    if (!key || !nsfw) return;
    let alive = true;
    AsyncStorage.getItem(key)
      .then((value) => alive && setState({ key, acknowledged: value === "1" }))
      .catch(() => alive && setState({ key, acknowledged: false }));
    return () => {
      alive = false;
    };
  }, [key, nsfw]);

  const acknowledge = () => {
    if (!key) return;
    setState({ key, acknowledged: true });
    void AsyncStorage.setItem(key, "1").catch(() => undefined);
  };

  // Okuma bitene kadar perde açık sayılır: içerik bir an görünüp kapanmasın.
  const acknowledged = !nsfw || (state !== null && state.key === key && state.acknowledged);
  return { acknowledged, acknowledge };
}

export function NsfwCurtain({
  channelName,
  onAccept,
  onBack,
}: {
  channelName: string;
  onAccept: () => void;
  onBack: () => void;
}) {
  return (
    <Curtain icon="eye-off" tone="danger" title={`#${channelName} yaş sınırlı`}>
      <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>
        Bu kanal yetişkinlere yönelik içerik barındırabilir. Devam ederek bunu kabul etmiş olursun; tercihin bu
        cihazda hatırlanır.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Button label="Geri dön" variant="ghost" onPress={onBack} />
        <Button label="Devam et" onPress={onAccept} />
      </View>
    </Curtain>
  );
}

/**
 * Sunucu kuralları kabul edilmeden yazılamıyorsa sohbetin üstüne çıkar.
 * Sahip / yönetici muaf (sunucu `pending: false` döndürür).
 */
export function RulesCurtain({ serverId }: { serverId: string }) {
  const { data: rules } = useServerRules(serverId);
  const accept = useAcceptRules(serverId);
  if (!rules?.pending || !rules.text) return null;

  return (
    <Curtain icon="list" tone="brand" title={`${rules.serverName} kuralları`}>
      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
        Mesaj göndermeden önce kuralları okuyup kabul etmen gerekiyor.
      </Text>
      <ScrollView
        style={{ maxHeight: 320, alignSelf: "stretch", borderRadius: radii.lg, backgroundColor: colors.deep }}
        contentContainerStyle={{ padding: spacing.md }}
      >
        <Text style={{ ...typography.body, color: colors.text }}>{rules.text}</Text>
      </ScrollView>
      <Button
        label="Kuralları kabul ediyorum"
        icon="check"
        fullWidth
        loading={accept.isPending}
        onPress={() =>
          accept.mutate(undefined, {
            onSuccess: () => showToast("Kurallar kabul edildi. Hoş geldin!"),
            onError: (error) =>
              showToast(error instanceof ApiError ? error.message : "Kabul kaydedilemedi.", "error"),
          })
        }
      />
    </Curtain>
  );
}

/** Zaman aşımı notu: "Zaman aşımındasın · 12 dk kaldı" — süre dolunca kendiliğinden kalkar. */
export function useTimeoutNotice(timedOutUntil: string | null | undefined): string | undefined {
  const now = useNow(timedOutUntil ? 15_000 : 0);
  if (!timedOutUntil || !isTimedOut(timedOutUntil, now)) return undefined;
  return `Zaman aşımındasın, mesaj gönderemezsin · ${timeoutRemainingLabel(timedOutUntil, now)}`;
}

function Curtain({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName;
  tone: "danger" | "brand";
  title: string;
  children: React.ReactNode;
}) {
  const accent = tone === "danger" ? colors.danger : colors.brand;
  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 440,
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.xl,
          borderRadius: radii.xl,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tone === "danger" ? colors.raised : colors.brandSoft,
          }}
        >
          <Icon name={icon} size={26} color={accent} />
        </View>
        <Text style={{ ...typography.title, ...fw(800), color: colors.bright, textAlign: "center" }}>{title}</Text>
        {children}
      </View>
    </View>
  );
}
