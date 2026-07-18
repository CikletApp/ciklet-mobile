/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ciklet-web koyu temasından taşınan çekirdek token'lar.
      // Web'in tailwind.config'i CSS değişkeni kullanır; mobilde somut değer
      // tutuyoruz — palet değişirse iki taraf birlikte güncellenir.
      colors: {
        "main-bg": "#111214",
        "surface": "#1e1f22",
        "surface-2": "#2b2d31",
        "brand": "#d3be01",
        "text-primary": "#f2f3f5",
        "text-muted": "#949ba4",
        "danger": "#f23f43",
        "online": "#23a559",
      },
    },
  },
  plugins: [],
};
