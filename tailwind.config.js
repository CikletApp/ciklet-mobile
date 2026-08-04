/** @type {import('tailwindcss').Config} */

/**
 * Renkler ciklet-web'in `src/app/theme.css` dosyasındaki "Gece" temasıyla
 * BİREBİR aynı HSL bileşenlerinden gelir; `src/theme/tokens.ts` ile ikiz
 * tutulmalıdır (biri değişirse diğeri de).
 *
 * React Native `hsl(h, s%, l%)` biçimini doğrudan ayrıştırır — virgüllü
 * yazım bilinçli, boşluklu modern CSS sözdizimi RN'de çalışmaz.
 */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Marka (tüm temalarda sabit)
        brand: "#98cb00",
        "brand-secondary": "#45f3ff",

        // Yüzeyler
        bg: "hsl(225, 8%, 9%)",
        deep: "hsl(228, 10%, 6%)",
        panel: "hsl(225, 6%, 13%)",
        raised: "hsl(225, 6%, 17%)",
        border: "hsl(225, 6%, 17%)",

        // Metin
        bright: "hsl(0, 0%, 98%)",
        text: "hsl(210, 9%, 82%)",
        muted: "hsl(210, 8%, 58%)",

        // Anlamsal
        danger: "hsl(0, 78%, 60%)",
        success: "hsl(145, 62%, 42%)",
        warning: "hsl(40, 86%, 57%)",

        // Presence
        online: "hsl(145, 62%, 42%)",
        idle: "hsl(40, 86%, 57%)",
        dnd: "hsl(0, 78%, 60%)",
        offline: "hsl(210, 8%, 45%)",
      },
    },
  },
  plugins: [],
};
