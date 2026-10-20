/**
 * Mentol'ün mağaza içi abonelik ürünleri — sunucudaki liste ile AYNI
 * (ciklet-web src/lib/iap/products.ts). Kimlikler App Store Connect'te
 * "Mentol" abonelik grubunda, Play Console'da abonelik olarak açılır; iki
 * mağazada da aynı. Fiyat mağazadan (yerel para birimi) okunur, burada yok.
 * Plan sunucuda ürün kimliğinden türetilir; buradaki `plan` yalnızca arayüz.
 */
export type IapPlan = "PLUS" | "PRO";
export type IapPeriod = "monthly" | "yearly";

export interface IapProductDef {
  id: string;
  plan: IapPlan;
  period: IapPeriod;
}

export const MENTOL_IAP_PRODUCTS: readonly IapProductDef[] = [
  { id: "mentol_plus_monthly", plan: "PLUS", period: "monthly" },
  { id: "mentol_plus_yearly", plan: "PLUS", period: "yearly" },
  { id: "mentol_pro_monthly", plan: "PRO", period: "monthly" },
  { id: "mentol_pro_yearly", plan: "PRO", period: "yearly" },
];

export const MENTOL_IAP_SKUS = MENTOL_IAP_PRODUCTS.map((product) => product.id);

export function iapProductDef(productId: string | null | undefined): IapProductDef | null {
  return MENTOL_IAP_PRODUCTS.find((product) => product.id === productId) ?? null;
}

export const PLAN_LABEL: Record<IapPlan, string> = { PLUS: "Mentol Plus", PRO: "Mentol Pro" };
export const PERIOD_LABEL: Record<IapPeriod, string> = { monthly: "Aylık", yearly: "Yıllık" };
export const PLAN_RANK: Record<"FREE" | IapPlan, number> = { FREE: 0, PLUS: 1, PRO: 2 };
