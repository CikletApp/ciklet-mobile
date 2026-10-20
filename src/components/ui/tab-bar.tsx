import { useEffect } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDirectUnreadCounts, useFriends, useUnreadServerCount } from "@/api/hooks";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing } from "@/theme/tokens";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";
import { expandTabBar, tabBarCollapse } from "./tab-bar-collapse";
import { fw } from "@/theme/fonts";

/**
 * Yüzen sekme çubuğu.
 *
 * Kenarlardan boşluklu, tamamen yuvarlatılmış bir ada. Etkin sekme, ikon ve
 * etiketi birlikte saran yumuşak bir hapla işaretlenir; yalnızca ince bir
 * çizgi, özellikle açık temada, hangi sekmede olunduğunu yeterince
 * söylemiyordu. Sohbetler sekmesi okunmamış mesaj sayısını rozetle taşır:
 * kullanıcı başka bir sekmedeyken yeni mesajı buradan görür.
 *
 * Listede aşağı ilerlerken çubuk küçülür (daralır, alçalır, etiketler
 * gizlenir) ve ortada-altta durmaya devam eder; geri kaydırınca, tepeye
 * dönünce ya da kaydırma durduktan kısa süre sonra eski boyuna döner.
 * Bkz. `tab-bar-collapse.ts` — her şey UI iş parçacığında.
 */
const ICONS: Record<string, IconName> = {
  index: "message",
  servers: "compass",
  notifications: "bell",
  me: "user",
};

/** Çubuğun yüksekliği: dolgu 5×2 + sekme 58 + kenarlık 1×2. */
const BAR_HEIGHT = 70;

/** Küçülmüş hâl: dolgu 3×2 + sekme 44 (en küçük dokunma hedefi) + kenarlık 1×2 = 52. */
const PAD = 5;
const PAD_SMALL = 3;
const ITEM_HEIGHT = 58;
const ITEM_HEIGHT_SMALL = 44;
/** Küçülünce çubuk her iki yandan ekran genişliğinin bu oranı kadar daralır. */
const SHRINK_RATIO = 0.13;

/**
 * Çubuğun alt kenara uzaklığı. Güvenli alanın tamamı yerine biraz daha
 * aşağıda durur ama ev çizgisinin / hareket çubuğunun üstünde kalır.
 * Android 3 düğmeli gezinmede (geniş alt boşluk) düğmelerin üstüne
 * hiç inmez.
 */
export function tabBarBottomOffset(inset: number) {
  if (inset <= 0) return spacing.xs;
  if (Platform.OS === "android") {
    if (inset >= 40) return inset;
    return Math.max(inset - spacing.sm, spacing.sm);
  }
  return Math.max(inset - 10, spacing.sm);
}

/**
 * Yüzen çubuk mutlak konumlu olduğu için ekranlar için yer AYIRMAZ.
 * Kaydırılabilir içeriğin son öğesi çubuğun altında kalmasın diye
 * listelere bu kadar alt boşluk verilir (çubuk + konumu + payı).
 * Tam boya göre hesaplanır: çubuk alt kenara sabit kalıp yukarıdan
 * küçüldüğü için küçük hâlde de son öğe açıkta kalır, kaydırma sırasında
 * boşluk değişip listeyi oynatmaz.
 */
