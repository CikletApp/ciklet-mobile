/**
 * Mentol'ün ve Sunucu Takviyesinin mağaza içi abonelik ürünleri.
 *
 * KAYNAK SUNUCU: GET /api/mentol/iap `products` (Mentol) ve `boostProducts`
 * (takviye) listelerini verir (ciklet-web src/lib/iap/products.ts) —
 * doğrulama da aynı listeyi kullandığından istemci ile sunucu ayrışamaz;
 * kimlik değişikliği uygulama sürümü gerektirmez. Aşağıdaki sabitler
 * yalnızca uç yanıt vermeden önceki/yanıt vermezse kullanılan yedek.
 *
 * Kimlikler App Store Connect'te "Mentol" ve "Sunucu Takviyesi" abonelik
 * gruplarında, Play Console'da abonelik olarak açılır; iki mağazada da
 * aynı. Fiyat mağazadan (yerel para birimi) okunur, burada yok. Plan
 * sunucuda ürün kimliğinden türetilir; buradaki `plan` yalnızca arayüz.
 */
import { BOOST_IAP_PRODUCT_ID } from "@/lib/server-boost";

export type IapPlan = "PLUS" | "PRO";
export type IapPeriod = "monthly" | "yearly";

export interface IapProductDef {
  id: string;
  plan: IapPlan;
  period: IapPeriod;
}

const MENTOL_IAP_PRODUCTS: readonly IapProductDef[] = [
  { id: "mentol_plus_monthly", plan: "PLUS", period: "monthly" },
  { id: "mentol_plus_yearly", plan: "PLUS", period: "yearly" },
  { id: "mentol_pro_monthly", plan: "PRO", period: "monthly" },
  { id: "mentol_pro_yearly", plan: "PRO", period: "yearly" },
];

/** Yedek takviye ürünü (web `BOOST_IAP_PRODUCTS`). */
const FALLBACK_BOOST_IDS: readonly string[] = [BOOST_IAP_PRODUCT_ID];

let mentolCatalog: readonly IapProductDef[] = MENTOL_IAP_PRODUCTS;
let boostCatalog: readonly string[] = FALLBACK_BOOST_IDS;

function isPlan(value: unknown): value is IapPlan {
  return value === "PLUS" || value === "PRO";
}

function isPeriod(value: unknown): value is IapPeriod {
  return value === "monthly" || value === "yearly";
}

/**
 * Sunucunun ürün listelerini katalog yapar. Bozuk/boş liste yok sayılır
 * (yedek kalır) — eski sunucu `boostProducts` vermiyordu.
 */
export function applyServerCatalog(info: { products?: unknown; boostProducts?: unknown }): void {
  if (Array.isArray(info.products)) {
    const defs = info.products.filter(
      (item): item is IapProductDef =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as IapProductDef).id === "string" &&
        (item as IapProductDef).id.length > 0 &&
        isPlan((item as IapProductDef).plan) &&
        isPeriod((item as IapProductDef).period),
    );
    if (defs.length > 0) mentolCatalog = defs.map(({ id, plan, period }) => ({ id, plan, period }));
  }
  if (Array.isArray(info.boostProducts)) {
    const ids = info.boostProducts
      .map((item) => (typeof item === "object" && item !== null ? (item as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length > 0) boostCatalog = ids;
  }
}

/** Mağazadan çekilecek Mentol ürün kimlikleri. */
export function mentolSkus(): string[] {
  return mentolCatalog.map((product) => product.id);
}

/** Mağazadan çekilecek takviye ürünü (bir mağaza aboneliği = bir takviye). */
export function boostSku(): string {
  return boostCatalog[0] ?? BOOST_IAP_PRODUCT_ID;
}

export function isBoostSku(productId: string | null | undefined): boolean {
  return Boolean(productId) && boostCatalog.includes(productId as string);
}

export function iapProductDef(productId: string | null | undefined): IapProductDef | null {
  return mentolCatalog.find((product) => product.id === productId) ?? null;
}

export const PLAN_LABEL: Record<IapPlan, string> = { PLUS: "Mentol Plus", PRO: "Mentol Pro" };
export const PERIOD_LABEL: Record<IapPeriod, string> = { monthly: "Aylık", yearly: "Yıllık" };
export const PLAN_RANK: Record<"FREE" | IapPlan, number> = { FREE: 0, PLUS: 1, PRO: 2 };
