import Animated, {
  KeyboardState,
  useAnimatedKeyboard,
  useAnimatedStyle,
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

  const animatedStyle = useAnimatedStyle(() => {
    const base = applySafeArea ? insets.bottom : 0;
    const opening =
      keyboard.state.value === KeyboardState.OPEN ||
      keyboard.state.value === KeyboardState.OPENING;

    // Klavye yüksekliği zaten gezinme çubuğunu kapsar; ikisini TOPLAMAK
    // klavye açıkken fazladan boşluk bırakır.
    return { paddingBottom: opening ? Math.max(keyboard.height.value, base) : base };
  }, [insets.bottom, applySafeArea]);

  return (
    <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
