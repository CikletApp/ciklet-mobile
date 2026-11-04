import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { create } from "zustand";

import { SkuType, formatKurus, useAppSkuCheckout, useAppSkuOffer } from "@/api/hooks";
import { ApiError } from "@/api/client";
import { Button, Icon, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Uygulama ürünü satın alma sayfası — premium buton (Discord button style 6)
 * ve aktivite `startPurchase` açar. Web components/app-store/sku-purchase-panel
 * ile aynı bilgi ve metinler; fark: mağaza kuralları gereği uygulama içi
 * dijital ürün satışı yapılmaz, "Web'de Satın Al" ödeme sayfasını sistem
 * tarayıcısında açar.
 */

interface SkuPurchaseState {
  request: { skuId: string; guildId?: string | null } | null;
  open: (skuId: string, guildId?: string | null) => void;
  close: () => void;
}

export const useSkuPurchase = create<SkuPurchaseState>((set) => ({
  request: null,
  open: (skuId, guildId) => set({ request: { skuId, guildId: guildId ?? null } }),
  close: () => set({ request: null }),
}));

const KIND_LABEL: Record<number, string> = {
  [SkuType.DURABLE]: "Kalıcı",
  [SkuType.CONSUMABLE]: "Tüketilebilir",
  [SkuType.SUBSCRIPTION]: "Abonelik · 30 gün",
};

export const WEB_PURCHASE_NOTE = "Uygulama içi satın almalar şimdilik yalnızca web'de yapılabiliyor.";

/** Kök düzende bir kez takılır. */
export function SkuPurchaseHost() {
  const request = useSkuPurchase((s) => s.request);
  const close = useSkuPurchase((s) => s.close);
  if (!request) return null;
  return <SkuPurchaseSheet skuId={request.skuId} guildId={request.guildId ?? null} onClose={close} />;
}

function SkuPurchaseSheet({ skuId, guildId, onClose }: { skuId: string; guildId: string | null; onClose: () => void }) {
  const offer = useAppSkuOffer(skuId, guildId);
  const checkout = useAppSkuCheckout();
  const data = offer.data;
  const owned = data ? data.sku.type !== SkuType.SUBSCRIPTION && data.entitlements.length > 0 : false;
  const disabledReason = !data ? null : !data.purchasesEnabled ? "Satın alma şu anda kapalı" : owned ? "Sahipsin" : data.blocker;
  const image = data ? (data.sku.image_url ?? data.application.imageUrl) : null;
  const targetGuild = data?.guildRequired ? (guildId && data.eligibleGuilds.some((g) => g.id === guildId) ? guildId : data.eligibleGuilds[0]?.id ?? null) : null;

  const buy = () => {
    checkout.mutate(
      { skuId, guildId: targetGuild },
      {
        onError: (error) => showToast(error instanceof ApiError ? error.message : "Ödeme başlatılamadı.", "error"),
      },
    );
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "82%",
            paddingTop: spacing.lg,
            paddingBottom: spacing["2xl"],
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />
          {offer.isLoading ? (
            <ActivityIndicator style={{ padding: spacing["3xl"] }} color={colors.muted} />
          ) : !data ? (
            <View style={{ padding: spacing["2xl"], alignItems: "center", gap: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>Ürün bulunamadı ya da satışta değil.</Text>
              <Button label="Kapat" variant="secondary" onPress={onClose} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, alignItems: "center" }}>
              {image ? (
                <Image source={{ uri: image }} style={{ width: 80, height: 80, borderRadius: radii.lg }} />
              ) : (
                <View style={{ width: 80, height: 80, borderRadius: radii.lg, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="gem" size={32} color={colors.muted} />
                </View>
              )}
              <View style={{ alignItems: "center", gap: 2 }}>
                <Text style={{ ...typography.display, color: colors.bright, textAlign: "center" }}>{data.sku.name}</Text>
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {data.application.name} · {KIND_LABEL[data.sku.type] ?? ""}
                </Text>
              </View>
              {data.sku.description ? (
                <Text style={{ ...typography.body, color: colors.text, textAlign: "center" }}>{data.sku.description}</Text>
              ) : null}
              <Text style={{ ...typography.display, color: colors.bright }}>{formatKurus(data.sku.price.amount, data.sku.price.currency)}</Text>
              {data.guildRequired && targetGuild ? (
                <Text style={{ ...typography.caption, color: colors.muted }}>
                  {data.eligibleGuilds.find((g) => g.id === targetGuild)?.name} sunucusu için
                </Text>
              ) : null}
              {disabledReason ? (
                <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>{disabledReason}</Text>
              ) : (
                <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>{WEB_PURCHASE_NOTE}</Text>
              )}
              <View style={{ flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" }}>
                <Button label="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <Button
                  label="Web'de Satın Al"
                  icon="gem"
                  onPress={buy}
                  loading={checkout.isPending}
                  disabled={Boolean(disabledReason)}
                  style={{ flex: 1 }}
                />
              </View>
              <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
                Ödeme Ciklet üzerinden alınır. Ürünü {data.application.name} sağlar; ürünle ilgili destek uygulamanın geliştiricisindedir.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
