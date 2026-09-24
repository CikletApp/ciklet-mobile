import { useEffect } from "react";
import { Keyboard, Platform } from "react-native";
import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Klavyeye göre yer açan kap.
 *
 * Neden `KeyboardAvoidingView` DEĞİL: bu uygulama edge-to-edge modunda
 * çalışıyor (`gradle.properties: edgeToEdgeEnabled=true`, Android 15+
 * varsayılanı). O modda `windowSoftInputMode="adjustResize"` artık pencereyi
 * küçültmüyor; uygulama klavyenin ARKASINA çiziliyor ve mesaj yazma çubuğu
 * klavyenin altında kalıyor. `KeyboardAvoidingView`'ın Android dalı da
 * aynı varsayıma dayandığı için işe yaramıyor.
 *
 * Reanimated'ın `useAnimatedKeyboard()` kancası klavye yüksekliğini UI iş
 * parçacığında verir — JS köprüsünden geçmediği için açılma animasyonuyla
 * kare kare uyumlu ilerler ve yeni bir native bağımlılık gerektirmez.
 *
 * ⚠️ `height` TEK BAŞINA KULLANILAMAZ: ekrandan çıkılıp geri dönüldüğünde
 * son bilinen yükseklik korunuyor ve klavye kapalıyken ekranın altında
 * kocaman bir boşluk kalıyordu (cihaz testinde görüldü). Bu yüzden yalnızca
 * klavye AÇIK/AÇILIYOR durumundayken yükseklik uygulanır; diğer her
 * durumda güvenli alan boşluğuna dönülür.
 *
 * YEDEK: RN'nin `Keyboard` olayları da dinlenir ve iki kaynaktan büyük olan
 * uygulanır. Reanimated 4'te `useAnimatedKeyboard` kullanımdan kalkma
 * sürecinde ve emülatörde yerleşik klavye açıkken hiç yükseklik
 * bildirmediği görüldü (giriş düğmesi klavyenin altında kaldı). Olay
 * yolu bir kare geç gelir ama hiç gelmemesinden iyidir.
 */
export function KeyboardAvoider({
  children,
  /** Alt güvenli alan boşluğu da uygulansın (klavye kapalıyken). */
  applySafeArea = true,
  style,
}: {
  children: React.ReactNode;
  applySafeArea?: boolean;
  style?: Parameters<typeof Animated.View>[0]["style"];
}) {
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  const eventHeight = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      eventHeight.value = withTiming(event.endCoordinates.height, { duration: 160 });
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      eventHeight.value = withTiming(0, { duration: 160 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [eventHeight]);

  const animatedStyle = useAnimatedStyle(() => {
    const base = applySafeArea ? insets.bottom : 0;
    const opening =
      keyboard.state.value === KeyboardState.OPEN ||
      keyboard.state.value === KeyboardState.OPENING;
    const height = Math.max(opening ? keyboard.height.value : 0, eventHeight.value);

    // Klavye yüksekliği zaten gezinme çubuğunu kapsar; ikisini TOPLAMAK
    // klavye açıkken fazladan boşluk bırakır.
    return { paddingBottom: height > 0 ? Math.max(height, base) : base };
  }, [insets.bottom, applySafeArea]);

  return (
    <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
