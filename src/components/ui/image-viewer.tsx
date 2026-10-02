import { useState } from "react";
import { ActivityIndicator, Modal, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import type { AttachmentInfo } from "@/lib/attachments";
import { downloadAttachment } from "@/lib/downloads";
import { spacing } from "@/theme/tokens";
import { IconButton } from "./button";
import { ToastHost, showToast } from "./toast";

/**
 * Tam ekran görsel — web'deki `imageModal`'ın mobil karşılığı.
 *
 * TEK örnek, kökte barındırılır (`ImageViewerHost`): eskiden her görsel
 * mesajı kendi `Modal`'ını taşıyordu; ters çevrilmiş listede satır
 * sanallaştırmayla sökülünce açık görüntüleyici de yok oluyor ya da hiç
 * açılmıyordu. Görüntüleyici artık `openImageViewer(url)` ile açılır.
 *
 * Hareketler: iki parmakla yaklaştır (1×–6×), yaklaşmışken sürükle, çift
 * dokun (2,5× ↔ 1×), tek dokun ya da aşağı/yukarı çek → kapat. Hareketler
 * UI iş parçacığında (Reanimated worklet); kapanış JS'e `runOnJS` ile iner.
 */

interface ViewerTarget {
  url: string;
  info: AttachmentInfo | null;
}

const useViewer = create<{ current: ViewerTarget | null }>(() => ({ current: null }));

export function openImageViewer(url: string, info: AttachmentInfo | null = null) {
  useViewer.setState({ current: { url, info } });
}

export function closeImageViewer() {
  useViewer.setState({ current: null });
}

/** Kök düzende bir kez. */
export function ImageViewerHost() {
  const current = useViewer((state) => state.current);
  if (!current) return null;
  return <ImageViewerModal key={current.url} url={current.url} info={current.info} onClose={closeImageViewer} />;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;
/** Bu kadar çekilince ya da bu hızla bırakılınca kapanır. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 1200;

function ImageViewerModal({ url, info, onClose }: ViewerTarget & { onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  /** Yaklaşmamışken dikey çekiş — kapatma jesti. */
  const dismissY = useSharedValue(0);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await downloadAttachment({ url, name: info?.name, mimeType: info?.type });
      if (result === "downloads") showToast("İndirilenler › Ciklet klasörüne kaydedildi");
      else if (result === "folder") showToast("İndirildi");
    } catch {
      showToast("İndirilemedi. Bağlantını kontrol edip tekrar dene.", "error");
    } finally {
      setBusy(false);
    }
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        return;
      }
      savedScale.value = scale.value;
      // Yaklaşırken kenardan taşan kısım geri çekilir.
      const maxX = (width * scale.value - width) / 2;
      const maxY = (height * scale.value - height) / 2;
      tx.value = withSpring(Math.min(maxX, Math.max(-maxX, tx.value)));
      ty.value = withSpring(Math.min(maxY, Math.max(-maxY, ty.value)));
      savedTx.value = Math.min(maxX, Math.max(-maxX, tx.value));
      savedTy.value = Math.min(maxY, Math.max(-maxY, ty.value));
    });

  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((event) => {
      if (savedScale.value > 1) {
        const maxX = (width * savedScale.value - width) / 2;
        const maxY = (height * savedScale.value - height) / 2;
        tx.value = Math.min(maxX, Math.max(-maxX, savedTx.value + event.translationX));
        ty.value = Math.min(maxY, Math.max(-maxY, savedTy.value + event.translationY));
        return;
      }
      dismissY.value = event.translationY;
    })
    .onEnd((event) => {
      if (savedScale.value > 1) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
        return;
      }
      if (Math.abs(event.translationY) > DISMISS_DISTANCE || Math.abs(event.velocityY) > DISMISS_VELOCITY) {
        dismissY.value = withTiming(event.translationY > 0 ? height : -height, { duration: 160 });
        runOnJS(onClose)();
        return;
      }
      dismissY.value = withSpring(0);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((event) => {
      if (savedScale.value > 1) {
        scale.value = withSpring(1);
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
        return;
      }
      // Dokunulan nokta merkeze alınarak yaklaşılır.
      const next = DOUBLE_TAP_SCALE;
      const maxX = (width * next - width) / 2;
      const maxY = (height * next - height) / 2;
      const x = Math.min(maxX, Math.max(-maxX, -(event.x - width / 2) * (next - 1)));
      const y = Math.min(maxY, Math.max(-maxY, -(event.y - height / 2) * (next - 1)));
      scale.value = withSpring(next);
      tx.value = withSpring(x);
      ty.value = withSpring(y);
      savedScale.value = next;
      savedTx.value = x;
      savedTy.value = y;
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onClose)();
    });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value + dismissY.value }, { scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.9, (Math.abs(dismissY.value) / height) * 1.6),
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* Modal ayrı bir pencere: Android'de hareketler için kendi kökü gerekir. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: "#000" }, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ flex: 1 }, imageStyle]}>
            <Image
              source={{ uri: url }}
              contentFit="contain"
              transition={120}
              onLoadEnd={() => setLoaded(true)}
              style={{ flex: 1 }}
              accessibilityLabel={info?.name ?? "Görsel"}
            />
          </Animated.View>
        </GestureDetector>

        {!loaded ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}

        <View
          style={{
            position: "absolute",
            top: insets.top + spacing.sm,
            right: spacing.md,
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          {busy ? (
            <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : (
            <IconButton icon="download" label="İndir" onPress={() => void download()} background="rgba(0,0,0,0.5)" tint="#ffffff" />
          )}
          <IconButton icon="close" label="Kapat" onPress={onClose} background="rgba(0,0,0,0.5)" tint="#ffffff" />
        </View>
        {/* Modal ayrı bir pencere; kökteki bildirim şeridi arkasında kalırdı. */}
        <ToastHost />
      </GestureHandlerRootView>
    </Modal>
  );
}
