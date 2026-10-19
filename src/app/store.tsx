import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { qk } from "@/api/query-keys";
import {
  useCheckout,
  useCurrentProfile,
  useStoreCatalog,
  useUpdateProfile,
  type CheckoutRequest,
} from "@/api/hooks";
import type { StoreCatalogResponse, StoreItemKind, UpdateProfileInput } from "@/api/types";
import {
  Avatar,
  Button,
  EmptyState,
  Screen,
  ScreenLoader,
  SegmentedTabs,
  TextField,
  showToast,
} from "@/components/ui";
import { NameplateBackground } from "@/features/profile/nameplate";
import { ProfileEffectOverlay } from "@/features/profile/profile-effect";
import { displayNameOf } from "@/lib/format";
import { STORE_KIND_LABEL, formatPriceTry } from "@/lib/profile-extras";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Mağaza (web `/magaza`) — avatar süsleri, isim plakaları, profil efektleri.
 *
 * Katalog, önizleme ve sahip olunan ürünü TAKMA uygulama içinde. Satın alma
 * ve hediye ise ödeme kaydı açılıp web ödeme sayfasına sistem tarayıcısıyla
 * gidilerek yapılır (bkz. `use-store.ts`: mağaza içi dijital ürün satışı
 * App Store / Play kurallarına takılır).
 */
type Item = StoreCatalogResponse["items"][number];

const KIND_FIELD: Record<StoreItemKind, keyof UpdateProfileInput> = {
  decoration: "avatarDecorationId",
  nameplate: "nameplateId",
  effect: "profileEffectId",
};

export default function StoreScreen() {
  const catalog = useStoreCatalog();
  const { data: profile } = useCurrentProfile();
  const [kind, setKind] = useState<StoreItemKind>("decoration");

  if (catalog.isLoading) return <ScreenLoader />;
  if (!catalog.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Mağaza" }} />
        <EmptyState icon="sparkles" title="Mağaza açılamadı" description="Bağlantını kontrol edip tekrar dene." />
      </Screen>
    );
  }

  const data = catalog.data;
  const items = data.items.filter((item) => item.kind === kind);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Mağaza" }} />
      <SegmentedTabs
        variant="pill"
        value={kind}
        onChange={setKind}
        items={(Object.keys(STORE_KIND_LABEL) as StoreItemKind[]).map((id) => ({ id, label: STORE_KIND_LABEL[id] }))}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...typography.caption, color: colors.muted }}>
          {data.mentol
            ? `Mentol üyesisin: tüm ürünlerde %${data.discountPercent} indirim.`
            : `Mentol üyelerine %${data.discountPercent} indirim.`}{" "}
          Ödeme web ödeme sayfasında, tarayıcıda tamamlanır.
        </Text>
        {items.map((item) => (
          <StoreCard
            key={item.id}
            item={item}
            equipped={data.equipped[item.kind] === item.id}
            purchasable={data.purchasable}
            profile={profile ? { id: profile.id, imageUrl: profile.imageUrl, username: profile.username, title: displayNameOf(profile) } : null}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function StoreCard({
  item,
  equipped,
  purchasable,
  profile,
}: {
  item: Item;
  equipped: boolean;
  purchasable: boolean;
  profile: { id: string; imageUrl: string | null; username: string; title: string } | null;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateProfile();
  const checkout = useCheckout();
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const discounted = item.finalPrice < item.price;

  const toggleEquip = () => {
    update.mutate(
      { [KIND_FIELD[item.kind]]: equipped ? null : item.id },
      {
        onSuccess: () => {
          showToast(equipped ? "Çıkarıldı." : `${item.name} takıldı.`);
          // "Takılı" bilgisi katalog yanıtında; profil kartı da efekti/plakayı taşıyor.
          void queryClient.invalidateQueries({ queryKey: qk.store });
          void queryClient.invalidateQueries({ queryKey: ["profile-card"] });
        },
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Değiştirilemedi.", "error"),
      }
    );
  };

  const buy = (request: CheckoutRequest) =>
    checkout.mutate(request, {
      onSuccess: () => {
        setGiftOpen(false);
        setGiftTo("");
      },
      onError: (error) => showToast(error instanceof ApiError ? error.message : "Ödeme başlatılamadı.", "error"),
    });

  return (
    <View style={{ borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, overflow: "hidden" }}>
      <Preview item={item} profile={profile} />
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
          <Text style={{ ...typography.title, color: colors.bright, flex: 1 }} numberOfLines={1}>
            {item.name}
          </Text>
          {item.owned ? (
            <Text style={{ ...typography.caption, ...fw(700), color: colors.brand }}>SENDE</Text>
          ) : (
            <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
              {discounted ? (
                <Text style={{ ...typography.caption, color: colors.muted, textDecorationLine: "line-through" }}>
                  {formatPriceTry(item.price)}{" "}
                </Text>
              ) : null}
              {formatPriceTry(item.finalPrice)}
            </Text>
          )}
        </View>
        <Text style={{ ...typography.caption, color: colors.muted }}>{item.description}</Text>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          {item.owned ? (
            <Button
              label={equipped ? "Çıkar" : "Tak"}
              variant={equipped ? "secondary" : "primary"}
              onPress={toggleEquip}
              loading={update.isPending}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label="Satın al"
              onPress={() => buy({ kind: "store", itemId: item.id })}
              disabled={!purchasable || checkout.isPending}
              loading={checkout.isPending && !giftOpen}
              style={{ flex: 1 }}
            />
          )}
          <Button
            label="Hediye et"
            icon="heart"
            variant="secondary"
            onPress={() => setGiftOpen((open) => !open)}
            disabled={!purchasable}
            style={{ flex: 1 }}
          />
        </View>
        {giftOpen ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <TextField
              label="KİME?"
              value={giftTo}
              onChangeText={setGiftTo}
              placeholder="@kullaniciadi"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label={`Hediye et · ${formatPriceTry(item.finalPrice)}`}
              icon="heart"
              onPress={() => buy({ kind: "store", itemId: item.id, giftTo: giftTo.trim() })}
              disabled={!giftTo.trim().replace(/^@/, "")}
              loading={checkout.isPending}
              fullWidth
            />
          </View>
        ) : null}
        {!purchasable ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>Satın alma şu an kapalı.</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Ürün önizlemesi kendi profilinle çizilir (web ile aynı). */
function Preview({
  item,
  profile,
}: {
  item: Item;
  profile: { id: string; imageUrl: string | null; username: string; title: string } | null;
}) {
  if (item.kind === "effect") {
    return (
      <View style={{ height: 96, backgroundColor: colors.brandSoft }}>
        <ProfileEffectOverlay id={item.id} height={96} />
      </View>
    );
  }
  if (item.kind === "nameplate") {
    return (
      <View style={{ height: 96, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radii.md }}>
          <NameplateBackground id={item.id} radius={radii.md} />
          <Avatar imageUrl={profile?.imageUrl} fallbackText={profile?.username} size={36} decorationId={null} />
          <Text style={{ ...typography.bodyStrong, color: colors.bright }} numberOfLines={1}>
            {profile?.title ?? "Sen"}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ height: 112, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <Avatar imageUrl={profile?.imageUrl} fallbackText={profile?.username} size={64} decorationId={item.id} />
    </View>
  );
}
