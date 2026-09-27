import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

/** Bu kadar çekilirse ya da bu hızla bırakılırsa kapanır (dp, dp/sn). */
const DISTANCE = 64;
const VELOCITY = 800;

/**
 * Aşağı çekerek kapatma — emoji/GIF paneli ve tepki seçici sayfası.
 *
 * Hareket yalnızca panelin TEPESİNE bağlanır (tutamaç ve kategori çubuğu);
 * emoji listesinin üstüne bağlansaydı listeyi yukarı kaydırmak için parmağı
 * aşağı çeken kullanıcı paneli kapatırdı. Aşağı doğru 10 dp'den önce
 * yukarı ya da yana kayarsa hareket düşer; dokunuşlar (kategori seçmek)
 * geçer. Çekerken içerik parmağı izler, eşik aşılmazsa yerine yaylanır.
 *
 * Bir hareket nesnesi tek bir GestureDetector'a bağlanabildiği için iki
 * ayrı nesne döner: `grab` tutamaç için, `header` kategori çubuğu için.
 */
export function useDragToDismiss(onDismiss: () => void) {
  const offset = useSharedValue(0);

  const gestures = useMemo(() => {
    const make = () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetY(10)
        .failOffsetY(-10)
        .failOffsetX([-24, 24])
        .onUpdate((event) => {
          offset.set(Math.max(0, event.translationY));
        })
        .onEnd((event) => {
          if (event.translationY > DISTANCE || event.velocityY > VELOCITY) {
            onDismiss();
            return;
          }
          offset.set(withSpring(0, { damping: 20, stiffness: 260 }));
        })
        .onFinalize((_event, success) => {
          if (!success) offset.set(withSpring(0, { damping: 20, stiffness: 260 }));
        });
    return { grab: make(), header: make() };
  }, [offset, onDismiss]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return { ...gestures, style };
}
