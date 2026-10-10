import { useCallback, useEffect, type ReactNode } from "react";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Seçici panelinde kaydırınca gizlenen çerçeve (Telegram düzeni): aşağı
 * kaydırınca üstteki arama/kategori satırı ve alttaki sekme hapı çekilir,
 * yukarı kaydırınca geri gelir. `progress` 0 = görünür, 1 = gizli.
 *
 * Parmağı 1:1 izlemiyor, eşik aşılınca kısa bir animasyonla yerine oturuyor:
 * üst satır YÜKSEKLİĞİ küçülüyor, 1:1 izleseydi liste iki kat hızla kayar ve
 * kaydırma olaylarını geri besleyebilirdi. Programla yapılan kaydırmalar
 * (kategoriye atlama, veri değişince yeniden yerleşim) sayılmaz — yalnızca
 * sürükleme ve onun ataleti.
 */

const DURATION = 180;
/** Yön değiştirdikten sonra bu kadar kaydırmadan durum değişmez (titreme önler). */
const THRESHOLD = 24;
/** Bundan kısa listelerde gizleme yok: gizlemek listeyi büyütür, döngüye girer. */
const MIN_SCROLLABLE = 120;

export function useCollapsingChrome(enabled: boolean) {
  const progress = useSharedValue(0);
  const lastY = useSharedValue(0);
  const travel = useSharedValue(0);
  const userScroll = useSharedValue(false);

  const scrollHandler = useAnimatedScrollHandler(
    {
      onBeginDrag: (event) => {
        userScroll.set(true);
        lastY.set(event.contentOffset.y);
        travel.set(0);
      },
      onEndDrag: (event) => {
        // Atalet yoksa sürükleme burada biter; sonraki programlı kaydırma sayılmasın.
        if (!event.velocity || Math.abs(event.velocity.y) < 0.01) userScroll.set(false);
      },
      onMomentumBegin: () => {
        userScroll.set(true);
      },
      onMomentumEnd: () => {
        userScroll.set(false);
      },
      onScroll: (event) => {
        const show = () => {
          if (progress.get() !== 0) progress.set(withTiming(0, { duration: DURATION }));
        };
        const y = event.contentOffset.y;
        const dy = y - lastY.get();
        lastY.set(y);
        // Tepede (iOS'ta eksiye esneme dahil) her zaman görünür.
        if (!enabled || y <= 8) return show();
        const maxY = event.contentSize.height - event.layoutMeasurement.height;
        if (maxY < MIN_SCROLLABLE) return show();
        // Dipteki esneme ve programla kaydırma yok sayılır.
        if (y >= maxY - 1 || !userScroll.get()) return;
        const previous = travel.get();
        const next = (Math.sign(dy) === Math.sign(previous) ? previous : 0) + dy;
        travel.set(next);
        if (next > THRESHOLD) {
          if (progress.get() !== 1) progress.set(withTiming(1, { duration: DURATION }));
        } else if (next < -THRESHOLD) {
          show();
        }
      },
    },
    [enabled]
  );

  /** Yeni liste (sekme, arama, mod) tepeden başlar: çerçeve görünür olmalı. */
  const reset = useCallback(() => {
    progress.set(withTiming(0, { duration: DURATION }));
    lastY.set(0);
    travel.set(0);
    userScroll.set(false);
  }, [progress, lastY, travel, userScroll]);

  useEffect(() => {
    if (!enabled) progress.set(0);
  }, [enabled, progress]);

  return { progress, scrollHandler, reset };
}

export type CollapsingChrome = ReturnType<typeof useCollapsingChrome>;

/**
 * Üst satırı saran katman: doğal yüksekliğini ölçer, gizlenirken yüksekliği
 * sıfıra iner ve içerik yukarı kayıp solar. `progress` yoksa (tepki seçici)
 * içerik olduğu gibi çizilir.
 */
export function CollapsibleHeader({ progress, children }: { progress?: SharedValue<number>; children: ReactNode }) {
  if (!progress) return <>{children}</>;
  return <Collapsible progress={progress}>{children}</Collapsible>;
}

function Collapsible({ progress, children }: { progress: SharedValue<number>; children: ReactNode }) {
  const measured = useSharedValue(0);

  const outer = useAnimatedStyle(() => {
    const height = measured.get();
    return height > 0 ? { height: height * (1 - progress.get()) } : { height: "auto" as const };
  });
  const inner = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateY: -measured.get() * progress.get() }],
  }));

  // Ölçü yalnızca çerçeve tam açıkken (ya da içerik büyüyünce) alınır:
  // kapanırken iç katman küçülürse ölçü sıfıra iner, stil `{}` döner ve
  // son yazılan `height: 0` takılı kalırdı — satır bir daha açılmıyordu.
  const onLayout = (height: number) => {
    if (height <= 0) return;
    if (progress.get() === 0 || height > measured.get()) measured.set(height);
  };

  return (
    <Animated.View style={[{ overflow: "hidden" }, outer]}>
      <Animated.View onLayout={(event) => onLayout(event.nativeEvent.layout.height)} style={[{ flexShrink: 0 }, inner]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
