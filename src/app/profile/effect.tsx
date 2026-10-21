import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, Stack } from "expo-router";

import { ApiError } from "@/api/client";
import { useCurrentProfile, useMentolPlan, useStoreCatalog, useUpdateProfile } from "@/api/hooks";
import { Button, Icon, Pressable, Screen, ScreenLoader, showToast } from "@/components/ui";
import { ProfileEffectOverlay } from "@/features/profile/profile-effect";
import { PROFILE_EFFECTS, findProfileEffect, type ProfileEffect } from "@/lib/profile-effects";
import { PURCHASES_ENABLED } from "@/lib/purchases";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Profil efekti seçici (web: Ayarlar → Profil → Profil Efekti). Avatar süsü
 * seçicisiyle aynı düzen: ücretsiz ve Mentol efektleri doğrudan takılır
 * (Mentol FREE planda kilitli), mağaza efektleri yalnızca sahip olunduğunda
 * listelenir. Her döşeme efekti küçük bir afiş üstünde oynatır.
 */
const PREVIEW_HEIGHT = 72;

export default function EffectPickerScreen() {
  const { data: profile, isLoading } = useCurrentProfile();
  const plan = useMentolPlan();
  const store = useStoreCatalog();
  const update = useUpdateProfile();
  const { width } = useWindowDimensions();

  if (isLoading || !profile) return <ScreenLoader />;

  const owned = new Set((store.data?.items ?? []).filter((i) => i.owned).map((i) => i.id));
  const free = (plan.data?.plan ?? "FREE") === "FREE";
  const current = findProfileEffect(profile.profileEffectId)?.id ?? null;
  const list = PROFILE_EFFECTS.filter((e) => e.tier !== "store" || owned.has(e.id));

  const inner = width - spacing.lg * 2;
  const columns = inner >= 520 ? 3 : 2;
  const gap = spacing.sm;
  const cell = Math.floor((inner - gap * (columns - 1)) / columns);

  const choose = (effect: ProfileEffect | null) => {
    if (update.isPending) return;
    if (effect?.tier === "mentol" && free) {
      showToast(`${effect.name} Mentol Plus ile açılır.`);
      return;
    }
    if ((effect?.id ?? null) === current) return;
    update.mutate(
      { profileEffectId: effect?.id ?? null },
      {
        onSuccess: () => showToast(effect ? `${effect.name} takıldı.` : "Efekt kaldırıldı."),
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Efekt değiştirilemedi.", "error"),
      }
    );
  };

  const tile = (effect: ProfileEffect | null) => {
    const id = effect?.id ?? null;
    const selected = id === current;
    const locked = effect?.tier === "mentol" && free;
    return (
      <Pressable
        key={id ?? "none"}
        onPress={() => choose(effect)}
        haptic="light"
        noHitSlop
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: locked }}
        accessibilityLabel={`${effect?.name ?? "Efekt yok"}${locked ? ", Mentol'e özel" : ""}`}
        style={({ pressed }) => ({
          width: cell,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: selected ? colors.brand : "transparent",
          backgroundColor: pressed ? colors.raised : colors.panel,
          overflow: "hidden",
          opacity: locked ? 0.6 : 1,
        })}
      >
        <View style={{ height: PREVIEW_HEIGHT, backgroundColor: profile.bannerColor ?? colors.brandSoft }}>
          {effect ? <ProfileEffectOverlay id={effect.id} height={PREVIEW_HEIGHT} animate={selected} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: spacing.sm }}>
          <Text style={{ fontSize: 12, ...fw(600), color: colors.text, flexShrink: 1 }} numberOfLines={1}>
            {effect?.name ?? "Efekt yok"}
          </Text>
          {locked ? (
            <View style={{ marginLeft: "auto" }}>
              <Icon name="sparkles" size={13} color={colors.muted} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Profil Efekti" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Efekt profil kartının üstünde oynar.{free ? " Kilitli efektler Mentol Plus ile açılır." : ""}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {tile(null)}
          {list.map((effect) => tile(effect))}
        </View>
        {PURCHASES_ENABLED ? (
          <Button label="Mağazada daha fazlası" icon="sparkles" variant="secondary" onPress={() => router.push("/store")} fullWidth />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
