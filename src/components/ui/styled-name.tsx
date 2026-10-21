import { useEffect, useId, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useNameFontFamily } from "@/lib/name-fonts";
import { nameStylePresentation, type NameStyle } from "@/lib/name-style";
import { useScreenActive } from "@/lib/use-screen-active";
import { useNameStyle } from "@/stores/name-styles";

/**
 * Görünen adı kullanıcının ad stiliyle (yazı tipi + renk efekti) çizer —
 * web `components/styled-name` karşılığı. Çağıranın `<Text>`'inin YERİNE
 * konur: boyut, kalınlık, satır sayısı ve rol rengi `textStyle` /
 * `numberOfLines` ile verilir; stil yoksa aynı `<Text>` olduğu gibi çizilir.
 *
 * Rol rengi önceliği (web ile aynı): renk EFEKTİ seçmiş kullanıcının efekti
 * rol rengini ezer; yalnızca yazı tipi seçmişse `textStyle`'daki renk kalır.
 *
 * Efektler:
 *  - solid / neon: metin rengi (neon: aynı renkte ışıma; `animate`'te nabız);
 *  - gradient / shimmer / rainbow: MaskedView (metin maske) + SVG gradyan;
 *    parıltı ve gökkuşağı `animate`'te kayar.
 * Hareket yalnızca `animate` verilen yerlerde (profil başlığı, önizleme);
 * listelerde durağan. Hareket azaltmada ve ekran arkadayken durur.
 *
 * Stil kaynağı: `style` verilmişse o (önizleme, kart verisi; canlı değer yine
 * üstün), verilmemişse ortak önbellek + toplu sorgu (stores/name-styles).
 */
export interface StyledNameProps {
  profileId?: string;
  name: string;
  /** Bilinen stil (null = stil yok). Verilmezse önbellekten/sorgudan. */
  style?: NameStyle | null;
  /** Önizleme: canlı değeri yok say, yalnızca `style`'ı çiz. */
  preview?: boolean;
  /** Hareketli efektler oynasın mı (listelerde false). */
  animate?: boolean;
  /** false → stil çizilmez ve sorgulanmaz (ör. takma ad gösteriliyor). */
  enabled?: boolean;
  textStyle?: StyleProp<TextStyle>;
  /** Gradyan efektinde metni saran kutunun stili (satır içi yerleşim için). */
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}

export function StyledName({ profileId, name, style, preview, enabled = true, ...rest }: StyledNameProps) {
  const cached = useNameStyle(preview ? undefined : profileId, style, enabled && !preview);
  const effective = preview ? (style ?? null) : cached;
  return <NameStyleText style={effective} name={name} {...rest} />;
}

/** Önbellekten bağımsız saf çizim (önizleme, seçici döşemeleri). */
export function NameStyleText({
  style,
  name,
  animate = false,
  textStyle,
  containerStyle,
  numberOfLines,
  onPress,
}: Omit<StyledNameProps, "profileId" | "preview" | "enabled" | "style"> & { style: NameStyle | null }) {
  const pres = nameStylePresentation(style);
  const family = useNameFontFamily(pres.font?.id);
  const reduceMotion = useReducedMotion();
  const screenActive = useScreenActive();
  const live = animate && !reduceMotion && screenActive && Boolean(pres.effect?.animated);

  if (!pres.font && !pres.effect) {
    return (
      <Text style={textStyle} numberOfLines={numberOfLines} onPress={onPress}>
        {name}
      </Text>
    );
  }

  const flat = StyleSheet.flatten(textStyle) ?? {};
  const override: TextStyle = {};
  if (family) {
    override.fontFamily = family;
    // Android: özel ailede fontWeight sistem fontuna düşürür (bkz. theme/fonts fw).
    override.fontWeight = "normal";
    if (pres.scale !== 1) override.fontSize = Math.round((flat.fontSize ?? 14) * pres.scale * 10) / 10;
  }
  if (pres.color) override.color = pres.color;
  if (pres.effect?.kind === "neon" && pres.color) {
    override.textShadowColor = pres.color;
    override.textShadowRadius = 6;
    override.textShadowOffset = { width: 0, height: 0 };
  } else if (pres.halo && !pres.gradient) {
    override.textShadowColor = pres.halo === "light" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";
    override.textShadowRadius = 2;
    override.textShadowOffset = { width: 0, height: 0 };
  }
  const merged: StyleProp<TextStyle> = [textStyle, override];

  if (pres.gradient) {
    return (
      <GradientName
        name={name}
        textStyle={merged}
        containerStyle={containerStyle}
        numberOfLines={numberOfLines}
        onPress={onPress}
        colors={pres.gradient}
        wide={pres.effect?.kind !== "gradient"}
        loopMs={live ? (pres.effect?.kind === "rainbow" ? 4000 : 3200) : null}
      />
    );
  }

  if (pres.effect?.kind === "neon" && live && pres.color) {
    return (
      <View style={[{ flexShrink: 1, minWidth: 0 }, containerStyle]}>
        <Text style={merged} numberOfLines={numberOfLines} onPress={onPress}>
          {name}
        </Text>
        <NeonPulse name={name} textStyle={merged} color={pres.color} numberOfLines={numberOfLines} />
      </View>
    );
  }

  return (
    <Text style={merged} numberOfLines={numberOfLines} onPress={onPress}>
      {name}
    </Text>
  );
}