export function useFloatingTabInset() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + tabBarBottomOffset(insets.bottom) + spacing.sm;
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Her sekmenin kendi listesi var; yeni sekme tam boy çubukla açılır.
  useEffect(() => {
    expandTabBar();
  }, [state.index]);
  const shrink = Math.round(width * SHRINK_RATIO);
  const bar = useAnimatedStyle(() => {
    const p = tabBarCollapse.get();
    return {
      marginHorizontal: p * shrink,
      padding: interpolate(p, [0, 1], [PAD, PAD_SMALL]),
    };
  });
  // Rozet mesaj değil SOHBET sayar: "42" bir sayı yığını, "3 sohbet" bir yapılacak.
  const { chats: unreadChats } = useDirectUnreadCounts();
  // Sunucular da aynı mantıkla: okunmamış mesajı olan SUNUCU sayısı.
  const unreadServers = useUnreadServerCount();
  const { incoming } = useFriends();
  const badges: Record<string, number> = {
    index: unreadChats,
    servers: unreadServers,
    notifications: incoming.length,
  };

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        // Gezinme çubuğunun üstünde dursun; cihazda çubuk yoksa taban boşluk.
        bottom: tabBarBottomOffset(insets.bottom),
      }}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            borderRadius: radii.full,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.bentoBorder,
            backgroundColor: colors.panel,
            boxShadow: `0 8px 30px ${colors.shadow}`,
          },
          bar,
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;

          return (
            <TabItem
              key={route.key}
              label={label}
              icon={ICONS[route.name] ?? "home"}
              /** "Sen" sekmesi ikon değil, kullanıcının avatarını taşır. */
              avatar={route.name === "me"}
              badge={badges[route.name] ?? 0}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  avatar,
  badge,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  avatar?: boolean;
  badge: number;
  focused: boolean;
  onPress: () => void;
}) {
  const me = useAuth((s) => s.profile);
  const t = useT();
  const press = useSharedValue(0);

  const content = useAnimatedStyle(() => ({
    minHeight: interpolate(tabBarCollapse.get(), [0, 1], [ITEM_HEIGHT, ITEM_HEIGHT_SMALL]),
    transform: [{ scale: withSpring(press.value ? 0.94 : 1, { damping: 16 }) }],
  }));

  const iconScale = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(tabBarCollapse.get(), [0, 1], [1, 0.86]) }],
  }));

  // Etiket küçülürken yüksekliği ve boşluğu sıfıra iner, solar. Erişilebilirlik
  // etiketi `Pressable` üzerinde olduğundan ekran okuyucu etkilenmez.
  const labelStyle = useAnimatedStyle(() => {
    const p = tabBarCollapse.get();
    return {
      height: 14 * (1 - p),
      marginTop: 3 * (1 - p),
      opacity: interpolate(p, [0, 0.6], [1, 0], "clamp"),
    };
  });

  const pill = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ scale: withSpring(focused ? 1 : 0.86, { damping: 18 }) }],
  }));

  const tint = focused ? colors.bright : colors.muted;
  const badgeLabel = badge > 99 ? "99+" : String(badge);

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge > 0 ? t("tabs.unread", { label, count: badge }) : label}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = 0;
      }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[{ alignItems: "center", justifyContent: "center" }, content]}>
        {/* Etkin sekmenin hapı — ikon ve etiketi birlikte sarar. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 2,
              right: 2,
              borderRadius: radii.full,
              borderCurve: "continuous",
              backgroundColor: colors.raised,
            },
            pill,
          ]}
        />
        <Animated.View style={iconScale}>
          {avatar ? (
            // Halka rengi seçimden bağımsız: gerçek durum rozeti olarak okunmalı.
            <Avatar
              profileId={me?.id}
              imageUrl={me?.imageUrl}
              fallbackText={me?.username}
              size={24}
              showPresence
              presenceSize={12}
              backgroundColor={colors.panel}
            />
          ) : (
            <Icon name={icon} size={23} color={tint} filled={focused} knockout={colors.raised} />
          )}
          {badge > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -6,
                left: 14,
                minWidth: 19,
                height: 19,
                paddingHorizontal: 5,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.brand,
                borderWidth: 2,
                borderColor: colors.panel,
              }}
            >
              <Text style={{ fontSize: 10, lineHeight: 12, ...fw(800), color: colors.onBrand }}>{badgeLabel}</Text>
            </View>
          ) : null}
        </Animated.View>
        <Animated.View style={[{ overflow: "hidden" }, labelStyle]}>
          <Text
            style={{ fontSize: 11, lineHeight: 14, ...fw(focused ? 700 : 500), color: tint }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
