/**
 * Geriye dönük uyumluluk kabuğu.
 *
 * Renkler artık `theme/tokens.ts` içinde, ciklet-web'in `theme.css`
 * paletiyle birebir tanımlı. Yeni kod doğrudan `@/theme/tokens`'tan
 * içe aktarmalı; bu dosya yalnızca eski `colors.mainBg` gibi
 * kullanımların derlenmesini sürdürmek için var ve Faz 2'de kaldırılacak.
 */
import { colors as palette } from "./tokens";

export const colors = {
  mainBg: palette.bg,
  surface: palette.panel,
  surface2: palette.raised,
  brand: palette.brand,
  textPrimary: palette.bright,
  textMuted: palette.muted,
  danger: palette.danger,
  online: palette.online,
} as const;

export { colors as palette } from "./tokens";
