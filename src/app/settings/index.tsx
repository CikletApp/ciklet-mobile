import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useCurrentProfile } from "@/api/hooks";
import { Icon, type IconName } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { CLIENT_VERSION } from "@/lib/device";
import { disconnectSocket } from "@/realtime/socket";
import { useAuth } from "@/stores/auth";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ayarlar.
 *
 * Faz 1'de gezinme iskeleti ve çıkış akışı çalışır; alt ekranlar (hesap,
 * gizlilik, görünüm, dil, bildirimler, oturumlar) Faz 2/3'te doldurulur.
 * Hazır olmayan satırlar devre dışı gösterilir — tıklanıp boş ekrana
 * düşmek, kapalı olduğunu görmekten daha kötü bir deneyim.
 */
export default function SettingsScreen() {
  const { data: profile } = useCurrentProfile();
  const logout = useAuth((s) => s.logout);

  const onLogout = () => {
    Alert.alert("Çıkış yap", "Oturumun bu cihazda kapatılacak.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: () => {
          disconnectSocket();
          void logout();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Group title="HESAP AYARLARI">
          <Row
            icon="user"
            label="Hesap"
            detail={profile?.username ? `@${profile.username}` : undefined}
            onPress={() => router.push("/profile/edit")}
          />
          <Row icon="shield" label="Gizlilik ve Güvenlik" disabled />
          <Row icon="link" label="Bağlantılar" disabled />
          <Row icon="users" label="Arkadaşlık İstekleri" onPress={() => router.push("/friends")} />
        </Group>

        <Group title="UYGULAMA AYARLARI">
          <Row icon="volume" label="Ses" disabled />
          <Row icon="compass" label="Görünüm" detail="Gece" disabled />
          <Row icon="bell" label="Bildirimler" disabled />
        </Group>

        <Group title="OTURUM">
          <Row icon="logout" label="Çıkış Yap" tint={colors.danger} onPress={onLogout} />
        </Group>

        <Text
          style={{
            ...typography.caption,
            color: colors.muted,
            textAlign: "center",
          }}
        >
          Ciklet {CLIENT_VERSION}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.overline, color: colors.muted }}>{title}</Text>
      <View
        style={{
          borderRadius: radii.lg,
          backgroundColor: colors.panel,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
  disabled,
  tint = colors.text,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !onPress }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 52,
        backgroundColor: pressed ? colors.raised : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon name={icon} size={20} color={tint} />
      <Text style={{ ...typography.body, color: tint, flex: 1 }}>{label}</Text>
      {detail ? (
        <Text style={{ ...typography.caption, color: colors.muted }}>{detail}</Text>
      ) : null}
      {!disabled && onPress ? (
        <Icon name="chevron-right" size={16} color={colors.muted} />
      ) : null}
    </Pressable>
  );
}
