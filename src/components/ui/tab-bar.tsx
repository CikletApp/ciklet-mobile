import { Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
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
export const FLOATING_TAB_INSET = 92;

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
        left: spacing.sm,
        right: spacing.sm,
        // Gezinme çubuğunun üstünde dursun; cihazda çubuk yoksa taban boşluk.
        bottom: Math.max(insets.bottom, spacing.sm),
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          borderRadius: radii.xl,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.bentoBorder,
          backgroundColor: colors.bento,
          boxShadow: "0 -6px 28px rgba(0, 0, 0, 0.28)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: spacing.xs,
            minHeight: 64,
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
        </View>
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

  const indicator = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 160 }),
    transform: [{ scaleX: withSpring(focused ? 1 : 0.4, { damping: 18 }) }],
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
            gap: 3,
            minHeight: 64,
            borderRadius: radii.lg,
            borderCurve: "continuous",
          },
          style,
        ]}
      >
        {/* Seçili sekmenin arkasındaki hap — ikonla birlikte yumuşak belirir. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 3,
              width: 22,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.brand,
            },
            indicator,
          ]}
        />
        {avatar ? (
          // Durum rozeti de görünür: kullanıcı kendi çevrimiçi/boşta
          // durumunu sekme çubuğundan görebilmeli.
          //
          // Halka rengi SEÇİMDEN BAĞIMSIZ koyu: zemine göre değiştirildiğinde
          // sekme seçiliyken marka rengine dönüyor ve gerçek durumdan
          // bağımsız, sahte bir yeşil rozet gibi okunuyordu.
          <Avatar
            profileId={me?.id}
            imageUrl={me?.imageUrl}
            fallbackText={me?.username}
            size={22}
            showPresence
            presenceSize={13}
            backgroundColor={colors.bentoShell}
          />
        ) : (
          <Icon
            name={icon}
            size={21}
            color={focused ? colors.bright : colors.muted}
            filled={focused}
          />
        )}
        <Text
          style={{
            fontSize: 10,
            lineHeight: 13,
            fontWeight: focused ? "700" : "500",
            color: focused ? colors.bright : colors.muted,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
