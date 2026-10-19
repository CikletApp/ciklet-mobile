import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, Stack } from "expo-router";

import { PURCHASES_ENABLED } from "@/lib/purchases";
import { ApiError } from "@/api/client";
import { useCurrentProfile, useMentolPlan, useStoreCatalog, useUpdateProfile } from "@/api/hooks";
import { Avatar, Button, Icon, Pressable, Screen, ScreenLoader, showToast } from "@/components/ui";
import { AVATAR_DECORATIONS, type AvatarDecoration } from "@/lib/avatar-decorations";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Avatar süsü seçici (web: Ayarlar → Profil → Avatar Süsü).
 *
 * Mentol süsleri FREE planda kilitli (dokununca açıklama), mağaza süsleri
 * yalnızca sahip olunduğunda listelenir. Izgara sütunları ekran
 * genişliğinden hesaplanır: halka ve rozet avatarın dışına taşdığı için
 * her hücre önizlemeden geniş tutulur ve dar ekranda üst üste binmez.
 */
const PREVIEW = 56;

export default function DecorationPickerScreen() {
  const { data: profile, isLoading } = useCurrentProfile();
  const plan = useMentolPlan();
  const store = useStoreCatalog();
  const update = useUpdateProfile();
  const { width } = useWindowDimensions();

  if (isLoading || !profile) return <ScreenLoader />;

  const owned = new Set((store.data?.items ?? []).filter((i) => i.owned).map((i) => i.id));
  const free = (plan.data?.plan ?? "FREE") === "FREE";
  const current = profile.avatarDecorationId ?? null;
  const list = AVATAR_DECORATIONS.filter((d) => !d.store || owned.has(d.id));

  // Hücre en az önizleme + iki yanda halka/rozet payı (≈ 96 px).
  const inner = width - spacing.lg * 2;
  const columns = Math.max(3, Math.min(5, Math.floor(inner / 96)));
  const gap = spacing.sm;
  const cell = Math.floor((inner - gap * (columns - 1)) / columns);

  const choose = (deco: AvatarDecoration | null) => {
    if (update.isPending) return;
    if (deco?.mentol && free) {
      showToast(`${deco.name} Mentol Plus ile açılır.`);
      return;
    }
    if ((deco?.id ?? null) === current) return;
    update.mutate(
      { avatarDecorationId: deco?.id ?? null },
      {
        onSuccess: () => showToast(deco ? `${deco.name} takıldı.` : "Süs kaldırıldı."),
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Süs değiştirilemedi.", "error"),
      }
    );
  };

  const tile = (deco: AvatarDecoration | null) => {
    const id = deco?.id ?? null;
    const selected = id === current;
    const locked = Boolean(deco?.mentol && free);
    return (
      <Pressable
        key={id ?? "none"}
        onPress={() => choose(deco)}
        haptic="light"
        noHitSlop
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: locked }}
        accessibilityLabel={`${deco?.name ?? "Süs yok"}${locked ? ", Mentol'e özel" : ""}`}
        style={({ pressed }) => ({
          width: cell,
          alignItems: "center",
          gap: spacing.sm,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: selected ? colors.brand : "transparent",
          backgroundColor: pressed ? colors.raised : colors.panel,
          opacity: locked ? 0.6 : 1,
        })}
      >
        <Avatar
          imageUrl={profile.imageUrl}
          fallbackText={profile.username}
          size={PREVIEW}
          decorationId={id}
          backgroundColor={colors.panel}
        />
        <Text style={{ fontSize: 12, ...fw(600), color: colors.text, textAlign: "center" }} numberOfLines={1}>
          {deco?.name ?? "Süs yok"}
        </Text>
        {locked ? (
          <View style={{ position: "absolute", top: 6, right: 6 }}>
            <Icon name="sparkles" size={13} color={colors.muted} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Avatar Süsü" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["4xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>
          Süs avatarının etrafında her yerde görünür.{free ? " Kilitli süsler Mentol Plus ile açılır." : ""}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {tile(null)}
          {list.map((deco) => tile(deco))}
        </View>
        {PURCHASES_ENABLED ? (
          <Button
            label="Mağazada daha fazlası"
            icon="sparkles"
            variant="secondary"
            onPress={() => router.push("/store")}
            fullWidth
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
