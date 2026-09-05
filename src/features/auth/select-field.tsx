import { useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Seçim alanı — kimlik formlarındaki doğum tarihi için.
 *
 * Web'de bu üç `<select>`; mobilde platform seçicisi yerine kendi listemizi
 * açıyoruz. Nedeni yalnızca görünüm değil: `@react-native-community/
 * datetimepicker` yeni bir NATIVE modül demek ve gün/ay/yılı ayrı ayrı
 * doğrulayan web akışını (eksik alan → "tümünü doldur", 31 Şubat → "geçerli
 * bir tarih gir") tek bir takvim penceresine sığdırmıyor. Aynı üçlü yapıyı
 * korumak, iki istemcide aynı hata mesajlarını mümkün kılıyor.
 *
 * Görsel dil `AuthField` ile birebir: aynı yükseklik, yarıçap, kenarlık ve
 * zemin. Yan yana dizildiklerinde tek bir alan seti gibi okunur.
 */

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label?: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: boolean;
  /** Liste başlığı — hangi alanın seçildiğini gösterir. */
  title: string;
  disabled?: boolean;
}

const ROW_HEIGHT = 52;

export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  error,
  title,
  disabled,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<FlatList<SelectOption>>(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]!.label : null;

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      {label ? (
        <Text style={{ ...typography.overline, color: error ? colors.danger : colors.muted }}>
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selectedLabel ?? placeholder}`}
        accessibilityState={{ disabled, expanded: open }}
        style={({ pressed }) => ({
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.deep,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            ...typography.body,
            flexShrink: 1,
            color: selectedLabel ? colors.bright : colors.muted,
          }}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" }}
        >
          {/* İçeriğe dokunmak sayfayı kapatmamalı; bu Pressable dokunuşu yutar. */}
          <Pressable
            onPress={() => {}}
            style={{
              maxHeight: "68%",
              backgroundColor: colors.bento,
              borderTopLeftRadius: radii.bentoWrapper,
              borderTopRightRadius: radii.bentoWrapper,
              borderCurve: "continuous",
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.bentoBorder,
              overflow: "hidden",
            }}
          >
            <SafeAreaView edges={["bottom"]}>
              <View style={{ alignItems: "center", paddingTop: spacing.md }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: radii.full,
                    backgroundColor: colors.border,
                  }}
                />
              </View>

              <Text
                style={{
                  ...typography.title,
                  color: colors.bright,
                  paddingHorizontal: spacing.xl,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.sm,
                }}
              >
                {title}
              </Text>

              <FlatList
                ref={listRef}
                data={options}
                keyExtractor={(option) => option.value}
                getItemLayout={(_, index) => ({
                  length: ROW_HEIGHT,
                  offset: ROW_HEIGHT * index,
                  index,
                })}
                // Yıl listesi 120 satır: seçili olanı görünür açmak, kullanıcıyı
                // her açılışta aynı mesafeyi kaydırmaktan kurtarır.
                initialScrollIndex={selectedIndex > 0 ? selectedIndex : undefined}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <Pressable
                      onPress={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => ({
                        height: ROW_HEIGHT,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: spacing.xl,
                        backgroundColor: pressed ? colors.raised : "transparent",
                      })}
                    >
                      <Text
                        style={{
                          ...typography.body,
                          color: active ? colors.brand : colors.text,
                        }}
                      >
                        {item.label}
                      </Text>
                      {active ? <Icon name="check" size={18} color={colors.brand} /> : null}
                    </Pressable>
                  );
                }}
              />
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
