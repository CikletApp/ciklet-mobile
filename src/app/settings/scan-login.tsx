import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";

import { Button, Icon, Screen, showToast } from "@/components/ui";
import {
  approveDeviceLogin,
  decodeRingFromPhoto,
  inspectDeviceLogin,
  rejectDeviceLogin,
  type InspectedRequest,
} from "@/features/auth/device-login";
import { useT } from "@/lib/i18n";
import { colors, radii, spacing, typography } from "@/theme/tokens";

/**
 * Ayarlar › Kodu tara — masaüstündeki halka kodunu okuyup girişi onaylama.
 *
 * Üç evre: tarama (kamera + döngü) → onay kartı (isteyen cihaz, konum,
 * zaman) → sonuç. Onay kartı kameranın ÜSTÜNE biner, kamera durur: kullanıcı
 * "evet" demeden ikinci bir kod okunmasın.
 *
 * Döngü yalnızca kamera hazır ve ekran odaktayken çalışır; bir çözüm
 * sürerken yeni fotoğraf çekilmez (takePictureAsync arka arkaya çağrılınca
 * Android'de kuyruk büyüyüp donuyor).
 */

type Phase = "scanning" | "checking" | "confirm" | "sending" | "done";

const SCAN_INTERVAL_MS = 700;

export default function ScanLoginScreen() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [code, setCode] = useState<string | null>(null);
  const [request, setRequest] = useState<InspectedRequest | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const onDecoded = useCallback(async (decoded: string) => {
    setPhase("checking");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const inspected = await inspectDeviceLogin(decoded);
    if (!mounted.current) return;
    if (!inspected.ok) {
      showToast(inspected.reason === "gone" ? t("settings.scanLogin.gone") : t("settings.scanLogin.failed"), "error");
      setPhase("scanning");
      return;
    }
    setCode(decoded);
    setRequest(inspected.request);
    setPhase("confirm");
  }, [t]);

  // Tarama döngüsü.
  useEffect(() => {
    if (phase !== "scanning" || !cameraReady || !permission?.granted) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || busy.current || !camera.current) return;
      busy.current = true;
      try {
        const photo = await camera.current.takePictureAsync({ quality: 0.5, skipProcessing: true, shutterSound: false });
        if (stopped || !photo?.uri) return;
        const decoded = await decodeRingFromPhoto(photo.uri);
        if (stopped) return;
        if (decoded) {
          stopped = true;
          await onDecoded(decoded);
        }
      } catch {
        // Kamera meşgul ya da kare bozuk — sonraki turda tekrar.
      } finally {
        busy.current = false;
      }
    };
    const timer = setInterval(() => void tick(), SCAN_INTERVAL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [phase, cameraReady, permission?.granted, onDecoded]);

  const approve = async () => {
    if (!code) return;
    setPhase("sending");
    const result = await approveDeviceLogin(code);
    if (!mounted.current) return;
    if (result === "ok") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t("settings.scanLogin.approved"));
      setPhase("done");
      router.back();
      return;
    }
    showToast(result === "gone" ? t("settings.scanLogin.gone") : t("settings.scanLogin.failed"), "error");
    setPhase("scanning");
    setCode(null);
    setRequest(null);
  };

  const reject = async () => {
    if (code) await rejectDeviceLogin(code);
    showToast(t("settings.scanLogin.rejected"));
    setPhase("scanning");
    setCode(null);
    setRequest(null);
  };

  if (!permission) return <Screen />;

  if (!permission.granted) {
    return (
      <Screen style={{ justifyContent: "center", padding: spacing["2xl"], gap: spacing.md }}>
        <Stack.Screen options={{ title: t("settings.scanLogin.title") }} />
        <Icon name="camera" size={40} color={colors.muted} />
        <Text style={{ ...typography.title, color: colors.text }}>{t("settings.scanLogin.permissionTitle")}</Text>
        <Text style={{ ...typography.body, color: colors.muted }}>{t("settings.scanLogin.permissionBody")}</Text>
        {/* Bir kez "izin verme" denince sistem bir daha sormuyor; o zaman
            istek boşa düşer, kullanıcıyı uygulama ayarlarına göndeririz. */}
        {permission.canAskAgain ? (
          <Button label={t("settings.scanLogin.permissionAction")} onPress={() => void requestPermission()} />
        ) : (
          <Button label={t("settings.scanLogin.openSettings")} onPress={() => void Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  const showCamera = phase === "scanning" || phase === "checking";

  return (
    <Screen style={{ backgroundColor: "#000" }} edges={["bottom"]}>
      <Stack.Screen options={{ title: t("settings.scanLogin.title") }} />
      <View style={{ flex: 1 }}>
        {showCamera ? (
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing="back"
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        )}

        {/* Vizör: dairesel çerçeve — halka kodun biçimiyle aynı dil. */}
        {showCamera ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 260, height: 260, borderRadius: 130,
                borderWidth: 3, borderColor: phase === "checking" ? colors.brand : "rgba(255,255,255,0.85)",
              }}
            />
            <View style={{ position: "absolute", bottom: spacing["4xl"], paddingHorizontal: spacing["2xl"], alignItems: "center", gap: spacing.sm }}>
              {phase === "checking" ? <ActivityIndicator color={colors.brand} /> : null}
              <Text style={{ ...typography.body, color: "#fff", textAlign: "center", textShadowColor: "#000", textShadowRadius: 6 }}>
                {phase === "checking" ? t("settings.scanLogin.checking") : t("settings.scanLogin.hint")}
              </Text>
            </View>
          </View>
        ) : null}

        {phase === "confirm" || phase === "sending" ? (
          <ConfirmCard request={request} sending={phase === "sending"} onApprove={() => void approve()} onReject={() => void reject()} />
        ) : null}
      </View>
    </Screen>
  );
}

function ConfirmCard({
  request,
  sending,
  onApprove,
  onReject,
}: {
  request: InspectedRequest | null;
  sending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useT();
  const rows: [string, string][] = request
    ? [
        [t("settings.scanLogin.device"), `${request.device.osInfo} · ${request.device.deviceName}`],
        [t("settings.scanLogin.location"), request.device.countryName ?? t("settings.scanLogin.unknownLocation")],
        // Maskeli IP: aynı ağdaysan tanıdık gelir; yabancıysa reddetmek için ikinci ipucu.
        [t("settings.scanLogin.ip"), request.device.ipMasked],
        [t("settings.scanLogin.time"), t("settings.scanLogin.justNow")],
      ]
    : [];

  return (
    <View style={{ position: "absolute", inset: 0, justifyContent: "center", padding: spacing["2xl"] }}>
      <View style={{ backgroundColor: colors.panel, borderRadius: radii.xl, borderCurve: "continuous", padding: spacing["2xl"], gap: spacing.lg }}>
        <View style={{ alignSelf: "center", width: 72, height: 72, borderRadius: 22, borderCurve: "continuous", backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
          <Icon name="monitor" size={34} color="#fff" />
        </View>
        <Text style={{ ...typography.display, color: colors.text, textAlign: "center" }}>{t("settings.scanLogin.confirmTitle")}</Text>
        <Text style={{ ...typography.body, color: colors.muted, textAlign: "center" }}>{t("settings.scanLogin.confirmBody")}</Text>

        <View style={{ backgroundColor: colors.bg, borderRadius: radii.lg, borderCurve: "continuous", padding: spacing.lg, gap: spacing.sm }}>
          {rows.map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
              <Text style={{ ...typography.caption, color: colors.muted }}>{label}</Text>
              <Text style={{ ...typography.caption, color: colors.text, flexShrink: 1, textAlign: "right" }}>{value}</Text>
            </View>
          ))}
        </View>

        <Button label={t("settings.scanLogin.approve")} onPress={onApprove} loading={sending} fullWidth />
        <Button label={t("settings.scanLogin.reject")} onPress={onReject} variant="ghost" disabled={sending} fullWidth />
      </View>
    </View>
  );
}
