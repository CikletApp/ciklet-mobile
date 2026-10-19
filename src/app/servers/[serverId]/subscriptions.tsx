import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { ApiError } from "@/api/client";
import { useCheckout, useServerSummary, useServerTiers } from "@/api/hooks";
import { Button, EmptyState, Screen, ScreenLoader, showDialog } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatPriceTry } from "@/lib/profile-extras";
import { PURCHASES_ENABLED } from "@/lib/purchases";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";

/**
 * Sunucu abonelikleri (web: sunucu menüsü → Abonelikler).
 *
 * Kademeler, kendi aboneliğin ve bitiş tarihi uygulamada; abone olma /
 * uzatma / kademe değiştirme ödeme kaydı açıp web ödeme sayfasını
 * tarayıcıda açar (mağaza kuralları, bkz. `use-store.ts`). Kademe
 * oluşturma ve gelir kartları web Sunucu Ayarları → Abonelikler'de.
 * iOS'ta fiyat ve abone olma yok; kademeler ve kendi aboneliğin görünür
 * (lib/purchases).
 */
export default function ServerSubscriptionsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerSummary(serverId);
  const tiers = useServerTiers(serverId);
  const checkout = useCheckout();

  if (tiers.isLoading) return <ScreenLoader />;

  const data = tiers.data;
  const list = data?.tiers ?? [];
  const mine = data?.mine ?? null;

  const subscribe = (tierId: string) =>
    checkout.mutate(
      { kind: "tier", serverId, tierId },
      { onError: (error) => showDialog("Ödeme başlatılamadı", error instanceof ApiError ? error.message : "Tekrar dene.") }
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Abonelikler" }} />
      {list.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Abonelik kademesi yok"
          description={
            data?.manager
              ? "Kademeleri web'de Sunucu Ayarları → Abonelikler'den oluşturabilirsin."
              : "Bu sunucu henüz abonelik sunmuyor."
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {server?.name ? `${server.name} sunucusunu destekle. ` : ""}
            {PURCHASES_ENABLED
              ? "Abonelik 30 gün sürer ve kademenin rolünü verir; otomatik yenilenmez. Ödeme web ödeme sayfasında, tarayıcıda tamamlanır."
              : "Abonelik kademenin rolünü verir."}
          </Text>
          {mine ? (
            <View style={{ padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.brandSoft }}>
              <Text style={{ ...typography.bodyStrong, color: colors.brand }}>
                Abonesin · {formatDate(mine.expiresAt)} tarihine kadar
              </Text>
            </View>
          ) : null}
          {list.map((tier) => {
            const current = mine?.tierId === tier.id;
            const label = current ? "30 gün uzat" : mine ? "Bu kademeye geç" : "Abone ol";
            return (
              <View
                key={tier.id}
                style={{
                  padding: spacing.lg,
                  gap: spacing.sm,
                  borderRadius: radii.xl,
                  borderCurve: "continuous",
                  backgroundColor: colors.panel,
                  borderWidth: current ? 1 : 0,
                  borderColor: colors.brand,
                  opacity: tier.active ? 1 : 0.6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
                  <Text style={{ ...typography.title, color: colors.bright, flex: 1 }} numberOfLines={1}>
                    {tier.name}
                  </Text>
                  {PURCHASES_ENABLED ? (
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                      {formatPriceTry(tier.price)}
                      <Text style={{ ...typography.caption, color: colors.muted }}> / ay</Text>
                    </Text>
                  ) : null}
                </View>
                {tier.description ? (
                  <Text style={{ ...typography.body, color: colors.text }}>{tier.description}</Text>
                ) : null}
                {tier.role ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tier.role.color || colors.muted }} />
                    <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{tier.role.name} rolü</Text>
                  </View>
                ) : null}
                {data?.manager ? (
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {tier.active ? "Satışta" : "Satışa kapalı"}
                    {tier.subscriberCount !== undefined ? ` · ${tier.subscriberCount} etkin abone` : ""}
                  </Text>
                ) : null}
                {PURCHASES_ENABLED && tier.active ? (
                  <Button
                    label={label}
                    variant={current ? "secondary" : "primary"}
                    onPress={() => subscribe(tier.id)}
                    loading={checkout.isPending && checkout.variables?.kind === "tier" && checkout.variables.tierId === tier.id}
                    disabled={checkout.isPending}
                    fullWidth
                  />
                ) : null}
              </View>
            );
          })}
          {data?.manager ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              {"Kademe ekleme, satışa açma/kapama ve gelir kartları web'de Sunucu Ayarları → Abonelikler'de."}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
