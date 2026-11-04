import { Text, View } from "react-native";

import { useMentolPayments } from "@/api/hooks/use-account-privacy";
import { openPaymentPage, useStoreCatalog } from "@/api/hooks/use-store";
import { Icon, Pressable, SectionHeader, showToast } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { fw } from "@/theme/fonts";
import { INTL_LOCALES, useLocale, useT, type MessageKey, type Translator } from "@/lib/i18n";

/**
 * Ödeme geçmişi (web `components/mentol/mentol-payments.tsx`): son 50
 * ödeme, en yeni önce. Boşsa hiç çizilmez. Makbuz numarası sağlayıcı sipariş
 * kodu; dokununca ödeme sayfası (süreli bağlantıyla) tarayıcıda açılır.
 */
interface PaymentRow {
  id: string;
  plan: "PLUS" | "PRO" | null;
  storeItemId?: string | null;
  serverTierId?: string | null;
  boostQuantity?: number | null;
  appSkuId?: string | null;
  period: "monthly" | "yearly" | "once";
  amount: number;
  currency: "TRY" | "USD" | "EUR";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  merchantOid: string;
  createdAt: string;
  paidAt: string | null;
  recipient: { username: string; name: string | null } | null;
}

const PLAN_LABEL: Record<"PLUS" | "PRO", string> = { PLUS: "Mentol Plus", PRO: "Mentol Pro" };

const STATUS_LABEL: Record<PaymentRow["status"], MessageKey> = {
  PENDING: "moreScreens.payments.status.PENDING",
  PAID: "moreScreens.payments.status.PAID",
  FAILED: "moreScreens.payments.status.FAILED",
  REFUNDED: "moreScreens.payments.status.REFUNDED",
};

const STATUS_COLOR: Record<PaymentRow["status"], string> = {
  PENDING: colors.muted,
  PAID: colors.success,
  FAILED: colors.danger,
  REFUNDED: colors.muted,
};

function paymentLabel(t: Translator, p: PaymentRow, itemName: (id: string) => string | undefined): string {
  if (p.appSkuId) return t("moreScreens.payments.appProduct");
  if (p.boostQuantity) {
    const period = p.period === "yearly" ? t("moreScreens.payments.oneYear") : t("moreScreens.payments.oneMonth");
    return t("moreScreens.payments.boost", { count: p.boostQuantity, period });
  }
  if (p.serverTierId) return t("moreScreens.payments.serverSubscription");
  if (p.storeItemId) return t("moreScreens.payments.store", { item: itemName(p.storeItemId) ?? p.storeItemId });
  return `${p.plan ? PLAN_LABEL[p.plan] : "Mentol"} · ${p.period === "monthly" ? t("moreScreens.payments.oneMonth") : t("moreScreens.payments.oneYear")}`;
}

function formatPrice(amount: number, currency: PaymentRow["currency"], locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function MentolPaymentsList() {
  const payments = useMentolPayments<PaymentRow[]>();
  const catalog = useStoreCatalog();
  const t = useT();
  const locale = INTL_LOCALES[useLocale()];
  const rows = payments.data ?? [];
  if (rows.length === 0) return null;
  const itemName = (id: string) => catalog.data?.items.find((item) => item.id === id)?.name;

  return (
    <>
      <SectionHeader title={t("moreScreens.payments.title")} />
      <Text style={{ ...typography.caption, color: colors.muted, marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        {t("moreScreens.payments.hint")}
      </Text>
      <View style={{ marginHorizontal: spacing.lg, borderRadius: radii.xl, borderCurve: "continuous", backgroundColor: colors.panel, overflow: "hidden" }}>
        {rows.map((p, index) => (
          <Pressable
            key={p.id}
            onPress={() => void openPaymentPage(p.id).catch(() => showToast(t("moreScreens.payments.openFailed"), "error"))}
            accessibilityRole="link"
            accessibilityLabel={`${paymentLabel(t, p, itemName)}, ${formatPrice(p.amount / 100, p.currency, locale)}, ${t(STATUS_LABEL[p.status])}`}
            style={({ pressed }) => ({
              padding: spacing.lg,
              gap: 4,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
              backgroundColor: pressed ? colors.raised : "transparent",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={{ ...typography.bodyStrong, color: colors.bright, flex: 1 }} numberOfLines={2}>
                {paymentLabel(t, p, itemName)}
              </Text>
              <Text style={{ ...typography.bodyStrong, color: colors.bright }}>{formatPrice(p.amount / 100, p.currency, locale)}</Text>
            </View>
            {p.recipient ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>{t("moreScreens.payments.gift", { username: p.recipient.username })}</Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {new Date(p.paidAt ?? p.createdAt).toLocaleDateString(locale)}
              </Text>
              <Text style={{ ...typography.caption, ...fw(700), color: STATUS_COLOR[p.status] }}>{t(STATUS_LABEL[p.status])}</Text>
              <View style={{ flex: 1 }} />
              <Icon name="file" size={12} color={colors.muted} />
              <Text style={{ fontSize: 12, fontFamily: "monospace", color: colors.muted }} numberOfLines={1}>
                {p.merchantOid}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </>
  );
}
