import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Platform, ScrollView, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";

import { useNotificationSettings, useResetNotificationSetting } from "@/api/hooks";
import { Button, Divider, IconButton, ListGroup, ListRow, Screen, SectionHeader } from "@/components/ui";
import {
  canShowFullScreenCall,
  nativeIncomingCalls,
  openFullScreenCallSettings,
} from "@/features/call/incoming-call";
import { openNotificationSettings } from "@/features/notifications/notification-sheet";
import { SoundSettingsSection } from "@/features/notifications/sound-settings-section";
import { LEVEL_LABELS, muteRemainingLabel, settingKey, type NotificationSettingRecord } from "@/lib/notification-settings";
import { useNow } from "@/lib/use-now";
import { registerPushToken, setupNotifications, unregisterPushToken } from "@/lib/notifications";
import { useT } from "@/lib/i18n";
import { usePreferences } from "@/stores/preferences";
import { colors, spacing, typography } from "@/theme/tokens";

export default function NotificationSettingsScreen() {
  const preferences = usePreferences();
  const [pending, setPending] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const fullScreenCalls = useFullScreenCallPermission();
  const t = useT();

  const toggleMaster = async (value: boolean) => {
    setPending(true);
    setPermissionError(null);
    try {
      if (value) {
        const granted = await setupNotifications();
        if (!granted) {
          setPermissionError(t("settings.notifications.permissionDenied"));
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
      <Stack.Screen options={{ title: t("settings.notifications.title") }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
        <SectionHeader title={t("settings.notifications.permission")} />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ListGroup>
            <ToggleRow
              title={t("settings.notifications.master")}
              description={t("settings.notifications.masterDescription")}
              value={preferences.notificationsEnabled}
              pending={pending}
              onChange={(value) => void toggleMaster(value)}
            />
          </ListGroup>
        </View>

        <SectionHeader title={t("settings.notifications.types")} />
        <View style={{ paddingHorizontal: spacing.lg, opacity: preferences.notificationsEnabled ? 1 : 0.45 }}>
          <ListGroup>
            <ToggleRow title={t("settings.notifications.messages")} value={preferences.messageNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("messageNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title={t("settings.notifications.calls")} value={preferences.callNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("callNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title={t("settings.notifications.friends")} value={preferences.friendNotifications} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("friendNotifications", value); void registerPushToken(); }} />
            <Divider inset={16} />
            <ToggleRow title={t("settings.notifications.sounds")} value={preferences.notificationSounds} disabled={!preferences.notificationsEnabled} onChange={(value) => { preferences.setPreference("notificationSounds", value); void registerPushToken(); }} />
          </ListGroup>
        </View>

        <SoundSettingsSection />

        <NotificationOverrides />

        {fullScreenCalls === "denied" ? (
          <>
            <SectionHeader title={t("settings.notifications.lockScreen")} />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListGroup>
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  <Text style={{ ...typography.body, color: colors.text }}>{t("settings.notifications.fullScreenOff")}</Text>
                  <Text style={{ ...typography.caption, color: colors.muted }}>
                    {t("settings.notifications.fullScreenBody")}
                  </Text>
                  <Button label={t("settings.notifications.openSettings")} variant="secondary" onPress={openFullScreenCallSettings} />
                </View>
              </ListGroup>
            </View>
          </>
        ) : null}

        {permissionError ? <Text style={{ ...typography.caption, color: colors.danger, padding: spacing.lg }}>{permissionError}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * Sunucu, kanal ve sohbet bazlı ayarlar (web: Bildirimler → özel ayarlar
 * listesi). Satıra dokununca aynı bildirim sayfası açılır; sağdaki düğme
 * kaydı siler.
 */
function NotificationOverrides() {
  const t = useT();
  const { data: records } = useNotificationSettings();
  const reset = useResetNotificationSetting();
  const now = useNow();
  const list = records ?? [];

  const describe = (record: NotificationSettingRecord) => {
    const parts: string[] = [];
    const muted = muteRemainingLabel(record.mutedUntil, now);
    if (muted) parts.push(muted);
    if (record.level) parts.push(LEVEL_LABELS[record.level]);
    if (record.suppressEveryone) parts.push("@herkes bastırıldı");
    return parts.join(" · ");
  };

  return (
    <>
      <SectionHeader title={t("settings.notifications.overrides")} />
      <View style={{ paddingHorizontal: spacing.lg }}>
        {list.length === 0 ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("settings.notifications.overridesEmpty")}</Text>
        ) : (
          <ListGroup>
            {list.map((record, index) => {
              const kind = record.directId ? "direct" : record.channelId ? "channel" : "server";
              const target = record.directId
                ? { directId: record.directId }
                : record.channelId
                  ? { channelId: record.channelId, serverId: record.serverId ?? undefined }
                  : { serverId: record.serverId ?? undefined };
              const title = record.label ?? (kind === "direct" ? "Sohbet" : kind === "channel" ? "Kanal" : "Sunucu");
              return (
                <View key={settingKey(record)}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    icon={kind === "direct" ? "message" : kind === "channel" ? "hash" : "compass"}
                    title={title}
                    subtitle={describe(record) || undefined}
                    onPress={() => openNotificationSettings({ target, kind, title })}
                    trailing={
                      <IconButton
                        icon="rotate-ccw"
                        label={t("settings.notifications.reset")}
                        background="transparent"
                        tint={colors.muted}
                        onPress={() => reset.mutate(target)}
                      />
                    }
                  />
                </View>
              );
            })}
          </ListGroup>
        )}
      </View>
    </>
  );
}

/**
 * Android 14+ tam ekran bildirim izni (USE_FULL_SCREEN_INTENT). Kullanıcı
 * ayarlardan dönünce yeniden okunur; eski sürümlerde ve iOS'ta sorulmaz.
 */
function useFullScreenCallPermission(): "granted" | "denied" | "unavailable" {
  const read = useCallback((): "granted" | "denied" | "unavailable" => {
    if (Platform.OS !== "android" || !nativeIncomingCalls) return "unavailable";
    return canShowFullScreenCall() ? "granted" : "denied";
  }, []);
  const [state, setState] = useState(read);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") setState(read());
    });
    return () => subscription.remove();
  }, [read]);
  return state;
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
