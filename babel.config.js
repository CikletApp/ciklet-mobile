module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind kaldırıldı: kod tabanında tek bir `className` yoktu ama
    // `jsxImportSource: "nativewind"` HER JSX çağrısını kendi runtime'ıyla
    // sarmalıyordu ve `style={({pressed}) => ...}` biçimindeki fonksiyon
    // stillerini düşürüyordu — düğmeler arka planı ve hizası olmadan
    // çiziliyordu. Stil katmanı `theme/tokens.ts` üzerinden düz nesnelerle
    // yürüyor.
    presets: ["babel-preset-expo"],
  };
};
