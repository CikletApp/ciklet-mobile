import { useRef } from "react";
import { Linking, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";

import { Button, Icon, Screen } from "@/components/ui";
import { normalizeFamilyCode, useScannedFamilyCode } from "@/features/family-center/api";
import { useT } from "@/lib/i18n";
import { colors, spacing, typography } from "@/theme/tokens";

/**
 * Aile Merkezi → QR Kodunu Tara (veli). Gencin ekranındaki QR yalnızca
 * bağlantı kodunu taşır; okunan kod Aile Merkezi formuna düşer ve istek
 * yine elle gönderilir (genç ayrıca onaylar).
 */
export default function FamilyCenterScanScreen() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen style={{ justifyContent: "center", padding: spacing["2xl"], gap: spacing.md }}>
        <Stack.Screen options={{ title: t("familyCenter.parent.scan") }} />
        <Icon name="camera" size={40} color={colors.muted} />
        <Text style={{ ...typography.title, color: colors.text }}>{t("settings.scanLogin.permissionTitle")}</Text>
        <Text style={{ ...typography.body, color: colors.muted }}>{t("settings.scanLogin.permissionBody")}</Text>
        {permission.canAskAgain ? (
          <Button label={t("settings.scanLogin.permissionAction")} onPress={() => void requestPermission()} />
        ) : (
          <Button label={t("settings.scanLogin.openSettings")} onPress={() => void Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: "#000" }} edges={["bottom"]}>
      <Stack.Screen options={{ title: t("familyCenter.parent.scan") }} />
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(result) => {
            if (done.current) return;
            const code = normalizeFamilyCode(result.data ?? "");
            if (!code) return;
            done.current = true;
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            useScannedFamilyCode.getState().set(code);
            router.back();
          }}
        />
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" }} />
          <Text
            style={{
              ...typography.body,
              color: "#fff",
              textAlign: "center",
              position: "absolute",
              bottom: spacing["4xl"],
              paddingHorizontal: spacing["2xl"],
              textShadowColor: "#000",
              textShadowRadius: 6,
            }}
          >
            {t("familyCenter.parent.addDescription")}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
