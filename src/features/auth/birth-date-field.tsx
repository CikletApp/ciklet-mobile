import { useState } from "react";
import { FlatList, Keyboard, Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Pressable } from "@/components/ui";
import { MIN_SIGNUP_AGE, isOldEnoughToSignUp, latestEligibleBirthYear } from "@/lib/age";
import { authBrand, colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Doğum tarihi — web'deki kayıt formuyla AYNI biçim (ciklet-web
 * `components/auth/signup-form.tsx`): yan yana Gün / Ay / Yıl seçicileri,
 * ay adları yazıyla, yıl listesi 18 yıl öncesinden başlıyor.
 *
 * Eskiden serbest metin "YYYY-AA-GG" alanıydı: klavyede tire yazmak zor,
 * "20030101" gibi girişler reddediliyordu ve biçim web'dekinden farklıydı.
 */

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const ROW_HEIGHT = 48;

export interface BirthDateParts {
  day: number | null;
  month: number | null;
  year: number | null;
}

export const EMPTY_BIRTH_DATE: BirthDateParts = { day: null, month: null, year: null };

/**
 * Seçimi tarihe çevirir. Eksik seçimde ikisi de null — form düğmesi zaten
 * kapalı, "doldur" demek için ayrıca hata göstermeye gerek yok.
 */
export function resolveBirthDate({ day, month, year }: BirthDateParts): {
  date: Date | null;
  error: string | null;
} {
  if (day === null || month === null || year === null) return { date: null, error: null };

  // Web'le aynı: YEREL gece yarısı. 31 Şubat gibi taşan gün Date'te sonraki
  // aya kayar; yakalamanın yolu alanları geri okumak.
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { date: null, error: "Lütfen geçerli bir doğum tarihi gir." };
  }
  if (!isOldEnoughToSignUp(date)) {
    return { date: null, error: `Ciklet'e kaydolmak için en az ${MIN_SIGNUP_AGE} yaşında olmalısın.` };
  }
  return { date, error: null };
}

type Part = keyof BirthDateParts;

interface Option {
  value: number;
  label: string;
}

export function BirthDateField({
  value,
  onChange,
  error,
}: {
  value: BirthDateParts;
  onChange: (next: BirthDateParts) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState<Part | null>(null);

  const latestYear = latestEligibleBirthYear();
  const parts: Record<Part, { placeholder: string; title: string; options: Option[] }> = {
    day: {
      placeholder: "Gün",
      title: "Gün seç",
      options: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    },
    month: {
      placeholder: "Ay",
      title: "Ay seç",
      options: MONTHS.map((label, i) => ({ value: i + 1, label })),
    },
    year: {
      placeholder: "Yıl",
      title: "Yıl seç",
      // Liste 18 yıl öncesinden BAŞLIYOR: bu yıl doğmuş birinin
      // kaydolabileceği izlenimini vermek, sonradan reddetmekten kötü.
      options: Array.from({ length: 120 }, (_, i) => ({ value: latestYear - i, label: String(latestYear - i) })),
    },
  };

  const openPart = (part: Part) => {
    // Açık klavye sayfanın yarısını kapatıyor; seçim listesi onun altında kalırdı.
    Keyboard.dismiss();
    setOpen(part);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ ...typography.overline, color: error ? colors.danger : colors.muted }}>DOĞUM TARİHİ</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {(["day", "month", "year"] as const).map((part) => {
          const selected = parts[part].options.find((option) => option.value === value[part]);
          return (
            <Pressable
              key={part}
              noHitSlop
              accessibilityRole="button"
              accessibilityLabel={`${parts[part].placeholder}: ${selected?.label ?? "seçilmedi"}`}
              onPress={() => openPart(part)}
              style={({ pressed }) => ({
                // Ay adları ("Ağustos") sayılardan uzun; sütun biraz geniş.
                flex: part === "month" ? 1.35 : 1,
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingLeft: spacing.md,
                paddingRight: spacing.sm,
                borderRadius: radii.lg,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: error ? colors.danger : open === part ? authBrand.lime : colors.border,
                backgroundColor: pressed ? colors.raised : colors.deep,
              })}
            >
              <Text
                numberOfLines={1}
                style={{ ...typography.body, flex: 1, color: selected ? colors.bright : colors.muted }}
              >
                {selected?.label ?? parts[part].placeholder}
              </Text>
              <Icon name="chevron-down" size={16} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ ...typography.caption, color: colors.danger }}>{error}</Text> : null}

      <OptionSheet
        visible={open !== null}
        title={open ? parts[open].title : ""}
        options={open ? parts[open].options : []}
        selected={open ? value[open] : null}
        onClose={() => setOpen(null)}
        onSelect={(selected) => {
          if (open) onChange({ ...value, [open]: selected });
          setOpen(null);
        }}
      />
    </View>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  selected: number | null;
  onClose: () => void;
  onSelect: (value: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const selectedIndex = options.findIndex((option) => option.value === selected);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          noHitSlop
          accessibilityLabel="Kapat"
          onPress={onClose}
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim }}
        />
        <View
          style={{
            maxHeight: "62%",
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            gap: spacing.sm,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderCurve: "continuous",
            backgroundColor: colors.bento,
          }}
        >
          <View style={{ width: 38, height: 4, borderRadius: radii.full, backgroundColor: colors.border, alignSelf: "center" }} />
          <Text style={{ ...typography.title, color: colors.bright, paddingHorizontal: spacing.lg }}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(option) => String(option.value)}
            // Seçili değer açılışta görünsün: 120 yıllık listede elle aramak yorucu.
            initialScrollIndex={selectedIndex > 3 ? selectedIndex - 2 : undefined}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            contentContainerStyle={{ paddingHorizontal: spacing.sm }}
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <Pressable
                  noHitSlop
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => ({
                    height: ROW_HEIGHT,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    backgroundColor: pressed || active ? colors.raised : "transparent",
                  })}
                >
                  <Text style={{ ...(active ? typography.bodyStrong : typography.body), color: active ? authBrand.lime : colors.bright }}>
                    {item.label}
                  </Text>
                  {active ? <Icon name="check" size={18} color={authBrand.lime} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
