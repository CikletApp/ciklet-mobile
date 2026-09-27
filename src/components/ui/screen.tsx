import { ActivityIndicator, Text, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";

/**
 * Ekran kabuğu — güvenli alan + zemin rengi tek yerden.
 *
 * `edges` varsayılan olarak yalnızca yatay ve alt kenarı korur: üst kenarı
 * navigator'ın başlığı zaten yönetir, ikisini birden uygulamak çift boşluk
 * bırakır.
 */
export function Screen({
  children,
  edges = ["left", "right", "bottom"],
  style,
  ...rest
}: ViewProps & { edges?: readonly Edge[] }) {
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: colors.bg }, style]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

/** Tam ekran yükleniyor göstergesi. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.brand} />
      {label ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{label}</Text>
      ) : null}
    </View>
  );
}

/**
 * Boş durum. Her liste ekranı bunu kullanır — "hiçbir şey yok" ekranı
 * boş bırakılırsa kullanıcı yükleniyor mu bitti mi ayırt edemez.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing["3xl"],
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.panel,
        }}
      >
        <Icon name={icon} size={28} color={colors.muted} />
      </View>
      <Text
        style={{ ...typography.title, color: colors.bright, textAlign: "center" }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{ ...typography.body, color: colors.muted, textAlign: "center" }}
        >
          {description}
        </Text>
      ) : null}
      {/* Sarmalayıcı şart: `Button` tam genişlik değilken kendine
          `alignSelf: "flex-start"` veriyor ve kutunun ortalamasını eziyordu —
          "Yeni Grup" gibi eylemler sola kayıyordu. */}
      {action ? <View style={{ alignItems: "center", paddingTop: spacing.xs }}>{action}</View> : null}
    </View>
  );
}

/** Hata durumu — ağ hatası ile sunucu hatasını ayırt eder. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="shield"
      title="Bir şeyler ters gitti"
      description={message}
      action={
        onRetry ? (
          <Text
            onPress={onRetry}
            style={{ ...typography.bodyStrong, color: colors.brand }}
            accessibilityRole="button"
          >
            Tekrar dene
          </Text>
        ) : undefined
      }
    />
  );
}
