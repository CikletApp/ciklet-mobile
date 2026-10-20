import { ActivityIndicator, Platform, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import type { MentolPlan } from "@/api/hooks/use-settings";
import { Button, Pressable, showToast } from "@/components/ui";
import { API_BASE_URL } from "@/lib/config";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { PERIOD_LABEL, PLAN_LABEL, PLAN_RANK, iapProductDef } from "./iap-products";
import { useMentolIap } from "./use-mentol-iap";

const STORE_NAME = Platform.OS === "ios" ? "App Store" : "Google Play";
/** Mağaza aboneliği hâlâ hak veriyor ya da yenilenebilir durumda mı (yeniden satın alma anlamsız). */
const LIVE_STATUSES = new Set(["active", "grace", "canceled", "billing_retry", "on_hold", "paused"]);

const STATUS_LABEL: Record<string, string> = {
  active: "Etkin",
  grace: "Ödeme sorunu — ek süre",
  billing_retry: "Ödeme alınamadı",
  canceled: "Yenileme kapalı",
  on_hold: "Askıda (ödeme bekleniyor)",
  paused: "Duraklatıldı",
  expired: "Süresi doldu",
  revoked: "İade edildi",
  pending: "Ödeme bekleniyor",
};

function openPage(url: string) {
  void WebBrowser.openBrowserAsync(url, { toolbarColor: colors.bg, controlsColor: authBrand.lime, showTitle: true }).catch(() =>
    showToast("Sayfa açılamadı.", "error"),
  );
}

/**
 * Mentol'ü App Store / Google Play aboneliğiyle satın alma kartı
 * (`IAP_ENABLED`). Fiyatlar mağazadan; hak sunucuda doğrulanınca işlenir.
 */
export function MentolIapCard({ plan }: { plan: MentolPlan | undefined }) {
  const iap = useMentolIap();
  const store = iap.store;
  const paidPlan = plan?.source === "paid" ? plan.plan : "FREE";
  const unlimited = plan?.source === "paid" && plan.plan !== "FREE" && !plan.expiresAt;
  const storeLive = store && LIVE_STATUSES.has(store.status) ? store : null;
  const otherPlatform = storeLive && storeLive.platform !== (Platform.OS === "ios" ? "apple" : "google") ? storeLive : null;

  let notice: string | null = null;
  if (iap.infoError) notice = "Abonelik bilgisi alınamadı. Bağlantını kontrol et.";
  else if (!iap.infoLoading && !iap.serverReady) notice = "Mağaza satın alımları şu anda kullanılamıyor.";
  else if (unlimited) notice = "Süresiz Mentol planın var; abonelik gerekmiyor.";
  else if (otherPlatform) {
    notice = `Aboneliğin ${otherPlatform.platform === "apple" ? "App Store" : "Google Play"} üzerinden. Değiştirmek ya da iptal etmek için o mağazayı kullan.`;
  }
  const purchasesBlocked = Boolean(notice);

  return (
    <View style={{ marginHorizontal: spacing.lg, padding: spacing.lg, gap: spacing.md, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel }}>
      {storeLive ? (
        <View style={{ gap: 3 }}>
          <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
            {PLAN_LABEL[storeLive.plan]}
            {iapProductDef(storeLive.productId) ? ` · ${PERIOD_LABEL[iapProductDef(storeLive.productId)!.period]}` : ""}
          </Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {STATUS_LABEL[storeLive.status] ?? storeLive.status}
            {storeLive.expiresAt
              ? ` · ${storeLive.autoRenew === false || storeLive.status === "canceled" ? "Bitiş" : "Yenileme"}: ${new Date(storeLive.expiresAt).toLocaleDateString("tr-TR")}`
              : ""}
          </Text>
        </View>
      ) : null}

      {notice ? <Text style={{ ...typography.caption, color: colors.muted }}>{notice}</Text> : null}

      {!purchasesBlocked ? (
        !iap.connected || iap.infoLoading ? (
          <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : iap.products.length === 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.muted }}>{`Abonelikler ${STORE_NAME} üzerinden alınamadı.`}</Text>
            <Button label="Tekrar dene" variant="secondary" onPress={iap.reloadProducts} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {iap.products.map((product) => {
              const def = iapProductDef(product.id)!;
              const current = storeLive?.productId === product.id;
              const lower = PLAN_RANK[def.plan] < PLAN_RANK[paidPlan];
              const disabled = current || lower || (iap.busySku !== null && iap.busySku !== product.id);
              const action = current ? "Mevcut abonelik" : lower ? "Üst planın etkin" : storeLive ? "Bu plana geç" : "Abone ol";
              return (
                <Pressable
                  key={product.id}
                  disabled={disabled}
                  onPress={() => void iap.purchase(product)}
                  haptic="light"
                  accessibilityRole="button"
                  accessibilityLabel={`${PLAN_LABEL[def.plan]} ${PERIOD_LABEL[def.period]}, ${product.displayPrice}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radii.lg,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: current ? colors.brand : colors.border,
                    opacity: disabled && !current ? 0.55 : 1,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ ...typography.bodyStrong, color: colors.bright }}>
                      {PLAN_LABEL[def.plan]} · {PERIOD_LABEL[def.period]}
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      {product.displayPrice} / {def.period === "monthly" ? "ay" : "yıl"}
                    </Text>
                  </View>
                  {iap.busySku === product.id ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <Text style={{ ...typography.caption, fontSize: 14, ...fw(700), color: current ? colors.brand : colors.text }}>{action}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Geri yükle" icon="rotate-ccw" variant="secondary" onPress={() => void iap.restore()} loading={iap.restoring} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Aboneliği yönet" icon="settings" variant="secondary" onPress={() => iap.manage(storeLive?.productId)} fullWidth />
        </View>
      </View>

      <Text style={{ ...typography.caption, color: colors.muted }}>
        Ödeme {STORE_NAME} hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı ücretle otomatik yenilenir. İptal ve
        plan değişikliği {STORE_NAME} abonelik ayarlarından yapılır; kalan süre dönem sonuna kadar kullanılabilir.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <Pressable onPress={() => openPage(`${API_BASE_URL}/terms`)} accessibilityRole="link">
          <Text style={{ ...typography.caption, color: colors.brand }}>Kullanım Koşulları</Text>
        </Pressable>
        <Pressable onPress={() => openPage(`${API_BASE_URL}/privacy`)} accessibilityRole="link">
          <Text style={{ ...typography.caption, color: colors.brand }}>Gizlilik</Text>
        </Pressable>
      </View>
    </View>
  );
}
