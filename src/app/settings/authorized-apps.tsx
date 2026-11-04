import { Linking, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { EntitlementType, SkuType, useAppPurchases, useAuthorizedApps, useRevokeAuthorizedApp, type AppPurchase } from "@/api/hooks";
import { Avatar, EmptyState, IconButton, ListGroup, ListRow, ListSkeleton, Screen, SectionHeader, Tag, showDialog } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

/** Web (settings-apps-tab `settingsGeneral.apps.userInstalled`) ile aynı metin. */
const USER_INSTALLED_NOTE =
  "Hesabına kurulu — komutları DM'lerinde, grup DM'lerinde ve izin veren sunucularda kullanabilirsin.";

export default function AuthorizedAppsScreen() {
  const { data: apps, isLoading } = useAuthorizedApps();
  const revoke = useRevokeAuthorizedApp();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Yetkili Uygulamalar" }} />
      {isLoading ? (
        <ListSkeleton />
      ) : !apps?.length ? (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
          <EmptyState
            icon="compass"
            title="Yetkili uygulama yok"
            description="Bir aktiviteye veya uygulamaya izin verdiğinde burada görünecek."
          />
          <PurchasedApps />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
          <SectionHeader title={`${apps.length} UYGULAMA`} />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ListGroup>
              {apps.map((authorization) => (
                <ListRow
                  key={authorization.id}
                  title={authorization.application.name}
                  subtitle={
                    authorization.userInstalledAt
                      ? USER_INSTALLED_NOTE
                      : (authorization.application.description ?? "Ciklet hesabına erişebilir.")
                  }
                  chevron={false}
                  leading={
                    <Avatar
                      imageUrl={authorization.application.imageUrl}
                      fallbackText={authorization.application.name}
                      size={42}
                      shape="squircle"
                    />
                  }
                  trailing={
                    <IconButton
                      icon="close"
                      label="Erişimi kaldır"
                      tint={colors.danger}
                      disabled={revoke.isPending}
                      onPress={() =>
                        showDialog(
                          "Erişimi kaldır",
                          `${authorization.application.name} için verilen tüm erişim ve tokenlar iptal edilecek.`,
                          [
                            { text: "Vazgeç", style: "cancel" },
                            {
                              text: "Kaldır",
                              style: "destructive",
                              onPress: () => revoke.mutate(authorization.id),
                            },
                          ]
                        )
                      }
                    />
                  }
                  onPress={
                    authorization.application.aboutUrl
                      ? () => void Linking.openURL(authorization.application.aboutUrl!)
                      : undefined
                  }
                />
              ))}
            </ListGroup>
          </View>
          <Text style={{ ...typography.caption, color: colors.muted, padding: spacing.lg }}>
            Erişimi kaldırmak, uygulamanın mevcut erişim ve yenileme tokenlarını da geçersiz kılar.
          </Text>
          <PurchasedApps />
        </ScrollView>
      )}
    </Screen>
  );
}

/** Satın Alınanlar — uygulama ürün hakları (web settings-purchased-apps ile aynı metinler). */
function PurchasedApps() {
  const { data: rows, isLoading, isError } = useAppPurchases();
  const kind = (r: AppPurchase) =>
    r.sku.type === SkuType.SUBSCRIPTION ? "Abonelik" : r.sku.type === SkuType.CONSUMABLE ? "Tüketilebilir" : "Kalıcı";
  return (
    <View>
      <SectionHeader title="SATIN ALINANLAR" />
      <View style={{ paddingHorizontal: spacing.lg }}>
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>Satın alınanlar yüklenemedi.</Text>
        ) : !rows?.length ? (
          <Text style={{ ...typography.caption, color: colors.muted }}>Henüz bir uygulamadan ürün satın almadın.</Text>
        ) : (
          <ListGroup>
            {rows.map((r) => {
              const parts = [r.application.name];
              if (r.server) parts.push(`${r.server.name} sunucusu için`);
              if (r.endsAt) parts.push(`Bitiş: ${new Date(r.endsAt).toLocaleDateString("tr-TR")}`);
              const tags = [kind(r)];
              if (r.type === EntitlementType.TEST_MODE_PURCHASE) tags.push("Test");
              if (r.consumed) tags.push("Kullanıldı");
              else if (!r.active) tags.push("Süresi doldu");
              return (
                <ListRow
                  key={r.id}
                  title={r.sku.name}
                  subtitle={parts.join(" · ")}
                  chevron={false}
                  leading={
                    <Avatar imageUrl={r.sku.imageUrl ?? r.application.imageUrl} fallbackText={r.sku.name} size={42} shape="squircle" />
                  }
                  trailing={
                    <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 140 }}>
                      {tags.map((t) => (
                        <Tag key={t} label={t} />
                      ))}
                    </View>
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </View>
    </View>
  );
}
