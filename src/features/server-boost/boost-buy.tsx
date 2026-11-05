import { ActivityIndicator, Text, View } from "react-native";
import { deepLinkToSubscriptions } from "expo-iap";

import type { BoostSlot } from "@/api/hooks";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { IAP_ENABLED, PURCHASES_ENABLED } from "@/lib/purchases";
import { boostSku } from "@/features/mentol/iap-products";
import { colors, spacing, typography } from "@/theme/tokens";
import { useBoostIap } from "./use-boost-iap";
import { siteHost } from "@/lib/config";

/**
 * "Takviye Satın Al" — mobilde YALNIZCA mağaza içi satın alma (App Store /
 * Google Play). Web'in PayTR ödemesi (POST /api/boosts/checkout) mobilde
 * kullanılmaz (mağaza kuralları, bkz. lib/purchases).
 *
 *  - IAP kapalı derlemede: iOS'ta satın alma yüzeyi hiç çizilmez; Android'de
 *    "yakında" notu.
 *  - Zaten etkin bir mağaza takviyesi varsa: mağaza aynı aboneliği ikinci
 *    kez satmaz → açıklama (Android'de web'den alınabileceği de söylenir;
 *    iOS'ta dışarıdaki satın almaya yönlendirme yasak, 3.1.1).
 */
export function BoostBuySection({
  hasStoreSlot,
  variant = "primary",
  onVerified,
}: {
  hasStoreSlot: boolean;
  variant?: "primary" | "secondary";
  onVerified?: (slots: BoostSlot[]) => void;
}) {
  const t = useT();
  if (!IAP_ENABLED) {
    return PURCHASES_ENABLED ? <Hint text={t("serverBoost.actions.comingSoon")} /> : null;
  }
  if (hasStoreSlot) {
    return <Hint text={PURCHASES_ENABLED ? `${t("serverBoost.mobile.storeLimit")} ${t("serverBoost.mobile.moreOnWeb", { site: siteHost() })}` : t("serverBoost.mobile.storeLimit")} />;
  }
  return <StoreBuyButton variant={variant} onVerified={onVerified} />;
}

/** Ayrı bileşen: `useIAP` yalnızca IAP açıkken bağlanır. */
function StoreBuyButton({ variant, onVerified }: { variant: "primary" | "secondary"; onVerified?: (slots: BoostSlot[]) => void }) {
  const t = useT();
  const iap = useBoostIap(onVerified);
  if (iap.loading) {
    return (
      <View style={{ paddingVertical: spacing.md, alignItems: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (!iap.serverReady || !iap.product) return <Hint text={t("serverBoost.mobile.unavailable")} />;
  return (
    <View style={{ gap: spacing.xs }}>
      <Button
        label={t("serverBoost.actions.buy")}
        icon="gem"
        variant={variant}
        fullWidth
        size="lg"
        loading={iap.busy}
        onPress={() => void iap.purchase()}
      />
      <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>
        {t("serverBoost.mobile.perMonth", { price: iap.product.displayPrice })}
      </Text>
      {/* App Store 3.1.1: satın alınabilen her abonelik için geri yükleme yolu. */}
      <Button
        label={t("serverBoost.mobile.restore")}
        variant="ghost"
        fullWidth
        loading={iap.restoring}
        disabled={iap.busy}
        onPress={() => void iap.restore()}
      />
    </View>
  );
}

function Hint({ text }: { text: string }) {
  return <Text style={{ ...typography.caption, color: colors.muted, textAlign: "center" }}>{text}</Text>;
}

/** Mağazanın abonelik ayarları — STORE takviyesi orada iptal edilir. */
export function openStoreBoostSubscription(onError: () => void) {
  void deepLinkToSubscriptions({ skuAndroid: boostSku(), packageNameAndroid: "com.ciklet.mobile" }).catch(onError);
}
