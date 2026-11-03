import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { Avatar, Button, Divider, Icon, ListGroup, ListRow, Pressable, Screen, ScreenLoader, showDialog } from "@/components/ui";
import { accountDisplayName, useSwitcherAccounts } from "@/features/account-switcher/use-accounts";
import { MAX_ACCOUNTS } from "@/features/account-switcher/switcher";
import { useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Ayarlar → Hesap Değiştir — web kullanıcı menüsündeki "Hesap Değiştir" /
 * "Hesapları Yönet" karşılığı (Discord). Hesaba dokun: yeniden giriş
 * yapmadan geçiş; ✕: listeden çıkar; Hesap Ekle.
 */
export default function AccountsScreen() {
  const t = useT();
  const { accounts, busy, onSwitch, onAdd, onRemove } = useSwitcherAccounts();

  if (!accounts) return <ScreenLoader />;
  const full = accounts.length >= MAX_ACCOUNTS;

  const confirmRemove = (account: (typeof accounts)[number]) =>
    showDialog(t("accountSwitcher.remove"), t("accountSwitcher.removeConfirm", { name: accountDisplayName(account) }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("accountSwitcher.remove"), style: "destructive", onPress: () => void onRemove(account) },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: t("accountSwitcher.title") }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] }}>
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("accountSwitcher.description", { max: MAX_ACCOUNTS })}</Text>
        <ListGroup>
          {accounts.map((account, index) => (
            <View key={account.id}>
              {index > 0 ? <Divider inset={64} /> : null}
              <ListRow
                title={accountDisplayName(account)}
                subtitle={account.current ? t("accountSwitcher.current") : account.needsLogin ? t("accountSwitcher.needsLogin") : `@${account.username}`}
                leading={<Avatar profileId={account.id} imageUrl={account.imageUrl} fallbackText={account.username} size={40} backgroundColor={colors.panel} />}
                trailing={
                  busy === account.id ? (
                    <ActivityIndicator color={colors.muted} />
                  ) : account.current ? (
                    <Icon name="check" size={20} color={colors.brand} />
                  ) : (
                    <Pressable
                      onPress={() => confirmRemove(account)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t("accountSwitcher.remove")}
                    >
                      <Icon name="close" size={18} color={colors.muted} />
                    </Pressable>
                  )
                }
                chevron={false}
                onPress={account.current ? undefined : () => void onSwitch(account)}
                accessibilityHint={account.current ? undefined : t("accountSwitcher.switch")}
              />
            </View>
          ))}
        </ListGroup>

        {full ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>{t("accountSwitcher.limitReached", { max: MAX_ACCOUNTS })}</Text>
        ) : (
          <Button label={t("accountSwitcher.add")} variant="secondary" fullWidth onPress={() => void onAdd()} />
        )}
        <Text style={{ ...typography.caption, color: colors.muted }}>{t("accountSwitcher.inCallWarning")}</Text>
      </ScrollView>
    </Screen>
  );
}
