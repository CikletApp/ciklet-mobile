import { Platform, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/stores/auth";
import { colors, radii, spacing } from "@/theme/tokens";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icon";
import { Pressable } from "./pressable";

/**
 * Yüzen oval sekme çubuğu.
 *
 * Ekranın altına yapışan tam genişlikte bir çubuk yerine, kenarlardan
 * boşluklu ve tamamen yuvarlatılmış bir ada. Arkası bulanık (`expo-blur`)
 * olduğu için altından kayan içerik hissedilir ama okunurluğu bozmaz.
 *
 * Blur Android'de daha pahalı ve bazı cihazlarda desteklenmiyor; orada
 * yarı saydam düz yüzeye düşülür.
 */
const ICONS: Record<string, IconName> = {
  index: "home",
  notifications: "bell",
  me: "user",
};

/**
 * Yüzen çubuk mutlak konumlu olduğu için ekranlar için yer AYIRMAZ.
 * Kaydırılabilir içeriğin son öğesi çubuğun altında kalmasın diye
 * listelere bu kadar alt boşluk verilir (çubuk yüksekliği + payı).
 */
export const FLOATING_TAB_INSET = 104;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        // Gezinme çubuğunun üstünde dursun; cihazda çubuk yoksa taban boşluk.
        bottom: Math.max(insets.bottom, spacing.md),
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          borderRadius: radii.full,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          // Yüzen his için gölge; Android'de elevation karşılığı.
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 24}
          tint="dark"
          style={{
            flexDirection: "row",
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.xs,
            // Blur desteklenmezse altındaki yüzey okunurluğu taşır.
            backgroundColor:
              Platform.OS === "ios" ? "transparent" : "rgba(20, 21, 25, 0.88)",
          }}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.title === "string" ? options.title : route.name;

            return (
              <TabItem
                key={route.key}
                label={label}
                icon={ICONS[route.name] ?? "home"}
                /** "Sen" sekmesi ikon değil, kullanıcının avatarını taşır. */
                avatar={route.name === "me"}
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
        </BlurView>
      </View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  avatar,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  avatar?: boolean;
  focused: boolean;
  onPress: () => void;
}) {
  const me = useAuth((s) => s.profile);
  const press = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1 : 0.94, { damping: 16 }) }],
    opacity: withTiming(1 - press.value * 0.3, { duration: 100 }),
  }));

  const pill = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 160 }),
  }));

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      noHitSlop
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = 0;
      }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            paddingVertical: spacing.sm,
            borderRadius: radii.full,
          },
          style,
        ]}
      >
        {/* Seçili sekmenin arkasındaki hap — ikonla birlikte yumuşak belirir. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: spacing.sm,
              right: spacing.sm,
              borderRadius: radii.full,
              backgroundColor: colors.brand,
            },
            pill,
          ]}
        />
        {avatar ? (
          // Durum rozeti de görünür: kullanıcı kendi çevrimiçi/boşta
          // durumunu sekme çubuğundan görebilmeli.
          <Avatar
            profileId={me?.id}
            imageUrl={me?.imageUrl}
            fallbackText={me?.username}
            size={22}
            showPresence
            backgroundColor={focused ? colors.brand : colors.bentoShell}
          />
        ) : (
          <Icon
            name={icon}
            size={20}
            color={focused ? colors.onBrand : colors.muted}
            filled={focused}
          />
        )}
        <Text
          style={{
            fontSize: 10,
            lineHeight: 13,
            fontWeight: focused ? "700" : "500",
            color: focused ? colors.onBrand : colors.muted,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
