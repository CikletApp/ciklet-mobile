import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useCheckout, useServerSummary, useServerTiers } from "@/api/hooks";
import { useServerRoleDetails } from "@/api/hooks/use-roles";
import {
  TIER_DESCRIPTION_MAX,
  TIER_NAME_MAX,
  TIER_PRICE_MAX,
  TIER_PRICE_MIN,
  useCreateTier,
  useDeleteTier,
  usePatchTier,
  useTierRevenue,
} from "@/api/hooks/use-subscription-tiers";
import { Button, EmptyState, Icon, Pressable, Screen, ScreenLoader, TextField, showDialog, showToast } from "@/components/ui";
import { ChoiceSheet, SelectButton } from "@/features/server/settings-form";
import { formatDate } from "@/lib/format";
import { formatPriceTry } from "@/lib/profile-extras";
import { PURCHASES_ENABLED } from "@/lib/purchases";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { userErrorMessage } from "@/lib/user-error";

/**
 * Sunucu abonelikleri (web: sunucu menüsü → Abonelikler).
 *
 * Kademeler, kendi aboneliğin ve bitiş tarihi uygulamada; abone olma /
 * uzatma / kademe değiştirme ödeme kaydı açıp web ödeme sayfasını
 * tarayıcıda açar (mağaza kuralları, bkz. `use-store.ts`).
 * Yöneticiye web Sunucu Ayarları → Abonelikler ile aynı yönetim: satışa
 * aç/kapat, sil, yeni kademe ve (sahibe) gelir kartları.
 * iOS'ta fiyat, abone olma, kademe ekleme ve gelir yok; kademeler, kendi
 * aboneliğin ve satışa aç/kapat/sil görünür (lib/purchases).
 */
