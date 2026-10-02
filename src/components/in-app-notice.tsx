import { Text, View } from "react-native";
import Animated, { FadeOutUp, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { Avatar, Icon, Pressable } from "@/components/ui";
import { fw } from "@/theme/fonts";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Uygulama içi bildirim kartı — web'deki köşe kartının (realtime-provider
 * `showCustomToast`) mobil karşılığı.
 *
 * Uygulama ÖN PLANDAYKEN sistem bildirimi bastırılıyor (lib/notifications);
 * başka bir ekranda gezinen kullanıcı yeni DM'den ya da etiketlenmeden hiç
 * haberdar olmuyordu. Kart ekranın üstünde belirir, dokununca sohbete gider,
 * çarpıyla ya da 5 sn sonra kaybolur. Açık sohbetin mesajı için gösterilmez
 * (bkz. stores/active-chat).
 */

export interface InAppNotice {
  id: number;
  title: string;
  body: string;
  imageUrl?: string | null;
  /** Avatar yedeği (baş harf) için ad. */
  fallbackText?: string;
  /** Görsel de ad da yoksa çizilecek simge. */
  icon?: "message" | "users" | "bell";
  onPress?: () => void;
}

const useNotices = create<{ current: InAppNotice | null }>(() => ({ current: null }));

let counter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const AUTO_HIDE_MS = 5_000;

export function showInAppNotice(notice: Omit<InAppNotice, "id">) {
  counter += 1;
  useNotices.setState({ current: { ...notice, id: counter } });
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(dismissInAppNotice, AUTO_HIDE_MS);
}

export function dismissInAppNotice() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  useNotices.setState({ current: null });
}

/** Kök düzende bir kez. */
export function InAppNoticeHost() {
  const notice = useNotices((state) => state.current);
  const insets = useSafeAreaInsets();
  if (!notice) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, top: insets.top + spacing.sm, alignItems: "center" }}
    >
      <Animated.View key={notice.id} entering={SlideInUp.duration(220)} exiting={FadeOutUp.duration(160)}>
        <Pressable
          noHitSlop
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={`${notice.title}: ${notice.body}`}
          accessibilityHint="Açmak için dokun"
          onPress={() => {
            dismissInAppNotice();
            notice.onPress?.();
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            width: 360,
            maxWidth: "94%",
            paddingVertical: spacing.md,
            paddingLeft: spacing.md,
            paddingRight: spacing.sm,
            borderRadius: radii.xl,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: pressed ? colors.raised : colors.panel,
            boxShadow: `0 12px 32px ${colors.shadow}`,
          })}
        >
          {notice.imageUrl || notice.fallbackText ? (
            <Avatar imageUrl={notice.imageUrl} fallbackText={notice.fallbackText ?? notice.title} size={40} />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.brandSoft,
              }}
            >
              <Icon name={notice.icon ?? "bell"} size={20} color={colors.brand} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text numberOfLines={1} style={{ ...typography.bodyStrong, ...fw(700), color: colors.bright }}>
              {notice.title}
            </Text>
            <Text numberOfLines={2} style={{ ...typography.caption, color: colors.text }}>
              {notice.body}
            </Text>
          </View>
          <Pressable
            onPress={dismissInAppNotice}
            accessibilityRole="button"
            accessibilityLabel="Bildirimi kapat"
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.full,
              backgroundColor: pressed ? colors.border : "transparent",
            })}
          >
            <Icon name="close" size={16} color={colors.muted} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}
