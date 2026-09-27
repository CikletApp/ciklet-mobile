import { useState } from "react";
import { Modal, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Button, Pressable } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Renk seçici — web'deki `<input type="color">`un mobil karşılığı.
 *
 * React Native'de yerleşik renk seçici yok; kare (doygunluk × parlaklık) ve
 * ton şeridi burada çiziliyor. Seçim "Uygula"ya kadar yalnızca önizlemede
 * kalır: her sürüklemede temayı değiştirmek bütün gezinme ağacını yeniden
 * kurar ve kasardı.
 *
 * Çağıran yalnızca açıkken bağlar: her açılış mevcut renkten taze başlar.
 */

const HEX = /^#[0-9a-f]{6}$/i;
const HUE_STOPS = ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"];
const THUMB = 26;

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function hexToHsv(hex: string): Hsv {
  const value = HEX.test(hex) ? hex : "#000000";
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const channel = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function ColorPickerSheet({
  visible,
  title,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onApply: (color: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [draft, setDraft] = useState<string | null>(null);
  const [panel, setPanel] = useState({ width: 0, height: 0 });
  const [hueWidth, setHueWidth] = useState(0);

  const hex = hsvToHex(hsv);
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const pickSv = (x: number, y: number) => {
    if (!panel.width || !panel.height) return;
    setDraft(null);
    setHsv((current) => ({ ...current, s: clamp(x / panel.width), v: 1 - clamp(y / panel.height) }));
  };
  const pickHue = (x: number) => {
    if (!hueWidth) return;
    setDraft(null);
    setHsv((current) => ({ ...current, h: clamp(x / hueWidth) * 359.9 }));
  };

  // minDistance(0): dokunmak da seçer, sürüklemek de.
  const svGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => pickSv(event.x, event.y))
    .onUpdate((event) => pickSv(event.x, event.y));
  const hueGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) => pickHue(event.x))
    .onUpdate((event) => pickHue(event.x));

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* Modal ayrı bir pencere; jestler kendi kök sarmalayıcısını istiyor. */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          noHitSlop
          accessibilityLabel="Kapat"
          onPress={onClose}
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.lg,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Text style={{ ...typography.title, color: colors.bright, flex: 1 }}>{title}</Text>
            {/* Eski → yeni; ne değiştiğini dokunmadan görmek için. */}
            <View style={{ flexDirection: "row", borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 36, height: 30, backgroundColor: value }} />
              <View style={{ width: 36, height: 30, backgroundColor: hex }} />
            </View>
          </View>

          <GestureDetector gesture={svGesture}>
            <View
              onLayout={(event: LayoutChangeEvent) => setPanel(event.nativeEvent.layout)}
              style={{ height: 200, borderRadius: radii.lg, overflow: "hidden", backgroundColor: hueColor }}
              accessibilityLabel="Doygunluk ve parlaklık"
            >
              <Svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                <Defs>
                  <LinearGradient id="saturation" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                    <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id="value" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#saturation)" />
                <Rect width="100%" height="100%" fill="url(#value)" />
              </Svg>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: hsv.s * panel.width - THUMB / 2,
                  top: (1 - hsv.v) * panel.height - THUMB / 2,
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  borderWidth: 3,
                  borderColor: "#ffffff",
                  backgroundColor: hex,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                }}
              />
            </View>
          </GestureDetector>

          <GestureDetector gesture={hueGesture}>
            <View
              onLayout={(event: LayoutChangeEvent) => setHueWidth(event.nativeEvent.layout.width)}
              style={{ height: 28, justifyContent: "center" }}
              accessibilityLabel="Ton"
            >
              <View style={{ height: 16, borderRadius: radii.full, overflow: "hidden" }}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                      {HUE_STOPS.map((stop, index) => (
                        <Stop key={index} offset={index / (HUE_STOPS.length - 1)} stopColor={stop} />
                      ))}
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#hue)" />
                </Svg>
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: (hsv.h / 360) * hueWidth - THUMB / 2,
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  borderWidth: 3,
                  borderColor: "#ffffff",
                  backgroundColor: hueColor,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                }}
              />
            </View>
          </GestureDetector>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <TextInput
              value={draft ?? hex}
              maxLength={7}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="HEX rengi"
              onChangeText={(next) => {
                const normalized = next.startsWith("#") ? next : `#${next}`;
                setDraft(normalized);
                if (HEX.test(normalized)) setHsv(hexToHsv(normalized.toLowerCase()));
              }}
              onBlur={() => setDraft(null)}
              style={{
                width: 110,
                height: 44,
                paddingHorizontal: spacing.sm,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: draft !== null && !HEX.test(draft) ? colors.danger : colors.border,
                backgroundColor: colors.deep,
                color: colors.bright,
                fontFamily: "monospace",
                fontSize: 14,
                textAlign: "center",
              }}
            />
            <View style={{ flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
              <Button label="Vazgeç" variant="secondary" onPress={onClose} />
              <Button
                label="Uygula"
                onPress={() => {
                  onApply(hex);
                  onClose();
                }}
              />
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