/** Neon: metnin üstünde aynı renkte, güçlü ışımalı kopya nefes alır (web `::after`). */
function NeonPulse({
  name,
  textStyle,
  color,
  numberOfLines,
}: {
  name: string;
  textStyle: StyleProp<TextStyle>;
  color: string;
  numberOfLines?: number;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + pulse.get() * 0.6 }));
  return (
    <Animated.Text
      pointerEvents="none"
      numberOfLines={numberOfLines}
      style={[textStyle, { position: "absolute", left: 0, top: 0, right: 0, textShadowColor: color, textShadowRadius: 12 }, style]}
    >
      {name}
    </Animated.Text>
  );
}

/**
 * Gradyanlı ad: metin maske, altında SVG gradyan. Kayan efektte gradyan
 * şeridi iki dönem uzunluğunda (web `background-size: 200%`): bir dönem
 * kaydıkça dikişsiz başa döner. Durağanken ilk dönemin ilk yarısı görünür
 * (web'in hareketsiz karesi).
 */
function GradientName({
  name,
  textStyle,
  containerStyle,
  numberOfLines,
  onPress,
  colors,
  wide,
  loopMs,
}: {
  name: string;
  textStyle: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  onPress?: () => void;
  colors: readonly string[];
  /** Parıltı/gökkuşağı: gradyan dönemi adın iki katı (web `background-size: 200%`). */
  wide: boolean;
  /** Kayma süresi; null → durağan. */
  loopMs: number | null;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  // Kayan şerit iki dönem (dikişsiz döngü); durağanken tek dönem.
  const periods = loopMs ? 2 : 1;
  return (
    <MaskedView
      style={[{ flexShrink: 1, minWidth: 0 }, containerStyle]}
      onLayout={onLayout}
      maskElement={
        <Text style={[textStyle, { color: "#000", textShadowRadius: 0 }]} numberOfLines={numberOfLines}>
          {name}
        </Text>
      }
    >
      <Text style={[textStyle, { opacity: 0 }]} numberOfLines={numberOfLines} onPress={onPress}>
        {name}
      </Text>
      {width > 0 ? (
        <GradientStrip colors={colors} period={wide ? width * 2 : width} periods={periods} loopMs={loopMs} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]} pointerEvents="none" />
      )}
    </MaskedView>
  );
}

function GradientStrip({
  colors,
  period,
  periods,
  loopMs,
}: {
  colors: readonly string[];
  /** Bir gradyan döneminin genişliği (px). */
  period: number;
  periods: number;
  loopMs: number | null;
}) {
  const gradientId = `ns-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const shift = useSharedValue(0);
  useEffect(() => {
    if (!loopMs) {
      cancelAnimation(shift);
      shift.set(0);
      return;
    }
    shift.set(0);
    shift.set(withRepeat(withTiming(1, { duration: loopMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(shift);
  }, [loopMs, shift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -shift.get() * period }] }));

  // Duraklar dönem başına eşit aralıklı; şeritte dönem sayısı kadar tekrar.
  const stops: { offset: number; color: string }[] = [];
  for (let p = 0; p < periods; p++) {
    colors.forEach((color, i) => {
      const local = colors.length === 1 ? 0 : i / (colors.length - 1);
      stops.push({ offset: (p + local) / periods, color });
    });
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0, bottom: 0, width: period * periods }, style]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {stops.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={stop.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}
