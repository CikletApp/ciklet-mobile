type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
import type { parityScreensTr } from "./parity-screens.tr";

/** parity-screens.tr.ts çevirisi. */
export const parityScreensEn = {
} as const satisfies Widen<typeof parityScreensTr>;
