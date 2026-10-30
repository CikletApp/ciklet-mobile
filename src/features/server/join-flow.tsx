import { useEffect, useState } from "react";
import { Modal, Pressable as RNPressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChannelType, type Channel } from "@ciklet/embedded-activities-sdk/types";

import { ApiError } from "@/api/client";
import { useCompleteOnboarding, useServerOnboarding, useServerRules } from "@/api/hooks";
import { Avatar, Button, EmojiText, Icon, Pressable, showToast } from "@/components/ui";
import { RulesCurtain } from "@/features/server/channel-gates";
import { nextJoinStep, type OnboardingAnswers, type OnboardingConfig } from "@/lib/server-onboarding";
import type { WelcomeChannelView, WelcomeScreenView } from "@/lib/welcome-screen";
import { useAuth } from "@/stores/auth";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Sunucuya katılım akışının mobil karşılıkları:
 *   • `ServerJoinGate`   — web `server-join-gate.tsx`: katılım soruları ve
 *     kural perdesi, sıra sunucu ayarından (`beforeRules`).
 *   • `OnboardingCurtain`— web `onboarding-curtain.tsx`.
 *   • `WelcomeScreenModal` / `WelcomeScreenContent` — web `welcome-screen-gate`
 *     ve `welcome-screen-content`.
 */

/** Kanalı türüne uygun ekranda açar (metin → sohbet, ses/görüntü → ses odası). */
export function openServerChannel(serverId: string, channelId: string, channels: readonly Channel[] | undefined) {
  const channel = channels?.find((item) => item.id === channelId);
  if (channel?.type === ChannelType.AUDIO) router.push(`/voice/${channelId}?serverId=${serverId}`);
  else if (channel?.type === ChannelType.VIDEO) router.push(`/voice/${channelId}?serverId=${serverId}&video=1`);
  else router.push(`/chat/channel/${channelId}?serverId=${serverId}`);
}

// ── Katılım perdeleri ───────────────────────────────────────────────

/**
 * Katılım soruları + kural kabulü. Hiçbir şey beklemiyorsa hiçbir şey
 * çizilmez. Kanal ekranında, rehberde ve sunucu kökünde (web'de katılan
 * üye ilk kanala/rehbere düşer, perde orada açılır) kullanılır.
 */
export function ServerJoinGate({
  serverId,
  channels,
  onboardingOnly = false,
}: {
  serverId: string;
  channels?: readonly Channel[];
  /**
   * Yalnızca soru perdesi (sunucu kökü — kanal listesi). Kural perdesi
   * kanal ekranında kalır; web'de de kenar çubuğu açık, perde sohbetin üstünde.
   */
  onboardingOnly?: boolean;
}) {
  const { data: onboarding } = useServerOnboarding(serverId);
  const { data: rules } = useServerRules(serverId);

  const step = nextJoinStep({
    onboardingPending: onboarding?.pending === true,
    rulesPending: rules?.pending === true && Boolean(rules.text),
    beforeRules: onboarding?.config.beforeRules ?? true,
  });
  if (step === "onboarding" && onboarding) {
    return (
      <OnboardingCurtain
        serverId={serverId}
        serverName={onboarding.serverName}
        config={onboarding.config}
        initialAnswers={onboarding.answers}
        channels={channels}
      />
    );
  }
  if (step === "rules" && !onboardingOnly) return <RulesCurtain serverId={serverId} />;
  return null;
}

/**
 * Katılım soruları perdesi: seçimlere göre roller verilir, ilk seçilen
 * kanala geçilir. Zorunlu soru yoksa "Şimdilik atla" da yanıtı kaydeder
 * (perde bir daha çıkmaz). Metinler web ile aynı.
 */
