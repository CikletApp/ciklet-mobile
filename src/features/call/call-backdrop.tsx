import { View } from "react-native";
import { Image } from "expo-image";

import { colors, radii } from "@/theme/tokens";

/**
 * Çağrı ekranının arka planı: karşı tarafın fotoğrafı, ağır bulanık.
 *
 * `expo-blur` yerine `expo-image`'in `blurRadius`'u kullanılıyor. `BlurView`
 * Android'de ya `blurTarget` referansı ister ya da SDK 31 altında sessizce
 * yalnızca yarı saydam bir katmana düşer; ikisi de "iki platformda aynı
 * görünen çağrı ekranı" hedefini bozar. Bulanıklığı görüntünün kendisine
 * uygulamak her yerde aynı sonucu verir.
 *
 * Fotoğraf yoksa marka renginden koyuya inen sakin bir degrade kalır —
 * ekranın düz siyah olmaması, gelen aramanın "canlı" hissettirmesi için
 * yeterli.
 */
export function CallBackdrop({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <View style={{ position: "absolute", inset: 0, backgroundColor: colors.deep }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ flex: 1 }}
          contentFit="cover"
          blurRadius={60}
          // Fotoğraf her karede yeniden çözülmemeli; çağrı ekranı uzun
          // süre açık kalabiliyor.
          cachePolicy="memory-disk"
          transition={220}
          accessible={false}
        />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.panel,
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {/* Fotoğrafsız durumda üstten aşağı sönen marka lekesi. */}
          <View
            style={{
              width: "160%",
              aspectRatio: 1,
              marginTop: "-40%",
              borderRadius: radii.full,
              backgroundColor: colors.bubbleOwn,
              opacity: 0.7,
            }}
          />
        </View>
      )}

      {/* Karartma: fotoğraf ne kadar parlak olursa olsun üstteki beyaz
          metnin okunabilirliği sabit kalmalı. */}
      <View style={{ position: "absolute", inset: 0, backgroundColor: colors.mediaScrim }} />
      <View style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }} />
    </View>
  );
}
