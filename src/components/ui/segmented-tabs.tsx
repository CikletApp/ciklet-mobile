import { ScrollView, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";
import { Pressable } from "./pressable";
import { fw } from "@/theme/fonts";

/**
 * Segment kontrolü.
 *
 * İki görünüm:
 *  - `underline` : ekran içi ana bölümler (Kullanıcı Profili ⇄ Sunucu Profilleri)
 *  - `pill`      : filtre çipleri (arama kategorileri)
 *
 * Üçten fazla seçenek varsa `pill` yatay kaydırılabilir olur; `underline`
 * sabittir çünkü kaydırılan alt çizgi hangi sekmede olduğunu gizler.
 */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Sağda küçük sayı (ör. bekleyen istek adedi). */
  count?: number;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = "underline",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: "underline" | "pill";
}) {
  if (variant === "pill") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        /**
         * YATAY bir ScrollView dikey alan İSTEMEMELİ.
         *
         * Varsayılan `flexGrow: 1` ile bu şerit bir flex sütununun içine
         * konduğunda kalan bütün yüksekliği yutuyor ve çipler ekranın
         * yarısı boyunda dev haplara dönüşüyor. Kapsayıcıya sarmak
         * çağıranın hatırlaması gereken bir kural olurdu; kısıtlama
         * bileşenin kendisine ait.
         */
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        }}
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              haptic="light"
              noHitSlop
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              /*
               * Seçili çip dolgu yerine vurgunun yüzeye karışmış tonu ve
               * ince vurgu kenarı taşır: tam dolgu, listedeki okunmamış
               * rozetleriyle aynı ağırlıkta bağırıyordu.
               */
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: active ? colors.brandSoft : pressed ? colors.raised : "transparent",
              })}
            >
              <Text
                style={{
                  ...typography.caption,
                  fontSize: 14,
                  ...fw(active ? 700 : 600),
                  color: active ? colors.brand : colors.text,
                }}
              >
                {item.label}
              </Text>
              {item.count ? (
                <Text
                  style={{
                    ...typography.caption,
                    ...fw(700),
                    color: active ? colors.brand : colors.muted,
                  }}
                >
                  {item.count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            haptic="light"
            noHitSlop
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
              paddingVertical: spacing.md,
              borderBottomWidth: 2,
              borderBottomColor: active ? colors.brand : "transparent",
            }}
          >
            <Text
              style={{
                ...typography.bodyStrong,
                color: active ? colors.bright : colors.muted,
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {item.count ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>
                {item.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
