import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";

import { useAuthorizedApps, useRevokeAuthorizedApp } from "@/api/hooks";
import { Avatar, EmptyState, IconButton, ListGroup, ListRow, ListSkeleton, Screen, SectionHeader } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

export default function AuthorizedAppsScreen() {
  const { data: apps, isLoading } = useAuthorizedApps();
  const revoke = useRevokeAuthorizedApp();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Yetkili Uygulamalar" }} />
      {isLoading ? (
        <ListSkeleton />
      ) : !apps?.length ? (
        <EmptyState
          icon="compass"
          title="Yetkili uygulama yok"
          description="Bir aktiviteye veya uygulamaya izin verdiğinde burada görünecek."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing["4xl"] }}>
          <SectionHeader title={`${apps.length} UYGULAMA`} />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <ListGroup>
              {apps.map((authorization) => (
                <ListRow
                  key={authorization.id}
                  title={authorization.application.name}
                  subtitle={authorization.application.description ?? "Ciklet hesabına erişebilir."}
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
                        Alert.alert(
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
        </ScrollView>
      )}
    </Screen>
  );
}
