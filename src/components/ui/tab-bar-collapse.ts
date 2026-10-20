import {
  cancelAnimation,
  makeMutable,
  ReduceMotion,
  useAnimatedScrollHandler,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

/**
 * Sekme çubuğunun kaydırmayla küçülmesi (Instagram düzeni).
 *
 * Sekme ekranlarının ana listeleri kaydırmayı buraya yazar, yüzen çubuk
 * buradan okur. Değer modül düzeyinde tek bir paylaşımlı değerdir: çubuk
 * ve listeler farklı ağaç dallarında yaşar, ama ekranda aynı anda yalnızca
 * bir çubuk vardır. Her şey UI iş parçacığında olur; kaydırma karesi başına
 * React yeniden çizimi yoktur.
 *
 * `tabBarCollapse` 0 = tam boy, 1 = küçük. Parmağı 1:1 izlemez (çubuğun
 * boyu değişirken titrerdi); eşik aşılınca kısa bir animasyonla oturur.
 * Azaltılmış hareket açıkken `withTiming` kök `ReducedMotionConfig`'e
 * uyar ve geçiş anlık olur.
 */
export const tabBarCollapse = makeMutable(0);
/**
 * Son istenen hedef. Değer animasyon ortasında 0 ile 1 arasında olduğundan
 * karşılaştırma hedefle yapılır; yoksa her karede animasyon yeniden başlar.
 */
const target = makeMutable(0);

const DURATION = 200;
/** Yön değiştirdikten sonra bu kadar kaydırmadan durum değişmez (titreme önler). */
const THRESHOLD = 12;
/** Tepeye bu kadar yakınken çubuk hep tam boy. */
const TOP_ZONE = 24;
/** Bundan kısa listelerde küçülme yok: kaydıracak yer yok sayılır. */
const MIN_SCROLLABLE = 80;
/** Kaydırma durduktan bu kadar sonra çubuk kendiliğinden büyür. */
const IDLE_RESTORE_MS = 1600;

function animateTo(next: 0 | 1) {
  "worklet";
  if (target.get() === next && tabBarCollapse.get() === next) return;
  target.set(next);
  tabBarCollapse.set(withTiming(next, { duration: DURATION, reduceMotion: ReduceMotion.System }));
}

/** Çubuğu tam boya döndürür (sekme değişimi, yeni liste). */
export function expandTabBar() {
  animateTo(0);
}

/**
 * Sekme ekranının ana listesine verilecek kaydırma işleyicisi. Liste
 * `Animated.FlatList` / `Animated.ScrollView` olmalı. Programla yapılan
 * kaydırmalar (veri değişince yeniden yerleşim) sayılmaz — yalnızca
 * sürükleme ve onun ataleti.
 */
export function useTabBarScrollHandler() {
  const lastY = useSharedValue(0);
  const travel = useSharedValue(0);
  const userScroll = useSharedValue(false);

  const scheduleRestore = () => {
    "worklet";
    if (target.get() === 0) return;
    target.set(0);
    // Gecikme her zaman beklenir (Never); büyüme animasyonu ise sisteme uyar.
    tabBarCollapse.set(
      withDelay(
        IDLE_RESTORE_MS,
        withTiming(0, { duration: DURATION, reduceMotion: ReduceMotion.System }),
        ReduceMotion.Never
      )
    );
  };

  return useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      // Bekleyen kendiliğinden büyümeyi iptal et; çubuk yakın olduğu uca oturur.
      cancelAnimation(tabBarCollapse);
      target.set(-1);
      animateTo(tabBarCollapse.get() >= 0.5 ? 1 : 0);
      userScroll.set(true);
      lastY.set(event.contentOffset.y);
      travel.set(0);
    },
    onEndDrag: (event) => {
      // Atalet yoksa sürükleme burada biter.
      if (!event.velocity || Math.abs(event.velocity.y) < 0.01) {
        userScroll.set(false);
        scheduleRestore();
      }
    },
    onMomentumBegin: () => {
      userScroll.set(true);
    },
    onMomentumEnd: () => {
      userScroll.set(false);
      scheduleRestore();
    },
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const dy = y - lastY.get();
      lastY.set(y);
      // Tepede (iOS'ta eksiye esneme dahil) ve kısa listelerde hep tam boy.
      const maxY = event.contentSize.height - event.layoutMeasurement.height;
      if (y <= TOP_ZONE || maxY < MIN_SCROLLABLE) {
        if (target.get() !== 0) animateTo(0);
        return;
      }
      // Dipteki esneme ve programla kaydırma yok sayılır.
      if (y >= maxY - 1 || !userScroll.get()) return;
      const previous = travel.get();
      const next = (Math.sign(dy) === Math.sign(previous) ? previous : 0) + dy;
      travel.set(next);
      if (next > THRESHOLD) {
        if (target.get() !== 1) animateTo(1);
      } else if (next < -THRESHOLD) {
        if (target.get() !== 0) animateTo(0);
      }
    },
  });
}
