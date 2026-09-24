import { useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { Divider, ListGroup, Screen, SectionHeader } from "@/components/ui";
import { registerPushToken, setupNotifications, unregisterPushToken } from "@/lib/notifications";
import { usePreferences } from "@/stores/preferences";
import { colors, spacing, typography } from "@/theme/tokens";

export default function NotificationSettingsScreen() {
  const preferences = usePreferences();
  const [pending, setPending] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const toggleMaster = async (value: boolean) => {
    setPending(true);
    setPermissionError(null);
    try {
      if (value) {
        const granted = await setupNotifications();
        if (!granted) {
          setPermissionError("Bildirim izni sistem ayarlarından kapalı.");
          return;
        }
        await registerPushToken();
      } else {
        await unregisterPushToken();
      }
      preferences.setPreference("notificationsEnabled", value);
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Bildirimler" }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title="BİLDİRİM İZNİ" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title="Ciklet bildirimleri"
              description="Bu cihazda bildirim gösterilmesine izin ver."
              value={preferences.notificationsEnabled}
              pending={pending}
              onChange={(value) => void toggleMaster(value)}
            />
          </ListGroup>
        </View>

        <SectionHeader title="BİLDİRİM TÜRLERİ" />
        <View style={{ paddingHorizontal: spacing.lg, opacity: preferences.notificationsEnabled ? 1 : 0.45 }}>
          <ListGroup>
            <ToggleRow title="Mesajlar ve bahsetmeler" value={preferences.messageNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("messageNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title="Gelen aramalar" value={preferences.callNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("callNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title="Arkadaşlık istekleri" value={preferences.friendNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("friendNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title="Bildirim sesleri" value={preferences.notificationSounds} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("notificationSounds", value); void registerPushToken(); }} />
          </ListGroup>
        </View>

        {permissionError ? <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>{permissionError}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({ title, description, value, onChange, disabled, pending }: { title: string; description?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; pending?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.text }}>{title}</Text>
        {description ? <Text style={{ ...typography.caption, color: colors.muted }}>{description}</Text> : null}
      </View>
      {pending ? <ActivityIndicator color={colors.brand} /> : <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor="#ffffff" />}
    </View>
  );
}