export default function ServerSubscriptionsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { data: server } = useServerSummary(serverId);
  const tiers = useServerTiers(serverId);
  const checkout = useCheckout();
  const manager = tiers.data?.manager === true;
  const revenue = useTierRevenue(serverId, manager && PURCHASES_ENABLED);
  const patch = usePatchTier(serverId);
  const remove = useDeleteTier(serverId);

  if (tiers.isLoading) return <ScreenLoader />;

  const data = tiers.data;
  const list = data?.tiers ?? [];
  const mine = data?.mine ?? null;
  const money = (minor: number) => formatPriceTry(minor / 100);
  const failed = (error: unknown, fallback: string) => showToast(userErrorMessage(error, fallback), "error");
  const confirmRemove = (tier: { id: string; name: string }) =>
    showDialog("Kademeyi sil", `"${tier.name}" kademesi silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: () => remove.mutate(tier.id, { onError: (error) => failed(error, "Kademe silinemedi") }) },
    ]);

  const subscribe = (tierId: string) =>
    checkout.mutate(
      { kind: "tier", serverId, tierId },
      { onError: (error) => showDialog("Ödeme başlatılamadı", userErrorMessage(error, "Tekrar dene.")) }
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Abonelikler" }} />
      {list.length === 0 && !manager ? (
        <EmptyState
          icon="sparkles"
          title="Abonelik kademesi yok"
          description="Bu sunucu henüz abonelik sunmuyor."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["4xl"] }}>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {server?.name ? `${server.name} sunucusunu destekle. ` : ""}
            {PURCHASES_ENABLED
              ? "Abonelik 30 gün sürer ve kademenin rolünü verir; otomatik yenilenmez. Ödeme web ödeme sayfasında, tarayıcıda tamamlanır."
              : "Abonelik kademenin rolünü verir."}
          </Text>
          {manager ? (
            <Text style={{ ...typography.caption, color: colors.muted }}>
              Üyeler kademeyi 30 günlüğüne satın alır ve süre boyunca kademenin rolünü taşır. Abonelere özel kanal için o role kanal izinlerinden erişim ver. Ödemeler PayTR ile alınır; platform payı düşüldükten sonraki hak ediş elle aktarılır.
            </Text>
          ) : null}
          {revenue.data ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {[
                  { label: "Etkin abone", value: String(revenue.data.activeSubscribers) },
                  { label: "Son 30 gün hak ediş", value: money(revenue.data.last30Days.netMinor) },
                  { label: "Toplam hak ediş", value: money(revenue.data.total.netMinor) },
                ].map((card) => (
                  <View
                    key={card.label}
                    style={{ flexGrow: 1, flexBasis: 140, padding: spacing.md, gap: 4, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.bentoBorder, backgroundColor: colors.panel }}
                  >
                    <Text style={{ ...typography.overline, color: colors.muted }}>{card.label.toLocaleUpperCase("tr-TR")}</Text>
                    <Text style={{ ...typography.title, ...fw(800), color: colors.bright }}>{card.value}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ ...typography.caption, fontSize: 11, color: colors.muted }}>
                Platform payı %{revenue.data.feePercent}. Toplam brüt {money(revenue.data.total.grossMinor)} ({revenue.data.total.count} ödeme).
              </Text>
            </View>
          ) : null}
          {manager && list.length === 0 ? <Text style={{ ...typography.body, color: colors.muted }}>Henüz kademe yok.</Text> : null}
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
                {manager ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={{ ...typography.caption, color: colors.muted, flex: 1 }}>
                      {tier.active ? "Satışta" : "Satışta değil"}
                      {tier.subscriberCount !== undefined ? ` · ${tier.subscriberCount} etkin abone` : ""}
                    </Text>
                    <Pressable
                      onPress={() => patch.mutate({ tierId: tier.id, active: !tier.active }, { onError: (error) => failed(error, "Kademe güncellenemedi") })}
                      disabled={patch.isPending}
                      accessibilityRole="button"
                      style={({ pressed }) => ({ paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.md, backgroundColor: pressed ? colors.raised : "transparent" })}
                    >
                      <Text style={{ ...typography.caption, ...fw(600), color: colors.text }}>{tier.active ? "Satışa kapat" : "Satışa aç"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemove(tier)}
                      disabled={remove.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Sil"
                      hitSlop={6}
                      style={({ pressed }) => ({ padding: 6, borderRadius: radii.md, backgroundColor: pressed ? colors.raised : "transparent" })}
                    >
                      <Icon name="trash" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
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
          {manager && PURCHASES_ENABLED ? <NewTierForm serverId={serverId} /> : null}
        </ScrollView>
      )}
    </Screen>
  );
}

/** Web "Yeni kademe" kutusu: ad, aylık fiyat (TL), kademe rolü, açıklama. */
function NewTierForm({ serverId }: { serverId: string }) {
  const roles = useServerRoleDetails(serverId);
  const create = useCreateTier(serverId);
  const [form, setForm] = useState({ name: "", price: "49", description: "", roleId: "" });
  const [rolePicker, setRolePicker] = useState(false);
  const roleList = (roles.data ?? []).filter((role) => role.name !== "@everyone");
  const role = roleList.find((r) => r.id === form.roleId);

  const submit = () =>
    create.mutate(
      { ...form, price: Number(form.price.replace(",", ".")) },
      {
        onSuccess: () => {
          setForm({ name: "", price: "49", description: "", roleId: "" });
          showToast("Kademe oluşturuldu");
        },
        onError: (error) => showToast(userErrorMessage(error, "Kademe oluşturulamadı"), "error"),
      }
    );

  return (
    <View style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radii.xl, borderCurve: "continuous", borderWidth: 1, borderColor: colors.bentoBorder, backgroundColor: colors.panel }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>YENİ KADEME</Text>
      <TextField placeholder="Kademe adı (ör. Destekçi)" maxLength={TIER_NAME_MAX} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <TextField
        placeholder="Aylık fiyat (TL)"
        hint={`${TIER_PRICE_MIN}-${TIER_PRICE_MAX} TL`}
        keyboardType="decimal-pad"
        value={form.price}
        onChangeText={(price) => setForm({ ...form, price })}
      />
      <SelectButton value={role ? `@${role.name}` : null} placeholder="Kademe rolü seç…" icon="shield" onPress={() => setRolePicker(true)} />
      <TextField
        placeholder="Abonelerin ne kazandığını yaz (özel kanallar, rozet rengi…)"
        multiline
        maxLength={TIER_DESCRIPTION_MAX}
        value={form.description}
        onChangeText={(description) => setForm({ ...form, description })}
      />
      <Button
        label="Kademe ekle"
        icon="plus"
        onPress={submit}
        loading={create.isPending}
        disabled={create.isPending || !form.name.trim() || !form.roleId}
      />
      <ChoiceSheet
        visible={rolePicker}
        title="Kademe rolü"
        options={roleList.map((r) => ({ id: r.id, label: `@${r.name}`, dot: r.color }))}
        selected={form.roleId ? [form.roleId] : []}
        onClose={() => setRolePicker(false)}
        onPick={(roleId) => {
          setForm({ ...form, roleId });
          setRolePicker(false);
        }}
        empty="Önce bir rol oluştur."
      />
    </View>
  );
}
