import { Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDirectUnreadCounts } from "@/api/hooks";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing } from "@/theme/tokens";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";

/**
 * Yüzen sekme çubuğu.
 *
 * Kenarlardan boşluklu, tamamen yuvarlatılmış bir ada. Etkin sekme, ikon ve
 * etiketi birlikte saran yumuşak bir hapla işaretlenir; yalnızca ince bir
 * çizgi, özellikle açık temada, hangi sekmede olunduğunu yeterince
 * söylemiyordu. Sohbetler sekmesi okunmamış mesaj sayısını rozetle taşır:
 * kullanıcı başka bir sekmedeyken yeni mesajı buradan görür.
 */
const ICONS: Record<string, IconName> = {
  index: "message",
  servers: "compass",
  notifications: "bell",
  me: "user",
};

/**
 * Yüzen çubuk mutlak konumlu olduğu için ekranlar için yer AYIRMAZ.
 * Kaydırılabilir içeriğin son öğesi çubuğun altında kalmasın diye
 * listelere bu kadar alt boşluk verilir (çubuk yüksekliği + payı).
 */
export const FLOATING_TAB_INSET = 92;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Rozet mesaj değil SOHBET sayar: "42" bir sayı yığını, "3 sohbet" bir yapılacak.
  const { chats: unreadChats } = useDirectUnreadCounts();

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        // Gezinme çubuğunun üstünde dursun; cihazda çubuk yoksa taban boşluk.
        bottom: Math.max(insets.bottom, spacing.sm),
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: "row",
          padding: 5,
          borderRadius: radii.full,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.panel,
          boxShadow: `0 8px 30px ${colors.shadow}`,
        }}
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
              badge={route.name === "index" ? unreadChats : 0}
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
      </View>
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
  const press = useSharedValue(0);

  const content = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(press.value ? 0.94 : 1, { damping: 16 }) }],
  }));

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
      accessibilityLabel={badge > 0 ? `${label}, ${badge} okunmamış sohbet` : label}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = 0;
      }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[{ alignItems: "center", justifyContent: "center", gap: 3, minHeight: 58 }, content]}>
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
        <View>
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
              <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: "800", color: colors.onBrand }}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{ fontSize: 11, lineHeight: 14, fontWeight: focused ? "700" : "500", color: tint }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
