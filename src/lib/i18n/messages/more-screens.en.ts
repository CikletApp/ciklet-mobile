type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
import type { moreScreensTr } from "./more-screens.tr";

/** more-screens.tr.ts çevirisi. */
export const moreScreensEn = {
} as const satisfies Widen<typeof moreScreensTr>;
