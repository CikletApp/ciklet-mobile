import { useEffect, useState, type ReactNode } from "react";
import { AppState, Modal, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { SlideInDown } from "react-native-reanimated";
import { FullWindowOverlay } from "react-native-screens";

/**
 * Çağrı ekranlarının (zil, bekleme, bağlanıyor, görüşme sahnesi) tam ekran
 * yüzeyi.
 *
 * Android: RN `Modal` (ayrı Dialog penceresi) — orada test edildi, aynen.
 *
 * iOS: `FullWindowOverlay` — içerik pencereye doğrudan alt görünüm olarak
 * eklenir, UIKit SUNUMU (`presentViewController`) YOK. RN'in iOS Modal'ı
 * (RCTModalHostViewComponentView) sunmadan önce `_isPresented = YES` der,
 * sunumun gerçekten olup olmadığına bakmaz ve hiç yeniden denemez. Kök
 * denetleyici o an başka bir sunum/kapanış geçişindeyse (bir çağrı modalı
 * kapanırken yenisi açılıyor) ya da uygulama arka plandayken (CallKit ekranı
 * öndeyken) sunum UIKit'te sessizce düşer: RN modalı açık sanır, ekranda
 * boş bir katman ya da hiçbir şey kalmaz, uygulama dokunulmaz olur. Pencere
 * alt görünümünde geçiş ve sunum zinciri olmadığı için bu yarış yok; arka
 * planda takılan katman ön plana gelince olduğu gibi görünür.
 */
export function CallSurface({
  visible = true,
  onRequestClose,
  children,
}: {
  visible?: boolean;
  /** Android geri tuşu (iOS'ta geri tuşu yok). */
  onRequestClose: () => void;
  children: ReactNode;
}) {
  if (Platform.OS === "ios") {
    return visible ? <IosCallSurface>{children}</IosCallSurface> : null;
  }
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

/**
 * Açık iOS çağrı yüzeyi sayısı ve sonuncusunun kapandığı an: durum
 * geçişinde (zil → bağlanıyor → sahne) yeni yüzey eskisi henüz takılıyken
 * çizilir; o geçiş yeniden kaymasın.
 */
let mountedSurfaces = 0;
let lastSurfaceUnmountAt = 0;
const SWAP_WINDOW_MS = 600;

function IosCallSurface({ children }: { children: ReactNode }) {
  // Modal'daki kayarak açılış yalnızca uygulama öndeyken: arka planda
  // (CallKit'ten kabul) ekran çizilmediği için animasyon anlamsız, katman
  // ön plana gelindiğinde yerinde hazır olmalı. Bir yüzey kapanır kapanmaz
  // diğeri açılıyorsa bu aynı görüşmenin durum geçişidir; o da kaymaz.
  const [animate] = useState(
    () =>
      AppState.currentState === "active" &&
      mountedSurfaces === 0 &&
      Date.now() - lastSurfaceUnmountAt > SWAP_WINDOW_MS
  );
  useEffect(() => {
    mountedSurfaces += 1;
    return () => {
      mountedSurfaces -= 1;
      lastSurfaceUnmountAt = Date.now();
    };
  }, []);
  return (
    <FullWindowOverlay>
      {/* Pencereye eklenen katman kök GestureHandlerRootView'ın dışında;
          görüntülü sahnedeki sürüklenebilir küçük görüntü için kendi kökü. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View entering={animate ? SlideInDown.duration(280) : undefined} style={{ flex: 1 }}>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </FullWindowOverlay>
  );
}