export function OnboardingCurtain({
  serverId,
  serverName,
  config,
  initialAnswers,
  channels,
}: {
  serverId: string;
  serverName: string;
  config: OnboardingConfig;
  initialAnswers?: OnboardingAnswers;
  channels?: readonly Channel[];
}) {
  const complete = useCompleteOnboarding(serverId);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers ?? {});

  const toggle = (questionId: string, optionId: string, multiple: boolean) =>
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const has = current.includes(optionId);
      const next = multiple ? (has ? current.filter((id) => id !== optionId) : [...current, optionId]) : has ? [] : [optionId];
      return { ...prev, [questionId]: next };
    });

  const missing = config.questions.filter((q) => q.required && !answers[q.id]?.length);
  const anyRequired = config.questions.some((q) => q.required);

  const submit = (payload: OnboardingAnswers) =>
    complete.mutate(payload, {
      onSuccess: ({ channelIds }) => {
        showToast(`${serverName} sunucusuna hoş geldin!`);
        const first = channelIds[0];
        if (first) openServerChannel(serverId, first, channels);
      },
      onError: (error) => showToast(error instanceof ApiError ? error.message : "Yanıtlar kaydedilemedi", "error"),
    });

  return (
    <View style={{ position: "absolute", inset: 0, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.bg }}>
      <View
        style={{
          maxHeight: "100%",
          borderRadius: radii.bentoWrapper,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
          <View style={{ width: 44, height: 44, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSoft }}>
            <Icon name="compass" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, ...fw(800), color: colors.bright }} numberOfLines={1}>
              {`${serverName} sunucusuna hoş geldin`}
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Birkaç soruyla seni ilgilendiğin rollere ve kanallara yönlendirelim.
            </Text>
          </View>
        </View>

        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.xl, paddingBottom: spacing.sm }}>
          {config.questions.map((q) => (
            <View key={q.id} style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                {q.title}
                {q.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                <Text style={{ ...typography.caption, fontSize: 11, color: colors.muted }}>
                  {`  ${q.multiple ? "Birden çok seçebilirsin" : "Birini seç"}`}
                </Text>
              </Text>
              {q.options.map((o) => {
                const selected = answers[q.id]?.includes(o.id) ?? false;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => toggle(q.id, o.id, q.multiple)}
                    haptic="light"
                    accessibilityRole={q.multiple ? "checkbox" : "radio"}
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={o.label}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: selected ? colors.brand : colors.border,
                      backgroundColor: selected ? colors.brandSoft : pressed ? colors.raised : "transparent",
                    })}
                  >
                    {o.emoji ? <EmojiText style={{ fontSize: 18, lineHeight: 24 }}>{o.emoji}</EmojiText> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                        {o.label}
                      </Text>
                      {o.description ? <Text style={{ ...typography.caption, color: colors.muted }}>{o.description}</Text> : null}
                    </View>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        marginTop: 3,
                        borderRadius: 9,
                        borderWidth: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        borderColor: selected ? colors.brand : colors.muted,
                        backgroundColor: selected ? colors.brand : "transparent",
                      }}
                    >
                      {selected ? <Icon name="check" size={12} color={colors.onBrand} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{ gap: spacing.sm, padding: spacing.xl }}>
          {missing.length > 0 ? (
            <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
              {`Yanıtlanmamış zorunlu soru: ${missing.map((q) => q.title).join(", ")}`}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }}>
            {!anyRequired ? (
              <Button label="Şimdilik atla" variant="ghost" disabled={complete.isPending} onPress={() => submit({})} />
            ) : null}
            <Button
              label="Bitir"
              icon="check"
              loading={complete.isPending}
              disabled={missing.length > 0}
              onPress={() => submit(answers)}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Karşılama ekranı ────────────────────────────────────────────────

/** Web `welcome-storage` (yeni üye akışı, kalıcı): profil + sunucu başına bir kez. */
const welcomeSeenKey = (profileId: string, serverId: string) => `ciklet:welcome:seen:${profileId}:${serverId}`;

/**
 * "Sunucuyu Keşfet" penceresi — yeni katılan üyeye bir kez. Pencerenin
 * gösterilip gösterilmeyeceğine (içerik, katılım penceresi, rehber) çağıran
 * karar verir; burada yalnızca "daha önce görüldü mü" denetlenir.
 */
export function WelcomeScreenModal({
  serverId,
  serverName,
  serverImageUrl,
  screen,
  channels,
}: {
  serverId: string;
  serverName: string;
  serverImageUrl: string | null;
  screen: WelcomeScreenView;
  channels?: readonly Channel[];
}) {
  const profileId = useAuth((state) => state.profile?.id);
  const key = profileId ? welcomeSeenKey(profileId, serverId) : null;
  // Okuma bitene kadar kapalı: depo okunmadan pencere bir an açılıp kapanmasın.
  const [state, setState] = useState<{ key: string; open: boolean } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    AsyncStorage.getItem(key)
      .then((value) => alive && setState({ key, open: value !== "1" }))
      .catch(() => alive && setState({ key, open: true }));
    return () => {
      alive = false;
    };
  }, [key]);

  const open = state !== null && state.key === key && state.open;

  const close = () => {
    if (!key) return;
    setState({ key, open: false });
    void AsyncStorage.setItem(key, "1").catch(() => undefined);
  };

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}>
        <RNPressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "90%",
            borderRadius: radii.bentoWrapper,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
            <Text style={{ ...typography.title, fontSize: 18, ...fw(700), color: colors.bright }}>Sunucuyu Keşfet</Text>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Kapat" style={{ padding: spacing.xs }}>
              <Icon name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.lg }}>
            <WelcomeScreenContent
              serverName={serverName}
              serverImageUrl={serverImageUrl}
              description={screen.description}
              channels={screen.channels}
              onChannelPress={(channelId) => {
                close();
                openServerChannel(serverId, channelId, channels);
              }}
            />
            <Button
              label="Şimdilik sadece bakıyorum"
              variant="secondary"
              fullWidth
              onPress={close}
              style={{ marginTop: spacing.xl }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Karşılama penceresinin gövdesi — pencere ve ayar ekranındaki canlı
 * önizleme aynı bileşeni çizer. `onChannelPress` yoksa satırlar tıklanmaz.
 */
export function WelcomeScreenContent({
  serverName,
  serverImageUrl,
  description,
  channels,
  onChannelPress,
}: {
  serverName: string;
  serverImageUrl: string | null;
  description: string | null;
  channels: WelcomeChannelView[];
  onChannelPress?: (channelId: string) => void;
}) {
  return (
    <View>
      <View style={{ alignItems: "center", paddingHorizontal: spacing.sm }}>
        <View style={{ borderRadius: 22, borderCurve: "continuous", overflow: "hidden" }}>
          <Avatar imageUrl={serverImageUrl} fallbackText={serverName} size={80} radius={0} backgroundColor={colors.raised} />
        </View>
        {/* "topluluğuna": web ile aynı gerekçe — ada ek getirmek keyfi adlarda güvenilir değil. */}
        <Text style={{ ...typography.display, color: colors.bright, textAlign: "center", marginTop: spacing.lg }}>
          {`${serverName} topluluğuna hoş geldin!`}
        </Text>
        {description ? (
          <EmojiText style={{ ...typography.body, color: colors.muted, textAlign: "center", marginTop: spacing.sm }}>{description}</EmojiText>
        ) : null}
      </View>

      {channels.length > 0 ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text style={{ ...typography.caption, ...fw(700), color: colors.bright }}>Burada yapılabilecek en önemli şeyler</Text>
          {channels.map((channel) => (
            <Pressable
              key={channel.channelId}
              onPress={onChannelPress ? () => onChannelPress(channel.channelId) : undefined}
              disabled={!onChannelPress}
              accessibilityRole={onChannelPress ? "button" : undefined}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radii.bento,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.raised : colors.deep,
              })}
            >
              <View style={{ width: 32, alignItems: "center" }}>
                {channel.emoji ? <EmojiText style={{ fontSize: 22, lineHeight: 28 }}>{channel.emoji}</EmojiText> : <Icon name="hash" size={20} color={colors.muted} />}
              </View>
              <View style={{ flex: 1 }}>
                <EmojiText style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
                  {channel.description}
                </EmojiText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                  <Icon name="hash" size={12} color={colors.muted} />
                  <Text style={{ ...typography.caption, fontSize: 12, color: colors.muted }} numberOfLines={1}>
                    {channel.channelName}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
